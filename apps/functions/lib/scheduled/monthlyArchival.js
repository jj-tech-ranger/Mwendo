"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monthlyArchival = void 0;
exports.runMonthlyArchivalLogic = runMonthlyArchivalLogic;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
/**
 * CF-007: Monthly Archival Job
 * Runs on the 1st of every month at 03:00 UTC to archive/flag old trips and telemetry (>12 months)
 * and violations beyond 2 years.
 */
async function runMonthlyArchivalLogic(db) {
    const twelveMonthsAgoMs = Date.now() - 365 * 86400000;
    const twelveMonthsAgoIso = new Date(twelveMonthsAgoMs).toISOString();
    const twoYearsAgoMs = Date.now() - 730 * 86400000;
    const twoYearsAgoIso = new Date(twoYearsAgoMs).toISOString();
    let archivedTripsCount = 0;
    let archivedViolationsCount = 0;
    // Mark old trips as archived
    const oldTripsSnap = await db
        .collection('trips')
        .where('startTime', '<', twelveMonthsAgoIso)
        .where('status', '==', 'completed')
        .limit(500)
        .get();
    if (!oldTripsSnap.empty) {
        const batch = db.batch();
        oldTripsSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { isArchived: true, archivedAt: new Date().toISOString() });
            archivedTripsCount++;
        });
        await batch.commit();
    }
    // Mark old violations as archived
    const oldViolationsSnap = await db
        .collection('violations')
        .where('timestamp', '<', twoYearsAgoIso)
        .limit(500)
        .get();
    if (!oldViolationsSnap.empty) {
        const batch = db.batch();
        oldViolationsSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { isArchived: true, archivedAt: new Date().toISOString() });
            archivedViolationsCount++;
        });
        await batch.commit();
    }
    console.log(`[MonthlyArchival] Flagged ${archivedTripsCount} trips and ${archivedViolationsCount} violations as archived.`);
    return { archivedTripsCount, archivedViolationsCount };
}
exports.monthlyArchival = (0, scheduler_1.onSchedule)('1 of month 03:00', async () => {
    const db = (0, firestore_1.getFirestore)();
    await runMonthlyArchivalLogic(db);
});
//# sourceMappingURL=monthlyArchival.js.map