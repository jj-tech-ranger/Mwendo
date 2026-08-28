import { initializeApp, getApps } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

// Enforce regional architecture for all Gen 2 Cloud Functions
setGlobalOptions({ region: 'europe-west1' });

if (!getApps().length) {
  initializeApp();
}

export { suspendUser, reactivateUser } from './admin/suspendUser';
export { healthCheck } from './admin/healthCheck';
export { verifyTotpChallenge } from './auth/verifyTotpChallenge';
export { computeVehicleRisk } from './risk/computeVehicleRisk';
export { rebuildSaccoAnalytics } from './analytics/rebuildSaccoAnalytics';
export { updateDailyAnalytics, dailyAnalyticsScheduled } from './analytics/updateDailyAnalytics';
export { syncPublicPins } from './pins/syncPublicPins';
export { sendSOS } from './alerts/sendSOS';
export { reportBlackSpot } from './reports/reportBlackSpot';
export { createInspection } from './inspections/createInspection';
export { dailyPurge } from './scheduled/dailyPurge';
export { weeklyReport } from './scheduled/weeklyReport';
export { monthlyArchival } from './scheduled/monthlyArchival';
