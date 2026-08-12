"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rebuildSaccoAnalytics = void 0;
exports.processRebuildSaccoAnalyticsLogic = processRebuildSaccoAnalyticsLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const engine_1 = require("../../../../src/lib/engine");
async function processRebuildSaccoAnalyticsLogic(db, saccoId) {
    const vehiclesSnap = await db.collection('vehicles').where('saccoId', '==', saccoId).get();
    const scores = vehiclesSnap.docs.map((d) => d.data().riskScore ?? 85);
    const complaintsSnap = await db
        .collection('complaints')
        .where('saccoId', '==', saccoId)
        .where('status', '==', 'open')
        .get();
    const unresolvedCount = complaintsSnap.size;
    const saccoSafetyScore = (0, engine_1.calculateSaccoSafetyScore)(scores, unresolvedCount);
    // Update SACCO doc via Admin SDK
    const saccoRef = db.collection('saccos').doc(saccoId);
    const saccoSnap = await saccoRef.get();
    if (saccoSnap.exists) {
        await saccoRef.set({
            safetyScore: saccoSafetyScore,
            fleetCount: vehiclesSnap.size,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    }
    const docId = `sacco_${saccoId}`;
    const payload = {
        id: docId,
        saccoId,
        type: 'sacco',
        safetyScore: saccoSafetyScore,
        fleetCount: vehiclesSnap.size,
        unresolvedComplaints: unresolvedCount,
        updatedAt: new Date().toISOString(),
    };
    // Write to analytics collection via Admin SDK
    await db.collection('analytics').doc(docId).set(payload, { merge: true });
    return payload;
}
exports.rebuildSaccoAnalytics = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const saccoId = request.data?.saccoId;
    if (!saccoId || typeof saccoId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'The saccoId string parameter must be provided.');
    }
    const db = (0, firestore_1.getFirestore)();
    return await processRebuildSaccoAnalyticsLogic(db, saccoId);
});
//# sourceMappingURL=rebuildSaccoAnalytics.js.map