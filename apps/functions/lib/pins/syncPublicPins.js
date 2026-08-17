"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPublicPins = void 0;
exports.processSyncPublicPinsLogic = processSyncPublicPinsLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const env_1 = require("../lib/env");
async function processSyncPublicPinsLogic(db) {
    const [spotsSnap, existingPinsSnap] = await Promise.all([
        db.collection('black_spots').get(),
        db.collection('public_pins').get(),
    ]);
    const validSpotMap = new Map();
    for (const spotDoc of spotsSnap.docs) {
        const data = spotDoc.data();
        if (data.status === 'published' || data.verifiedByAuthority === true) {
            validSpotMap.set(spotDoc.id, data);
        }
    }
    let syncedCount = 0;
    let deletedCount = 0;
    const batch = db.batch();
    // 1. Upsert all currently valid published black spots into public_pins
    for (const [spotId, data] of validSpotMap.entries()) {
        const pinRef = db.collection('public_pins').doc(spotId);
        batch.set(pinRef, {
            id: spotId,
            title: data.name || data.title || 'Hazardous Spot',
            routeName: data.routeName || '',
            latitude: data.latitude,
            longitude: data.longitude,
            severity: data.severity || 'high',
            updatedAt: new Date().toISOString(),
        }, { merge: true });
        syncedCount++;
    }
    // 2. CF-005: Clean up / delete any existing public pin that is no longer published or verified
    for (const pinDoc of existingPinsSnap.docs) {
        if (!validSpotMap.has(pinDoc.id)) {
            batch.delete(pinDoc.ref);
            deletedCount++;
        }
    }
    if (syncedCount > 0 || deletedCount > 0) {
        await batch.commit();
    }
    return { syncedCount, deletedCount };
}
exports.syncPublicPins = (0, https_1.onCall)({ enforceAppCheck: env_1.APP_CHECK_ENFORCED }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const role = (request.auth.token?.activeRole || request.auth.token?.role || 'passenger');
    if (role !== 'admin' && role !== 'authority') {
        throw new https_1.HttpsError('permission-denied', 'Only administrative or authority staff can synchronize public pins.');
    }
    const db = (0, firestore_1.getFirestore)();
    return await processSyncPublicPinsLogic(db);
});
//# sourceMappingURL=syncPublicPins.js.map