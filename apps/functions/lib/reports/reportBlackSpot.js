"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportBlackSpot = exports.DEFAULT_DEDUPLICATION_WINDOW_DAYS = exports.DEFAULT_DEDUPLICATION_RADIUS_METERS = void 0;
exports.processReportBlackSpotLogic = processReportBlackSpotLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const rateLimit_1 = require("../lib/rateLimit");
const engine_1 = require("../lib/engine");
const constants_1 = require("../lib/constants");
const geo_1 = require("../lib/geo");
exports.DEFAULT_DEDUPLICATION_RADIUS_METERS = 150;
exports.DEFAULT_DEDUPLICATION_WINDOW_DAYS = 14;
function boundedText(value, max) {
    return typeof value === 'string' && value.length <= max;
}
async function processReportBlackSpotLogic(db, payload, userId, options) {
    const isAnonymous = options?.isAnonymous ?? false;
    // `userId` is always the server-verified request.auth.uid by the time it reaches here (see the
    // onCall wrapper below), so this guards against a malformed/empty value, not anonymous sessions
    // specifically — a genuine Firebase Anonymous-Auth uid is a random string, never the literal
    // word 'anonymous'.
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to report a road hazard.');
    }
    const lat = payload.location?.lat ?? payload.latitude;
    const lng = payload.location?.lng ?? payload.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !(0, constants_1.isWithinKenya)(lat, lng)) {
        throw new https_1.HttpsError('invalid-argument', 'A valid location is required.');
    }
    if (payload.title !== undefined && !boundedText(payload.title, 120)) {
        throw new https_1.HttpsError('invalid-argument', 'Title must be 120 characters or fewer.');
    }
    if (payload.description !== undefined && !boundedText(payload.description, 2000)) {
        throw new https_1.HttpsError('invalid-argument', 'Description must be 2000 characters or fewer.');
    }
    if (payload.locationName !== undefined && !boundedText(payload.locationName, 160)) {
        throw new https_1.HttpsError('invalid-argument', 'Location name is too long.');
    }
    if (payload.routeName !== undefined && !boundedText(payload.routeName, 160)) {
        throw new https_1.HttpsError('invalid-argument', 'Route name is too long.');
    }
    if (payload.county !== undefined && !boundedText(payload.county, 80)) {
        throw new https_1.HttpsError('invalid-argument', 'County is too long.');
    }
    if (payload.hazardType !== undefined && !boundedText(payload.hazardType, 80)) {
        throw new https_1.HttpsError('invalid-argument', 'Hazard type is invalid.');
    }
    if (payload.severity !== undefined && !['low', 'medium', 'high', 'critical'].includes(payload.severity)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid hazard severity.');
    }
    await (0, rateLimit_1.enforceRateLimit)(db, userId, 'black_spot', Date.now(), {
        isAnonymous,
        secondaryKey: options?.secondaryKey,
    });
    // Fetch reporter's trustScore from users collection to calculate dynamic hazard confidence
    let reporterTrustScore = 0.5; // default sane baseline
    try {
        const userDocSnap = await db.collection('users').doc(userId).get();
        if (userDocSnap.exists) {
            const userData = userDocSnap.data();
            const rawTrust = userData?.trustScore;
            if (typeof rawTrust === 'number' && Number.isFinite(rawTrust)) {
                // Normalize 0-100 scale down to 0-1 if necessary
                reporterTrustScore = rawTrust > 1.0
                    ? Math.min(1.0, Math.max(0.0, rawTrust / 100))
                    : Math.min(1.0, Math.max(0.0, rawTrust));
            }
        }
    }
    catch (err) {
        console.warn(`[reportBlackSpot] Could not load trustScore for user ${userId}, using default:`, err);
    }
    const hasEvidencePhoto = Boolean(payload.photoUrl && typeof payload.photoUrl === 'string' && payload.photoUrl.trim().length > 0);
    const now = new Date().toISOString();
    const nowMs = Date.now();
    // Load product-tunable deduplication parameters from system_config with fallback to defaults
    let deduplicationRadiusMeters = exports.DEFAULT_DEDUPLICATION_RADIUS_METERS;
    let deduplicationWindowDays = exports.DEFAULT_DEDUPLICATION_WINDOW_DAYS;
    try {
        const configSnap = await db.collection('system_config').doc('black_spots').get();
        if (configSnap.exists) {
            const configData = configSnap.data();
            if (typeof configData?.deduplicationRadiusMeters === 'number' && configData.deduplicationRadiusMeters > 0) {
                deduplicationRadiusMeters = configData.deduplicationRadiusMeters;
            }
            if (typeof configData?.deduplicationWindowDays === 'number' && configData.deduplicationWindowDays > 0) {
                deduplicationWindowDays = configData.deduplicationWindowDays;
            }
        }
    }
    catch {
        // Graceful fallback to default constants if system_config is uninitialized or inaccessible
    }
    // Check for existing non-archived black spots within deduplication radius and time window
    const { minLat, maxLat, minLng, maxLng } = (0, geo_1.getBoundingBox)(lat, lng, deduplicationRadiusMeters);
    const deduplicationWindowMs = deduplicationWindowDays * 24 * 60 * 60 * 1000;
    let matchedDoc = null;
    const collectionRef = db.collection('black_spots');
    if (typeof collectionRef.where === 'function') {
        try {
            const querySnapshot = await collectionRef
                .where('latitude', '>=', minLat)
                .where('latitude', '<=', maxLat)
                .get();
            let minDistance = Infinity;
            for (const doc of querySnapshot.docs) {
                const data = doc.data();
                if (!data)
                    continue;
                // Skip archived and resolved spots (decayStaleBlackSpots.ts consistency)
                if (data.status === 'archived' || data.status === 'resolved') {
                    continue;
                }
                // Time window check: ancient or stale spots do not absorb new reports
                const timestampStr = data.lastReportedAt || data.updatedAt || data.createdAt;
                if (timestampStr) {
                    const spotTimeMs = new Date(timestampStr).getTime();
                    if (!isNaN(spotTimeMs) && nowMs - spotTimeMs > deduplicationWindowMs) {
                        continue;
                    }
                }
                const spotLat = typeof data.latitude === 'number' ? data.latitude : data.location?.lat;
                const spotLng = typeof data.longitude === 'number' ? data.longitude : data.location?.lng;
                if (typeof spotLat !== 'number' || typeof spotLng !== 'number') {
                    continue;
                }
                // Bounding box filter for longitude
                if (spotLng < minLng || spotLng > maxLng) {
                    continue;
                }
                // Exact Haversine distance
                const distanceMeters = (0, geo_1.calculateHaversineDistanceMeters)(lat, lng, spotLat, spotLng);
                if (distanceMeters <= deduplicationRadiusMeters && distanceMeters < minDistance) {
                    minDistance = distanceMeters;
                    matchedDoc = {
                        id: doc.id,
                        ref: doc.ref || collectionRef.doc(doc.id),
                        data,
                        distanceMeters,
                    };
                }
            }
        }
        catch (err) {
            console.warn('[reportBlackSpot] Deduplication proximity query failed, falling back to new spot:', err);
        }
    }
    // If a matching nearby active black spot is found, corroborate it instead of duplicating
    if (matchedDoc) {
        const matchedSpotId = matchedDoc.id;
        const matchedData = matchedDoc.data;
        const matchedRef = matchedDoc.ref;
        const existingCount = typeof matchedData.corroborationCount === 'number'
            ? matchedData.corroborationCount
            : typeof matchedData.corroborationsCount === 'number'
                ? matchedData.corroborationsCount
                : 1;
        const newCorroborationCount = existingCount + 1;
        // Extend existing confidence formula:
        // Incorporate reporter trust and photo presence
        const existingTrust = typeof matchedData.reporterTrustScore === 'number'
            ? matchedData.reporterTrustScore
            : 0.5;
        const effectiveTrustScore = Math.max(existingTrust, reporterTrustScore);
        const hasPhoto = Boolean(hasEvidencePhoto ||
            matchedData.photoUrl ||
            (Array.isArray(matchedData.evidencePhotoUrls) && matchedData.evidencePhotoUrls.length > 0));
        const newConfidenceScore = engine_1.ConfidenceScorer.calculateHazardConfidence(newCorroborationCount, effectiveTrustScore, hasPhoto);
        const updateFields = {
            corroborationCount: newCorroborationCount,
            corroborationsCount: newCorroborationCount,
            confidenceScore: newConfidenceScore,
            reporterTrustScore: effectiveTrustScore,
            lastReportedAt: now,
            updatedAt: now,
        };
        if (payload.photoUrl && !matchedData.photoUrl) {
            updateFields.photoUrl = payload.photoUrl;
        }
        await matchedRef.set(updateFields, { merge: true });
        // Append to reports subcollection under existing black spot for auditability
        const reportSubId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const reportSubData = {
            id: reportSubId,
            reportId: reportSubId,
            spotId: matchedSpotId,
            reportedByUid: userId,
            reportedByDisplayName: payload.reportedByDisplayName?.trim().slice(0, 120) || 'Commuter',
            title: payload.title?.trim() || matchedData.title || 'Road Hazard',
            description: payload.description?.trim() || '',
            hazardType: payload.hazardType || matchedData.hazardType || 'accident_prone',
            severity: payload.severity || matchedData.severity || 'high',
            location: { lat, lng },
            latitude: lat,
            longitude: lng,
            photoUrl: payload.photoUrl || null,
            reporterTrustScore,
            createdAt: now,
        };
        const reportsColRef = typeof matchedRef.collection === 'function'
            ? matchedRef.collection('reports')
            : db.collection('black_spots').doc(matchedSpotId).collection('reports');
        if (typeof reportsColRef?.doc === 'function') {
            await reportsColRef.doc(reportSubId).set(reportSubData);
        }
        // Write audit log for corroboration
        const auditId = `audit_${matchedSpotId}_${Date.now()}`;
        await db.collection('audit_logs').doc(auditId).set({
            id: auditId,
            action: 'CORROBORATE_BLACK_SPOT',
            actorUid: userId,
            actorName: reportSubData.reportedByDisplayName,
            actorRole: 'passenger',
            target: `Black Spot ${matchedSpotId} (${matchedData.title || 'Road Hazard'})`,
            timestamp: now,
            details: {
                spotId: matchedSpotId,
                corroborationCount: newCorroborationCount,
                confidenceScore: newConfidenceScore,
                reporterTrustScore,
                location: { lat, lng },
                distanceMeters: Math.round(matchedDoc.distanceMeters * 10) / 10,
            },
        });
        return {
            success: true,
            spotId: matchedSpotId,
            title: matchedData.title || 'Road Hazard',
            status: matchedData.status || 'pending',
            createdAt: matchedData.createdAt || now,
            corroborated: true,
        };
    }
    // If no match found: proceed with standard new black spot creation
    const confidenceScore = engine_1.ConfidenceScorer.calculateHazardConfidence(1, reporterTrustScore, hasEvidencePhoto);
    const spotId = payload.id && /^bs_[A-Za-z0-9_-]{1,100}$/.test(payload.id)
        ? payload.id
        : `bs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const docData = {
        id: spotId,
        spotId,
        title: payload.title?.trim() || 'Road Hazard',
        name: payload.title?.trim() || payload.locationName?.trim() || 'Road Hazard',
        description: payload.description?.trim() || '',
        hazardDescription: payload.description?.trim() || payload.title?.trim() || 'Road Hazard',
        hazardType: payload.hazardType || 'accident_prone',
        severity: payload.severity || 'high',
        locationName: payload.locationName?.trim() || '',
        routeName: payload.routeName?.trim() || payload.locationName?.trim() || 'Kenyan Highway',
        county: payload.county?.trim() || 'Nairobi',
        latitude: lat,
        longitude: lng,
        location: { lat, lng },
        photoUrl: payload.photoUrl || undefined,
        reportedByUid: userId,
        reportedByUserId: userId,
        reportedByDisplayName: payload.reportedByDisplayName?.trim().slice(0, 120) || 'Commuter',
        status: 'pending',
        corroborationCount: 1,
        corroborationsCount: 1,
        confidenceScore,
        reporterTrustScore,
        createdAt: now,
        updatedAt: now,
        lastReportedAt: now,
    };
    const spotRef = db.collection('black_spots').doc(spotId);
    await spotRef.set(docData, { merge: false });
    // Record initial report in reports subcollection for full audit trail
    const initialReportId = `rep_${spotId}`;
    const initialReportData = {
        id: initialReportId,
        reportId: initialReportId,
        spotId,
        reportedByUid: userId,
        reportedByDisplayName: docData.reportedByDisplayName,
        title: docData.title,
        description: docData.description,
        hazardType: docData.hazardType,
        severity: docData.severity,
        location: { lat, lng },
        latitude: lat,
        longitude: lng,
        photoUrl: payload.photoUrl || null,
        reporterTrustScore,
        createdAt: now,
    };
    if (typeof spotRef.collection === 'function') {
        await spotRef.collection('reports').doc(initialReportId).set(initialReportData);
    }
    await db.collection('audit_logs').doc(`audit_${spotId}`).set({
        id: `audit_${spotId}`,
        action: 'REPORT_BLACK_SPOT',
        actorUid: userId,
        actorName: docData.reportedByDisplayName,
        actorRole: 'passenger',
        target: `Black Spot ${spotId} (${docData.title})`,
        timestamp: now,
        details: { spotId, hazardType: docData.hazardType, severity: docData.severity, location: { lat, lng } },
    });
    return { success: true, spotId, title: docData.title, status: 'pending', createdAt: now, corroborated: false };
}
exports.reportBlackSpot = (0, https_1.onCall)({ enforceAppCheck: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Caller must be authenticated to report a road hazard.');
    }
    const db = (0, firestore_1.getFirestore)();
    const userId = request.auth.uid;
    const isAnonymous = (0, rateLimit_1.isAnonymousAuth)(request.auth);
    const secondaryKey = (0, rateLimit_1.extractClientIdentifier)(request);
    const payload = { ...request.data, reportedByUid: userId };
    try {
        return await processReportBlackSpotLogic(db, payload, userId, { isAnonymous, secondaryKey });
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error('[reportBlackSpot] Execution failed:', err);
        throw new https_1.HttpsError('internal', 'Black spot submission failed.');
    }
});
//# sourceMappingURL=reportBlackSpot.js.map