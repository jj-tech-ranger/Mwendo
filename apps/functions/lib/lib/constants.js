"use strict";
/**
 * Canonical geographic bounds and vehicle telemetry limits for Mwendo Salama Kenya.
 *
 * NOTE FOR FIRESTORE RULES:
 * Firestore Security Rules (firestore.rules) cannot import TypeScript/JavaScript constants
 * at runtime or build-time in standard Firebase deployments.
 * When modifying bounds here, update the corresponding helper functions `isWithinKenyaBounds`
 * and `isPlausibleSpeed` in `/firestore.rules` to keep them in sync.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPEED_LIMITS = exports.KENYA_BOUNDS = void 0;
exports.isWithinKenya = isWithinKenya;
exports.isPlausibleSpeed = isPlausibleSpeed;
exports.KENYA_BOUNDS = {
    MIN_LAT: -5.5,
    MAX_LAT: 6.0,
    MIN_LNG: 33.0,
    MAX_LNG: 43.5,
};
exports.SPEED_LIMITS = {
    MIN_KM_H: 0,
    MAX_KM_H: 180,
};
/**
 * Validates whether the provided latitude and longitude coordinates fall within the Kenya geographic bounding box.
 */
function isWithinKenya(lat, lng) {
    return (Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= exports.KENYA_BOUNDS.MIN_LAT &&
        lat <= exports.KENYA_BOUNDS.MAX_LAT &&
        lng >= exports.KENYA_BOUNDS.MIN_LNG &&
        lng <= exports.KENYA_BOUNDS.MAX_LNG);
}
/**
 * Validates whether a vehicle speed (km/h) is physically plausible.
 */
function isPlausibleSpeed(speed) {
    return (Number.isFinite(speed) &&
        speed >= exports.SPEED_LIMITS.MIN_KM_H &&
        speed <= exports.SPEED_LIMITS.MAX_KM_H);
}
//# sourceMappingURL=constants.js.map