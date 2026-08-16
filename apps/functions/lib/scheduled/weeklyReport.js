"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weeklyReport = void 0;
exports.runWeeklyReportLogic = runWeeklyReportLogic;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
/**
 * CF-007: Weekly Report Job
 * Runs every Monday at 04:00 UTC to generate aggregated weekly compliance summary documents.
 */
async function runWeeklyReportLogic(db) {
    const saccosSnap = await db.collection('saccos').get();
    const violationsSnap = await db.collection('violations').get();
    const weekStr = new Date().toISOString().split('T')[0];
    const reportId = `weekly_summary_${weekStr}`;
    const saccoViolationsMap = {};
    violationsSnap.docs.forEach((doc) => {
        const saccoId = doc.data().saccoId || 'unknown';
        saccoViolationsMap[saccoId] = (saccoViolationsMap[saccoId] || 0) + 1;
    });
    const payload = {
        id: reportId,
        type: 'weekly_compliance_summary',
        generatedAt: new Date().toISOString(),
        totalSaccos: saccosSnap.size,
        totalViolations: violationsSnap.size,
        saccoBreakdown: saccoViolationsMap,
    };
    await db.collection('analytics').doc(reportId).set(payload, { merge: true });
    console.log(`[WeeklyReport] Generated ${reportId} for ${saccosSnap.size} SACCOs.`);
    return { reportId, saccoCount: saccosSnap.size };
}
exports.weeklyReport = (0, scheduler_1.onSchedule)('every monday 04:00', async () => {
    const db = (0, firestore_1.getFirestore)();
    await runWeeklyReportLogic(db);
});
//# sourceMappingURL=weeklyReport.js.map