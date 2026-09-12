"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportBlackSpot = void 0;
exports.processReportBlackSpotLogic = processReportBlackSpotLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const rateLimit_1 = require("../lib/rateLimit");
const engine_1 = require("../lib/engine");
function validKenyaLocation(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -5.5 && lat <= 6.0 && lng >= 33.0 && lng <= 43.5;
}
function boundedText(value, max) {
    return typeof value === 'string' && value.length <= max;
}
async function processReportBlackSpotLogic(db, payload, userId) {
    if (!userId || userId === 'anonymous') {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to report a road hazard.');
    }
    const lat = payload.location?.lat ?? payload.latitude;
    const lng = payload.location?.lng ?? payload.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !validKenyaLocation(lat, lng)) {
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
    await (0, rateLimit_1.enforceRateLimit)(db, userId, 'black_spot');
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
    // Use ConfidenceScorer.calculateHazardConfidence with corroborationCount = 1 (pending deduplication feature)
    const confidenceScore = engine_1.ConfidenceScorer.calculateHazardConfidence(1, reporterTrustScore, hasEvidencePhoto);
    const spotId = payload.id && /^bs_[A-Za-z0-9_-]{1,100}$/.test(payload.id)
        ? payload.id
        : `bs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
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
        createdAt: now,
        updatedAt: now,
    };
    await db.collection('black_spots').doc(spotId).set(docData, { merge: false });
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
    return { success: true, spotId, title: docData.title, status: 'pending', createdAt: now };
}
exports.reportBlackSpot = (0, https_1.onCall)({ enforceAppCheck: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Caller must be authenticated to report a road hazard.');
    }
    const db = (0, firestore_1.getFirestore)();
    const userId = request.auth.uid;
    const payload = { ...request.data, reportedByUid: userId };
    try {
        return await processReportBlackSpotLogic(db, payload, userId);
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error('[reportBlackSpot] Execution failed:', err);
        throw new https_1.HttpsError('internal', 'Black spot submission failed.');
    }
});
//# sourceMappingURL=reportBlackSpot.js.map