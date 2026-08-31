import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const RETENTION_MS = 30 * 86400000;
const PAGE_SIZE = 500;

export async function runDailyPurgeLogic(db: Firestore): Promise<{ purgedEvents: number; purgedDlq: number }> {
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  let purgedEvents = 0;
  let purgedDlq = 0;

  for (const collectionName of ['processedEvents', 'dlq_notifications'] as const) {
    while (true) {
      const field = collectionName === 'processedEvents' ? 'processedAt' : 'timestamp';
      const snap = await db.collection(collectionName).where(field, '<', cutoff).limit(PAGE_SIZE).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      if (collectionName === 'processedEvents') purgedEvents += snap.size;
      else purgedDlq += snap.size;
      if (snap.size < PAGE_SIZE) break;
    }
  }

  console.log(`[DailyPurge] Purged ${purgedEvents} processedEvents and ${purgedDlq} DLQ items.`);
  return { purgedEvents, purgedDlq };
}

export const dailyPurge = onSchedule('every day 02:00', async () => {
  await runDailyPurgeLogic(getFirestore());
});
