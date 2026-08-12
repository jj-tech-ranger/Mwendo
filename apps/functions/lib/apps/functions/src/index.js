"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPublicPins = exports.updateDailyAnalytics = exports.rebuildSaccoAnalytics = exports.computeVehicleRisk = exports.reactivateUser = exports.suspendUser = void 0;
const app_1 = require("firebase-admin/app");
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
var suspendUser_1 = require("./admin/suspendUser");
Object.defineProperty(exports, "suspendUser", { enumerable: true, get: function () { return suspendUser_1.suspendUser; } });
Object.defineProperty(exports, "reactivateUser", { enumerable: true, get: function () { return suspendUser_1.reactivateUser; } });
var computeVehicleRisk_1 = require("./risk/computeVehicleRisk");
Object.defineProperty(exports, "computeVehicleRisk", { enumerable: true, get: function () { return computeVehicleRisk_1.computeVehicleRisk; } });
var rebuildSaccoAnalytics_1 = require("./analytics/rebuildSaccoAnalytics");
Object.defineProperty(exports, "rebuildSaccoAnalytics", { enumerable: true, get: function () { return rebuildSaccoAnalytics_1.rebuildSaccoAnalytics; } });
var updateDailyAnalytics_1 = require("./analytics/updateDailyAnalytics");
Object.defineProperty(exports, "updateDailyAnalytics", { enumerable: true, get: function () { return updateDailyAnalytics_1.updateDailyAnalytics; } });
var syncPublicPins_1 = require("./pins/syncPublicPins");
Object.defineProperty(exports, "syncPublicPins", { enumerable: true, get: function () { return syncPublicPins_1.syncPublicPins; } });
//# sourceMappingURL=index.js.map