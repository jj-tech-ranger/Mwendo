"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPublicPins = void 0;
exports.processSyncPublicPinsLogic = processSyncPublicPinsLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
async function processSyncPublicPinsLogic(db) {
    const spotsSnap = await db
        .collection('black_spots')
        .where('verifiedByAuthority', '==', true)
        .get();
    let count = 0;
    const batch = db.batch();
    for (const spotDoc of spotsSnap.docs) {
        const data = spotDoc.data();
        // SEC-005: Only copy spots with verifiedByAuthority: true / status: 'published'.
        // MUST NEVER copy reportedByUid or PII.
        if (data.status === 'published' || data.verifiedByAuthority === true) {
            const pinRef = db.collection('public_pins').doc(spotDoc.id);
            batch.set(pinRef, {
                id: spotDoc.id,
                title: data.name || data.title || 'Hazardous Spot',
                routeName: data.routeName || '',
                latitude: data.latitude,
                longitude: data.longitude,
                severity: data.severity,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
            count++;
        }
    }
    if (count > 0) {
        await batch.commit();
    }
    return { syncedCount: count };
}
exports.syncPublicPins = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const db = (0, firestore_1.getFirestore)();
    return await processSyncPublicPinsLogic(db);
});
//# sourceMappingURL=syncPublicPins.js.map