"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rebuildSaccoAnalytics = void 0;
exports.processRebuildSaccoAnalyticsLogic = processRebuildSaccoAnalyticsLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const engine_1 = require("../lib/engine");
const env_1 = require("../lib/env");
async function processRebuildSaccoAnalyticsLogic(db, saccoId) {
    const vehiclesSnap = await db.collection('vehicles').where('saccoId', '==', saccoId).get();
    const scores = vehiclesSnap.docs.map((d) => {
        const score = d.data().riskScore;
        return typeof score === 'number' ? score : 85;
    });
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
        docId,
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
exports.rebuildSaccoAnalytics = (0, https_1.onCall)({ enforceAppCheck: env_1.APP_CHECK_ENFORCED }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const saccoId = request.data?.saccoId;
    if (!saccoId || typeof saccoId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'The saccoId string parameter must be provided.');
    }
    // Role-based multi-tenancy access check
    const role = (request.auth.token?.activeRole || request.auth.token?.role || 'passenger');
    const userSaccoId = request.auth.token?.saccoId;
    const isPrivileged = role === 'admin' || role === 'authority';
    const isMatchingSaccoManager = role === 'sacco_manager' && userSaccoId === saccoId;
    if (!isPrivileged && !isMatchingSaccoManager) {
        throw new https_1.HttpsError('permission-denied', 'Insufficient permissions to view or rebuild analytics for this SACCO.');
    }
    const db = (0, firestore_1.getFirestore)();
    return await processRebuildSaccoAnalyticsLogic(db, saccoId);
});
//# sourceMappingURL=rebuildSaccoAnalytics.js.map