"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportBlackSpot = void 0;
exports.processReportBlackSpotLogic = processReportBlackSpotLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const rateLimit_1 = require("../lib/rateLimit");
/**
 * Core business logic for submitting a black-spot report with rate limiting
 */
async function processReportBlackSpotLogic(db, payload, userId) {
    if (!userId || userId === 'anonymous') {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to report a road hazard.');
    }
    // 1. SEC-005: Enforce rate limit (Max 10 hazard reports per 24h)
    if (typeof db.runTransaction === 'function') {
        await (0, rateLimit_1.enforceRateLimit)(db, userId, 'black_spot');
    }
    const spotId = payload.id || `bs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const lat = payload.location?.lat ?? payload.latitude ?? -1.286389;
    const lng = payload.location?.lng ?? payload.longitude ?? 36.817223;
    const docData = {
        id: spotId,
        spotId,
        title: payload.title || 'Road Hazard',
        name: payload.title || payload.locationName || 'Road Hazard',
        description: payload.description || '',
        hazardDescription: payload.description || payload.title || 'Road Hazard',
        hazardType: payload.hazardType || 'accident_prone',
        severity: payload.severity || 'high',
        locationName: payload.locationName || '',
        routeName: payload.routeName || payload.locationName || 'Kenyan Highway',
        county: payload.county || 'Nairobi',
        latitude: lat,
        longitude: lng,
        location: { lat, lng },
        photoUrl: payload.photoUrl || undefined,
        reportedByUid: userId,
        reportedByUserId: userId,
        reportedByDisplayName: payload.reportedByDisplayName || 'Commuter',
        status: 'pending',
        corroborationCount: 1,
        corroborationsCount: 1,
        confidenceScore: 0.8,
        createdAt: now,
        updatedAt: now,
    };
    await db.collection('black_spots').doc(spotId).set(docData, { merge: true });
    // Record audit log
    await db.collection('audit_logs').doc(`audit_${spotId}`).set({
        id: `audit_${spotId}`,
        action: 'REPORT_BLACK_SPOT',
        actorName: payload.reportedByDisplayName || 'Commuter',
        actorRole: 'passenger',
        target: `Black Spot ${spotId} (${docData.title})`,
        timestamp: now,
        details: {
            spotId,
            hazardType: docData.hazardType,
            severity: docData.severity,
            location: { lat, lng },
        },
    });
    return {
        success: true,
        spotId,
        title: docData.title,
        status: 'pending',
        createdAt: now,
    };
}
/**
 * Cloud Function: reportBlackSpot
 */
exports.reportBlackSpot = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Caller must be authenticated to report a road hazard.');
    }
    const db = (0, firestore_1.getFirestore)();
    const userId = request.auth.uid;
    const payload = {
        ...request.data,
        reportedByUid: userId,
    };
    try {
        return await processReportBlackSpotLogic(db, payload, userId);
    }
    catch (err) {
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        console.error('[reportBlackSpot] Execution failed:', err);
        throw new https_1.HttpsError('internal', err?.message || 'Black spot submission failed.');
    }
});
//# sourceMappingURL=reportBlackSpot.js.map