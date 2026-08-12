import { describe, it, expect } from 'vitest';
import { detectOverspeedViolations, GPSSample } from '../lib/engine';

describe('Engine - Overspeed Violation Spike Filter', () => {
  it('does NOT create a violation for a single 1-second GPS spike above the limit', () => {
    const baseTime = new Date('2026-08-11T10:00:00Z').getTime();
    
    // Create samples with normal speeds (70 km/h) and a single 1-second spike at 95 km/h
    const samples: GPSSample[] = [
      { latitude: -1.28, longitude: 36.82, speedKmH: 70, accuracy: 10, timestamp: new Date(baseTime).toISOString() },
      { latitude: -1.281, longitude: 36.821, speedKmH: 70, accuracy: 10, timestamp: new Date(baseTime + 1000).toISOString() },
      { latitude: -1.282, longitude: 36.822, speedKmH: 95, accuracy: 10, timestamp: new Date(baseTime + 2000).toISOString() }, // 1-sec spike
      { latitude: -1.283, longitude: 36.823, speedKmH: 70, accuracy: 10, timestamp: new Date(baseTime + 3000).toISOString() },
      { latitude: -1.284, longitude: 36.824, speedKmH: 70, accuracy: 10, timestamp: new Date(baseTime + 4000).toISOString() },
    ];

    const violations = detectOverspeedViolations(samples, 80);
    expect(violations.length).toBe(0);
  });

  it('DOES create an overspeed violation for 4+ consecutive seconds above the limit', () => {
    const baseTime = new Date('2026-08-11T10:00:00Z').getTime();

    // Create samples with 5 consecutive seconds at 95 km/h (>= 4 seconds duration)
    const samples: GPSSample[] = [
      { latitude: -1.280, longitude: 36.820, speedKmH: 95, accuracy: 10, timestamp: new Date(baseTime).toISOString() },
      { latitude: -1.281, longitude: 36.821, speedKmH: 95, accuracy: 10, timestamp: new Date(baseTime + 1000).toISOString() },
      { latitude: -1.282, longitude: 36.822, speedKmH: 95, accuracy: 10, timestamp: new Date(baseTime + 2000).toISOString() },
      { latitude: -1.283, longitude: 36.823, speedKmH: 95, accuracy: 10, timestamp: new Date(baseTime + 3000).toISOString() },
      { latitude: -1.284, longitude: 36.824, speedKmH: 95, accuracy: 10, timestamp: new Date(baseTime + 4000).toISOString() },
    ];

    const violations = detectOverspeedViolations(samples, 80);
    expect(violations.length).toBe(1);
    expect(violations[0]?.maxSpeedKmH).toBeGreaterThanOrEqual(80);
    expect(violations[0]?.speedLimitKmH).toBe(80);
    expect(violations[0]?.durationSec).toBeGreaterThanOrEqual(4.0);
  });
});
