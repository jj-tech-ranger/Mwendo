import { describe, it, expect } from 'vitest';
import {
  detectOverspeedViolations,
  calculateVehicleRiskScore,
  GPSSample,
} from './engine';

describe('End-to-End Simulation Test: Synthetic Trip Violation & Risk Score Movement', () => {
  it('completing a trip with a synthetic overspeed violation moves the vehicle risk score correctly', () => {
    const vehicleRegNumber = 'KCA 999Z';
    const initialRiskScore = 100;
    const initialTripCount = 0;

    const baseTime = new Date('2026-08-08T10:00:00Z').getTime();

    // 1. Generate synthetic trip GPS stream: 5 seconds sustained at 105 km/h (speed limit 80 km/h)
    const syntheticTripSamples: GPSSample[] = [
      { latitude: -1.28, longitude: 36.82, speedKmH: 60, accuracy: 10, timestamp: new Date(baseTime).toISOString() },
      { latitude: -1.281, longitude: 36.821, speedKmH: 105, accuracy: 12, timestamp: new Date(baseTime + 1000).toISOString() },
      { latitude: -1.282, longitude: 36.822, speedKmH: 105, accuracy: 11, timestamp: new Date(baseTime + 2000).toISOString() },
      { latitude: -1.283, longitude: 36.823, speedKmH: 105, accuracy: 10, timestamp: new Date(baseTime + 3000).toISOString() },
      { latitude: -1.284, longitude: 36.824, speedKmH: 105, accuracy: 12, timestamp: new Date(baseTime + 4000).toISOString() },
      { latitude: -1.285, longitude: 36.825, speedKmH: 105, accuracy: 10, timestamp: new Date(baseTime + 5000).toISOString() },
      { latitude: -1.286, longitude: 36.826, speedKmH: 60, accuracy: 10, timestamp: new Date(baseTime + 6000).toISOString() },
    ];

    // 2. Run overspeed detection algorithm (uses SpeedSmoother EMA)
    const violations = detectOverspeedViolations(syntheticTripSamples, 80);
    expect(violations.length).toBe(1);
    expect(violations[0]?.maxSpeedKmH).toBeGreaterThan(95);
    expect(violations[0]?.durationSec).toBeGreaterThanOrEqual(4.0);

    // 3. Compute risk score movement after trip completion & violation trigger
    const newTripCount = initialTripCount + 1;
    const currentEventTime = baseTime + 5000;

    // Severity for overspeed is 'high' (penalty 18)
    const maxSpd = violations[0]?.maxSpeedKmH ?? 0;
    const eventSeverity: 'low' | 'medium' | 'high' | 'critical' = maxSpd > 110 ? 'critical' : 'high';
    const riskEvents = [{ severity: eventSeverity, timestamp: currentEventTime }];

    const { riskScore: newRiskScore, riskTier } = calculateVehicleRiskScore(
      riskEvents,
      newTripCount,
      currentEventTime
    );

    // Expected math verification:
    // Raw score = 100 - 18 = 82
    // Regularized floor with tripCount = 1 (factor 0.01):
    // 82 * 0.01 + 85 * 0.99 = 0.82 + 84.15 = 84.97 -> rounded 85
    expect(newRiskScore).toBeLessThanOrEqual(initialRiskScore);
    expect(newRiskScore).toBeGreaterThanOrEqual(80);
    expect(riskTier).toBe('low');

    console.log(`[E2E Smoke Test] Vehicle ${vehicleRegNumber} initial score: ${initialRiskScore} -> Updated risk score: ${newRiskScore} (Tier: ${riskTier})`);
  });
});
