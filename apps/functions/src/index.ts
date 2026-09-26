import { initializeApp, getApps } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

// Enforce regional architecture for all Gen 2 Cloud Functions
setGlobalOptions({ region: 'europe-west1' });

if (!getApps().length) {
  initializeApp();
}

// SEC-001: Enforce Firestore default database constraint required by storage.rules cross-service lookups
const deployedDbId = process.env.FIRESTORE_DATABASE_ID || '(default)';
if (deployedDbId !== '(default)') {
  throw new Error(`[SEC-001 Fatal] Firestore database must be '(default)' to maintain storage.rules cross-service compatibility, but got '${deployedDbId}'.`);
}

export { suspendUser, reactivateUser } from './admin/suspendUser';
export { assignUserRole } from './admin/assignUserRole';
export { healthCheck } from './admin/healthCheck';
export { verifyTotpChallenge } from './auth/verifyTotpChallenge';
export { deleteOwnAccount } from './auth/deleteOwnAccount';
export { computeVehicleRisk } from './risk/computeVehicleRisk';
export { rebuildSaccoAnalytics } from './analytics/rebuildSaccoAnalytics';
export { updateDailyAnalytics, dailyAnalyticsScheduled } from './analytics/updateDailyAnalytics';
export { syncPublicPins } from './pins/syncPublicPins';
export { sendSOS } from './alerts/sendSOS';
export { registerDeviceToken, unregisterDeviceToken } from './alerts/registerDeviceToken';
export { reportBlackSpot } from './reports/reportBlackSpot';
export { createInspection } from './inspections/createInspection';
export { dailyPurge } from './scheduled/dailyPurge';
export { weeklyReport } from './scheduled/weeklyReport';
export { monthlyArchival } from './scheduled/monthlyArchival';
export { generateTripSummary } from './risk/generateTripSummary';
export { decayStaleBlackSpots, decayBlackSpotsScheduled } from './reports/decayStaleBlackSpots';
export { updateReporterTrust } from './trust/updateReporterTrust';
export { processTripCompletion } from './trips/processTripCompletion';
