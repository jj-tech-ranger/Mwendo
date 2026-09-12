"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyPurge = void 0;
exports.runDailyPurgeLogic = runDailyPurgeLogic;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const RETENTION_MS = 30 * 86400000;
const PAGE_SIZE = 500;
async function runDailyPurgeLogic(db) {
    const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
    let purgedEvents = 0;
    let purgedDlq = 0;
    for (const collectionName of ['processedEvents', 'dlq_notifications']) {
        while (true) {
            const field = collectionName === 'processedEvents' ? 'processedAt' : 'timestamp';
            const snap = await db.collection(collectionName).where(field, '<', cutoff).limit(PAGE_SIZE).get();
            if (snap.empty)
                break;
            const batch = db.batch();
            snap.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
            if (collectionName === 'processedEvents')
                purgedEvents += snap.size;
            else
                purgedDlq += snap.size;
            if (snap.size < PAGE_SIZE)
                break;
        }
    }
    console.log(`[DailyPurge] Purged ${purgedEvents} processedEvents and ${purgedDlq} DLQ items.`);
    return { purgedEvents, purgedDlq };
}
exports.dailyPurge = (0, scheduler_1.onSchedule)('every day 02:00', async () => {
    await runDailyPurgeLogic((0, firestore_1.getFirestore)());
});
//# sourceMappingURL=dailyPurge.js.map