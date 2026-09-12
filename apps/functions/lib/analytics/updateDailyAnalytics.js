"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyAnalyticsScheduled = exports.updateDailyAnalytics = void 0;
exports.processUpdateDailyAnalyticsLogic = processUpdateDailyAnalyticsLogic;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const env_1 = require("../lib/env");
function assertValidAnalyticsDate(dateStr) {
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new https_1.HttpsError('invalid-argument', 'dateStr must use YYYY-MM-DD format.');
    }
    const parsed = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateStr) {
        throw new https_1.HttpsError('invalid-argument', 'dateStr must be a valid calendar date.');
    }
}
/**
 * ANALYTICS-001: Date-scoped Daily Analytics Engine
 * Aggregates daily platform metrics bounded strictly by the target date's range,
 * avoiding unbounded full-collection scans while maintaining current vehicle risk snapshots.
 */
async function processUpdateDailyAnalyticsLogic(db, dateStr) {
    assertValidAnalyticsDate(dateStr);
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
    const startIso = startOfDay.toISOString();
    const endIso = endOfDay.toISOString();
    const [tripsSnap, violSnap, alertsSnap, vehiclesSnap, usersSnap, saccosSnap, auditLogsSnap, complaintsSnap,] = await Promise.all([
        db
            .collection('trips')
            .where('startTime', '>=', startIso)
            .where('startTime', '<=', endIso)
            .get(),
        db
            .collection('violations')
            .where('timestamp', '>=', startIso)
            .where('timestamp', '<=', endIso)
            .get(),
        db
            .collection('safety_alerts')
            .where('timestamp', '>=', startIso)
            .where('timestamp', '<=', endIso)
            .get(),
        db.collection('vehicles').get(),
        db.collection('users').get(),
        db.collection('saccos').get(),
        db.collection('audit_logs').get(),
        db.collection('complaints').get(),
    ]);
    const totalTrips = tripsSnap.size;
    const totalViolations = violSnap.size;
    const activeAlerts = alertsSnap.docs.filter((d) => d.data().status === 'active').length;
    const userCount = usersSnap.size;
    const saccoCount = saccosSnap.size;
    const auditLogCount = auditLogsSnap.size;
    const complaintCount = complaintsSnap.docs.filter((d) => {
        const status = d.data().status;
        return !status || status === 'open' || status === 'investigating';
    }).length;
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
        docId,
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
        userCount,
        saccoCount,
        auditLogCount,
        complaintCount,
        updatedAt: new Date().toISOString(),
    };
    // Deterministic date-scoped document ID makes retries/replays converge on one record.
    await db.collection('analytics').doc(docId).set(payload, { merge: true });
    return payload;
}
/**
 * On-demand callable variant for administrators and authorities.
 */
exports.updateDailyAnalytics = (0, https_1.onCall)({ enforceAppCheck: env_1.APP_CHECK_ENFORCED }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const role = (request.auth.token?.activeRole || request.auth.token?.role || 'passenger');
    if (role !== 'admin' && role !== 'authority') {
        throw new https_1.HttpsError('permission-denied', 'Only administrative or authority users may compute platform-wide daily analytics.');
    }
    const dateStr = request.data?.dateStr || new Date().toISOString().split('T')[0];
    assertValidAnalyticsDate(dateStr);
    const db = (0, firestore_1.getFirestore)();
    return await processUpdateDailyAnalyticsLogic(db, dateStr);
});
/**
 * Scheduled cron job running once daily at 01:00 UTC to automatically
 * aggregate yesterday's finalized metrics and today's rolling metrics.
 */
exports.dailyAnalyticsScheduled = (0, scheduler_1.onSchedule)('every day 01:00', async () => {
    const db = (0, firestore_1.getFirestore)();
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    await processUpdateDailyAnalyticsLogic(db, yesterdayStr);
    await processUpdateDailyAnalyticsLogic(db, todayStr);
    console.log(`[dailyAnalyticsScheduled] Computed daily analytics for ${yesterdayStr} and ${todayStr}`);
});
//# sourceMappingURL=updateDailyAnalytics.js.map