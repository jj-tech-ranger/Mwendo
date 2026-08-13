"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDailyAnalytics = void 0;
exports.processUpdateDailyAnalyticsLogic = processUpdateDailyAnalyticsLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
async function processUpdateDailyAnalyticsLogic(db, dateStr) {
    const tripsSnap = await db.collection('trips').get();
    const violSnap = await db.collection('violations').get();
    const alertsSnap = await db.collection('safety_alerts').get();
    const vehiclesSnap = await db.collection('vehicles').get();
    const totalTrips = tripsSnap.size;
    const totalViolations = violSnap.size;
    const activeAlerts = alertsSnap.docs.filter((d) => d.data().status === 'active').length;
    let lowRiskCount = 0;
    let mediumRiskCount = 0;
    let highRiskCount = 0;
    let criticalRiskCount = 0;
    vehiclesSnap.docs.forEach((d) => {
        const tier = d.data().riskTier;
        if (tier === 'critical')
            criticalRiskCount++;
        else if (tier === 'high')
            highRiskCount++;
        else if (tier === 'medium')
            mediumRiskCount++;
        else
            lowRiskCount++;
    });
    const docId = `daily_${dateStr}`;
    const payload = {
        id: docId,
        date: dateStr,
        type: 'daily',
        totalTrips,
        totalViolations,
        activeAlerts,
        riskDistribution: {
            low: lowRiskCount,
            medium: mediumRiskCount,
            high: highRiskCount,
            critical: criticalRiskCount,
        },
        updatedAt: new Date().toISOString(),
    };
    await db.collection('analytics').doc(docId).set(payload, { merge: true });
    return payload;
}
exports.updateDailyAnalytics = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const dateStr = request.data?.dateStr || new Date().toISOString().split('T')[0];
    const db = (0, firestore_1.getFirestore)();
    return await processUpdateDailyAnalyticsLogic(db, dateStr);
});
//# sourceMappingURL=updateDailyAnalytics.js.map