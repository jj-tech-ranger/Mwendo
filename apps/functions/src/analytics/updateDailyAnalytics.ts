import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { APP_CHECK_ENFORCED } from '../lib/env';

export async function processUpdateDailyAnalyticsLogic(
  db: Firestore,
  dateStr: string
): Promise<any> {
  const tripsSnap = await db.collection('trips').get();
  const violSnap = await db.collection('violations').get();
  const alertsSnap = await db.collection('safety_alerts').get();
  const vehiclesSnap = await db.collection('vehicles').get();

  const totalTrips = tripsSnap.size;
  const totalViolations = violSnap.size;
  const activeAlerts = alertsSnap.docs.filter((d: any) => d.data().status === 'active').length;

  let lowRiskCount = 0;
  let mediumRiskCount = 0;
  let highRiskCount = 0;
  let criticalRiskCount = 0;

  vehiclesSnap.docs.forEach((d: any) => {
    const tier = d.data().riskTier;
    if (tier === 'critical') criticalRiskCount++;
    else if (tier === 'high') highRiskCount++;
    else if (tier === 'medium') mediumRiskCount++;
    else lowRiskCount++;
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
    updatedAt: new Date().toISOString(),
  };

  await db.collection('analytics').doc(docId).set(payload, { merge: true });

  return payload;
}

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
    const db = getFirestore();
    return await processUpdateDailyAnalyticsLogic(db, dateStr);
  }
);
