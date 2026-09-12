/**
 * Canonical geographic bounds and vehicle telemetry limits for Mwendo Salama Kenya.
 *
 * NOTE FOR FIRESTORE RULES:
 * Firestore Security Rules (firestore.rules) cannot import TypeScript/JavaScript constants
 * at runtime or build-time in standard Firebase deployments.
 * When modifying bounds here, update the corresponding helper functions `isWithinKenyaBounds`
 * and `isPlausibleSpeed` in `/firestore.rules` to keep them in sync.
 */

export const KENYA_BOUNDS = {
  MIN_LAT: -5.5,
  MAX_LAT: 6.0,
  MIN_LNG: 33.0,
  MAX_LNG: 43.5,
} as const;

export const SPEED_LIMITS = {
  MIN_KM_H: 0,
  MAX_KM_H: 180,
} as const;

/**
 * Validates whether the provided latitude and longitude coordinates fall within the Kenya geographic bounding box.
 */
export function isWithinKenya(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= KENYA_BOUNDS.MIN_LAT &&
    lat <= KENYA_BOUNDS.MAX_LAT &&
    lng >= KENYA_BOUNDS.MIN_LNG &&
    lng <= KENYA_BOUNDS.MAX_LNG
  );
}

/**
 * Validates whether a vehicle speed (km/h) is physically plausible.
 */
export function isPlausibleSpeed(speed: number): boolean {
  return (
    Number.isFinite(speed) &&
    speed >= SPEED_LIMITS.MIN_KM_H &&
    speed <= SPEED_LIMITS.MAX_KM_H
  );
}
