import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Firestore, QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { APP_CHECK_ENFORCED } from '../lib/env';

export interface DailyAnalyticsPayload {
  id: string;
  docId: string;
  date: string;
  type: 'daily';
  totalTrips: number;
  totalViolations: number;
  activeAlerts: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  updatedAt: string;
}

function assertValidAnalyticsDate(dateStr: unknown): asserts dateStr is string {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new HttpsError('invalid-argument', 'dateStr must use YYYY-MM-DD format.');
  }

  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateStr) {
    throw new HttpsError('invalid-argument', 'dateStr must be a valid calendar date.');
  }
}

/**
 * ANALYTICS-001: Date-scoped Daily Analytics Engine
 * Aggregates daily platform metrics bounded strictly by the target date's range,
 * avoiding unbounded full-collection scans while maintaining current vehicle risk snapshots.
 */
export async function processUpdateDailyAnalyticsLogic(
  db: Firestore,
  dateStr: string
): Promise<DailyAnalyticsPayload> {
  assertValidAnalyticsDate(dateStr);

  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
  const startIso = startOfDay.toISOString();
  const endIso = endOfDay.toISOString();

  const tripsSnap = await db
    .collection('trips')
    .where('startTime', '>=', startIso)
    .where('startTime', '<=', endIso)
    .get();

  const violSnap = await db
    .collection('violations')
    .where('timestamp', '>=', startIso)
    .where('timestamp', '<=', endIso)
    .get();

  const alertsSnap = await db
    .collection('safety_alerts')
    .where('timestamp', '>=', startIso)
    .where('timestamp', '<=', endIso)
    .get();

  const vehiclesSnap = await db.collection('vehicles').get();

  const totalTrips = tripsSnap.size;
  const totalViolations = violSnap.size;
  const activeAlerts = alertsSnap.docs.filter(
    (d: QueryDocumentSnapshot<DocumentData>) => d.data().status === 'active'
  ).length;

  let lowRiskCount = 0;
  let mediumRiskCount = 0;
  let highRiskCount = 0;
  let criticalRiskCount = 0;

  vehiclesSnap.docs.forEach((d: QueryDocumentSnapshot<DocumentData>) => {
    const tier = d.data().riskTier;
    if (tier === 'critical') criticalRiskCount++;
    else if (tier === 'high') highRiskCount++;
    else if (tier === 'medium') mediumRiskCount++;
    else lowRiskCount++;
  });

  const docId = `daily_${dateStr}`;
  const payload: DailyAnalyticsPayload = {
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
    updatedAt: new Date().toISOString(),
  };

  // Deterministic date-scoped document ID makes retries/replays converge on one record.
  await db.collection('analytics').doc(docId).set(payload, { merge: true });

  return payload;
}

/**
 * On-demand callable variant for administrators and authorities.
 */
export const updateDailyAnalytics = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const role = (request.auth.token?.activeRole || request.auth.token?.role || 'passenger') as string;
    if (role !== 'admin' && role !== 'authority') {
      throw new HttpsError(
        'permission-denied',
        'Only administrative or authority users may compute platform-wide daily analytics.'
      );
    }

    const dateStr = request.data?.dateStr || new Date().toISOString().split('T')[0];
    assertValidAnalyticsDate(dateStr);

    const db = getFirestore();
    return await processUpdateDailyAnalyticsLogic(db, dateStr);
  }
);

/**
 * Scheduled cron job running once daily at 01:00 UTC to automatically
 * aggregate yesterday's finalized metrics and today's rolling metrics.
 */
export const dailyAnalyticsScheduled = onSchedule('every day 01:00', async () => {
  const db = getFirestore();
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  await processUpdateDailyAnalyticsLogic(db, yesterdayStr);
  await processUpdateDailyAnalyticsLogic(db, todayStr);
  console.log(`[dailyAnalyticsScheduled] Computed daily analytics for ${yesterdayStr} and ${todayStr}`);
});
