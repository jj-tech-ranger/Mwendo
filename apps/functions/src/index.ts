import { initializeApp, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp();
}

export { suspendUser, reactivateUser } from './admin/suspendUser';
export { computeVehicleRisk } from './risk/computeVehicleRisk';
export { rebuildSaccoAnalytics } from './analytics/rebuildSaccoAnalytics';
export { updateDailyAnalytics } from './analytics/updateDailyAnalytics';
export { syncPublicPins } from './pins/syncPublicPins';
