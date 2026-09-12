"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monthlyArchival = void 0;
exports.runMonthlyArchivalLogic = runMonthlyArchivalLogic;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const PAGE_SIZE = 500;
const YEAR_MS = 365 * 86400000;
async function runMonthlyArchivalLogic(db) {
    const tripsCutoff = new Date(Date.now() - YEAR_MS).toISOString();
    const violationsCutoff = new Date(Date.now() - 2 * YEAR_MS).toISOString();
    let archivedTripsCount = 0;
    let archivedViolationsCount = 0;
    while (true) {
        const snap = await db.collection('trips').where('startTime', '<', tripsCutoff).where('status', '==', 'completed').where('isArchived', '!=', true).limit(PAGE_SIZE).get();
        if (snap.empty)
            break;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.update(doc.ref, { isArchived: true }));
        await batch.commit();
        archivedTripsCount += snap.size;
        if (snap.size < PAGE_SIZE)
            break;
    }
    while (true) {
        const snap = await db.collection('violations').where('timestamp', '<', violationsCutoff).where('isArchived', '!=', true).limit(PAGE_SIZE).get();
        if (snap.empty)
            break;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.update(doc.ref, { isArchived: true }));
        await batch.commit();
        archivedViolationsCount += snap.size;
        if (snap.size < PAGE_SIZE)
            break;
    }
    console.log(`[MonthlyArchival] Archived ${archivedTripsCount} trips and ${archivedViolationsCount} violations.`);
    return { archivedTripsCount, archivedViolationsCount };
}
exports.monthlyArchival = (0, scheduler_1.onSchedule)('1 of month 03:00', async () => {
    await runMonthlyArchivalLogic((0, firestore_1.getFirestore)());
});
//# sourceMappingURL=monthlyArchival.js.map