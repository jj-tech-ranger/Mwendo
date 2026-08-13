import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * CF-007: Daily Purge Job
 * Runs every night at 02:00 UTC to purge stale ephemeral processed events (>30 days old)
 * and resolved notifications beyond their retention limit.
 */
export async function runDailyPurgeLogic(db: Firestore): Promise<{ purgedEvents: number; purgedDlq: number }> {
  const thirtyDaysAgoMs = Date.now() - 30 * 86400000;
  const thirtyDaysAgoIso = new Date(thirtyDaysAgoMs).toISOString();

  let purgedEvents = 0;
  let purgedDlq = 0;

  // 1. Purge stale processedEvents ledger records (>30 days)
  const staleEventsSnap = await db
    .collection('processedEvents')
    .where('processedAt', '<', thirtyDaysAgoIso)
    .limit(500)
    .get();

  if (!staleEventsSnap.empty) {
    const batch = db.batch();
    staleEventsSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
      purgedEvents++;
    });
    await batch.commit();
  }

  // 2. Purge stale resolved DLQ entries
  const staleDlqSnap = await db
    .collection('dlq_notifications')
    .where('timestamp', '<', thirtyDaysAgoIso)
    .limit(500)
    .get();

  if (!staleDlqSnap.empty) {
    const batch = db.batch();
    staleDlqSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
      purgedDlq++;
    });
    await batch.commit();
  }

  console.log(`[DailyPurge] Purged ${purgedEvents} processedEvents and ${purgedDlq} DLQ items.`);
  return { purgedEvents, purgedDlq };
}

export const dailyPurge = onSchedule('every day 02:00', async () => {
  const db = getFirestore();
  await runDailyPurgeLogic(db);
});
