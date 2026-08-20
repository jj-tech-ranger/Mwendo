import { initializeApp, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp();
}

export { suspendUser, reactivateUser } from './admin/suspendUser';
export { verifyTotpChallenge } from './auth/verifyTotpChallenge';
export { computeVehicleRisk } from './risk/computeVehicleRisk';
export { rebuildSaccoAnalytics } from './analytics/rebuildSaccoAnalytics';
export { updateDailyAnalytics, dailyAnalyticsScheduled } from './analytics/updateDailyAnalytics';
export { syncPublicPins } from './pins/syncPublicPins';
export { sendSOS } from './alerts/sendSOS';
export { reportBlackSpot } from './reports/reportBlackSpot';
export { dailyPurge } from './scheduled/dailyPurge';
export { weeklyReport } from './scheduled/weeklyReport';
export { monthlyArchival } from './scheduled/monthlyArchival';
