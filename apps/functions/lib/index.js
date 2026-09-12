"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReporterTrust = exports.decayBlackSpotsScheduled = exports.decayStaleBlackSpots = exports.generateTripSummary = exports.monthlyArchival = exports.weeklyReport = exports.dailyPurge = exports.createInspection = exports.reportBlackSpot = exports.sendSOS = exports.syncPublicPins = exports.dailyAnalyticsScheduled = exports.updateDailyAnalytics = exports.rebuildSaccoAnalytics = exports.computeVehicleRisk = exports.deleteOwnAccount = exports.verifyTotpChallenge = exports.healthCheck = exports.reactivateUser = exports.suspendUser = void 0;
const app_1 = require("firebase-admin/app");
const v2_1 = require("firebase-functions/v2");
// Enforce regional architecture for all Gen 2 Cloud Functions
(0, v2_1.setGlobalOptions)({ region: 'europe-west1' });
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
var suspendUser_1 = require("./admin/suspendUser");
Object.defineProperty(exports, "suspendUser", { enumerable: true, get: function () { return suspendUser_1.suspendUser; } });
Object.defineProperty(exports, "reactivateUser", { enumerable: true, get: function () { return suspendUser_1.reactivateUser; } });
var healthCheck_1 = require("./admin/healthCheck");
Object.defineProperty(exports, "healthCheck", { enumerable: true, get: function () { return healthCheck_1.healthCheck; } });
var verifyTotpChallenge_1 = require("./auth/verifyTotpChallenge");
Object.defineProperty(exports, "verifyTotpChallenge", { enumerable: true, get: function () { return verifyTotpChallenge_1.verifyTotpChallenge; } });
var deleteOwnAccount_1 = require("./auth/deleteOwnAccount");
Object.defineProperty(exports, "deleteOwnAccount", { enumerable: true, get: function () { return deleteOwnAccount_1.deleteOwnAccount; } });
var computeVehicleRisk_1 = require("./risk/computeVehicleRisk");
Object.defineProperty(exports, "computeVehicleRisk", { enumerable: true, get: function () { return computeVehicleRisk_1.computeVehicleRisk; } });
var rebuildSaccoAnalytics_1 = require("./analytics/rebuildSaccoAnalytics");
Object.defineProperty(exports, "rebuildSaccoAnalytics", { enumerable: true, get: function () { return rebuildSaccoAnalytics_1.rebuildSaccoAnalytics; } });
var updateDailyAnalytics_1 = require("./analytics/updateDailyAnalytics");
Object.defineProperty(exports, "updateDailyAnalytics", { enumerable: true, get: function () { return updateDailyAnalytics_1.updateDailyAnalytics; } });
Object.defineProperty(exports, "dailyAnalyticsScheduled", { enumerable: true, get: function () { return updateDailyAnalytics_1.dailyAnalyticsScheduled; } });
var syncPublicPins_1 = require("./pins/syncPublicPins");
Object.defineProperty(exports, "syncPublicPins", { enumerable: true, get: function () { return syncPublicPins_1.syncPublicPins; } });
var sendSOS_1 = require("./alerts/sendSOS");
Object.defineProperty(exports, "sendSOS", { enumerable: true, get: function () { return sendSOS_1.sendSOS; } });
var reportBlackSpot_1 = require("./reports/reportBlackSpot");
Object.defineProperty(exports, "reportBlackSpot", { enumerable: true, get: function () { return reportBlackSpot_1.reportBlackSpot; } });
var createInspection_1 = require("./inspections/createInspection");
Object.defineProperty(exports, "createInspection", { enumerable: true, get: function () { return createInspection_1.createInspection; } });
var dailyPurge_1 = require("./scheduled/dailyPurge");
Object.defineProperty(exports, "dailyPurge", { enumerable: true, get: function () { return dailyPurge_1.dailyPurge; } });
var weeklyReport_1 = require("./scheduled/weeklyReport");
Object.defineProperty(exports, "weeklyReport", { enumerable: true, get: function () { return weeklyReport_1.weeklyReport; } });
var monthlyArchival_1 = require("./scheduled/monthlyArchival");
Object.defineProperty(exports, "monthlyArchival", { enumerable: true, get: function () { return monthlyArchival_1.monthlyArchival; } });
var generateTripSummary_1 = require("./risk/generateTripSummary");
Object.defineProperty(exports, "generateTripSummary", { enumerable: true, get: function () { return generateTripSummary_1.generateTripSummary; } });
var decayStaleBlackSpots_1 = require("./reports/decayStaleBlackSpots");
Object.defineProperty(exports, "decayStaleBlackSpots", { enumerable: true, get: function () { return decayStaleBlackSpots_1.decayStaleBlackSpots; } });
Object.defineProperty(exports, "decayBlackSpotsScheduled", { enumerable: true, get: function () { return decayStaleBlackSpots_1.decayBlackSpotsScheduled; } });
var updateReporterTrust_1 = require("./trust/updateReporterTrust");
Object.defineProperty(exports, "updateReporterTrust", { enumerable: true, get: function () { return updateReporterTrust_1.updateReporterTrust; } });
//# sourceMappingURL=index.js.map