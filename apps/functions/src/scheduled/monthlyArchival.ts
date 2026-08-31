import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const PAGE_SIZE = 500;
const YEAR_MS = 365 * 86400000;

export async function runMonthlyArchivalLogic(db: Firestore): Promise<{ archivedTripsCount: number; archivedViolationsCount: number }> {
  const tripsCutoff = new Date(Date.now() - YEAR_MS).toISOString();
  const violationsCutoff = new Date(Date.now() - 2 * YEAR_MS).toISOString();
  let archivedTripsCount = 0;
  let archivedViolationsCount = 0;

  while (true) {
    const snap = await db.collection('trips').where('startTime', '<', tripsCutoff).where('status', '==', 'completed').where('isArchived', '!=', true).limit(PAGE_SIZE).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.update(doc.ref, { isArchived: true }));
    await batch.commit();
    archivedTripsCount += snap.size;
    if (snap.size < PAGE_SIZE) break;
  }

  while (true) {
    const snap = await db.collection('violations').where('timestamp', '<', violationsCutoff).where('isArchived', '!=', true).limit(PAGE_SIZE).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.update(doc.ref, { isArchived: true }));
    await batch.commit();
    archivedViolationsCount += snap.size;
    if (snap.size < PAGE_SIZE) break;
  }

  console.log(`[MonthlyArchival] Archived ${archivedTripsCount} trips and ${archivedViolationsCount} violations.`);
  return { archivedTripsCount, archivedViolationsCount };
}

export const monthlyArchival = onSchedule('1 of month 03:00', async () => {
  await runMonthlyArchivalLogic(getFirestore());
});
