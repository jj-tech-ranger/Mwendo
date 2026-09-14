import { describe, it, expect } from 'vitest';
import { calculateHaversineDistanceMeters, getBoundingBox } from '../lib/geo';

describe('Geo Utility — calculateHaversineDistanceMeters and getBoundingBox', () => {
  it('returns 0 for identical coordinates', () => {
    const dist = calculateHaversineDistanceMeters(-1.286389, 36.817223, -1.286389, 36.817223);
    expect(dist).toBe(0);
  });

  it('calculates accurate distance between two nearby Nairobi coordinates (~150m)', () => {
    // Center point (Nairobi CBD)
    const lat1 = -1.286389;
    const lon1 = 36.817223;

    // Shift latitude by ~0.001 degrees (~111 meters)
    const lat2 = -1.285389;
    const lon2 = 36.817223;

    const dist = calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(113);
  });

  it('calculates accurate distance between Nairobi and Mombasa (~440-450 km)', () => {
    const nairobi = { lat: -1.286389, lon: 36.817223 };
    const mombasa = { lat: -4.043477, lon: 39.668206 };

    const dist = calculateHaversineDistanceMeters(
      nairobi.lat,
      nairobi.lon,
      mombasa.lat,
      mombasa.lon
    );

    // Straight-line distance is ~441 km (440,000 - 445,000 meters)
    expect(dist).toBeGreaterThan(435_000);
    expect(dist).toBeLessThan(445_000);
  });

  it('computes a bounding box that encloses the specified radius', () => {
    const lat = -1.286389;
    const lon = 36.817223;
    const radiusMeters = 150;

    const bbox = getBoundingBox(lat, lon, radiusMeters);

    expect(bbox.minLat).toBeLessThan(lat);
    expect(bbox.maxLat).toBeGreaterThan(lat);
    expect(bbox.minLng).toBeLessThan(lon);
    expect(bbox.maxLng).toBeGreaterThan(lon);

    // Verify boundary points are at or slightly beyond radiusMeters
    const northDist = calculateHaversineDistanceMeters(lat, lon, bbox.maxLat, lon);
    const eastDist = calculateHaversineDistanceMeters(lat, lon, lat, bbox.maxLng);

    expect(northDist).toBeCloseTo(radiusMeters, 0);
    expect(eastDist).toBeCloseTo(radiusMeters, 0);
  });
});
