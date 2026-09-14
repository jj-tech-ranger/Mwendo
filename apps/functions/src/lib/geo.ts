/**
 * Geo-distance and spatial boundary utility for Cloud Functions.
 * Uses the spherical Haversine formula for distance calculation in meters.
 */

/**
 * Earth radius in meters (WGS 84 mean spherical radius).
 */
export const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Calculates great-circle distance between two (latitude, longitude) coordinates
 * in meters using the Haversine formula.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;

  // Protect against floating point precision exceeding 1.0
  const c = 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Computes an axis-aligned bounding box [minLat, maxLat, minLng, maxLng]
 * around a center point for a given radius in meters.
 *
 * Approximations:
 * - 1 degree of latitude is approximately 111,320 meters everywhere on Earth.
 * - 1 degree of longitude is approximately 111,320 * cos(latitude) meters.
 */
export function getBoundingBox(
  lat: number,
  lon: number,
  radiusMeters: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const METERS_PER_DEGREE_LAT = 111_320;
  const latDelta = radiusMeters / METERS_PER_DEGREE_LAT;

  const latRad = (lat * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  // Guard against division by zero at extreme polar latitudes (> 89.9 deg)
  const lngDelta =
    Math.abs(cosLat) > 0.0001
      ? radiusMeters / (METERS_PER_DEGREE_LAT * Math.abs(cosLat))
      : radiusMeters / METERS_PER_DEGREE_LAT;

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lon - lngDelta,
    maxLng: lon + lngDelta,
  };
}
