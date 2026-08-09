import { describe, it, expect } from 'vitest';
import {
  SpeedSmoother,
  ConfidenceScorer,
  calculateReporterTrustScore,
  getTrustBadgeLevel,
  calculateVehicleRiskScore,
  calculateSaccoSafetyScore,
  detectOverspeedViolations,
  GPSSample,
} from './engine';

describe('1. SpeedSmoother GPS Filtering & EMA', () => {
  it('correctly filters low-accuracy GPS samples and applies EMA smoothing (alpha=0.35)', () => {
    const smoother = new SpeedSmoother(0.35, 30);

    // Sample 1: raw 100 km/h, accuracy 10m -> valid, initial speed = 100
    const s1 = smoother.processSample({
      latitude: -1.28,
      longitude: 36.82,
      speedKmH: 100,
      accuracy: 10,
      timestamp: '2026-08-08T10:00:00Z',
    });
    expect(s1.isValid).toBe(true);
    expect(s1.smoothedSpeedKmH).toBe(100);

    // Sample 2: raw 120 km/h, accuracy 15m -> EMA = 0.35 * 120 + 0.65 * 100 = 42 + 65 = 107
    const s2 = smoother.processSample({
      latitude: -1.281,
      longitude: 36.821,
      speedKmH: 120,
      accuracy: 15,
      timestamp: '2026-08-08T10:00:05Z',
    });
    expect(s2.isValid).toBe(true);
    expect(s2.smoothedSpeedKmH).toBe(107);

    // Sample 3: raw 140 km/h, accuracy 45m (> 30m limit) -> invalid, discarded
    const s3 = smoother.processSample({
      latitude: -1.282,
      longitude: 36.822,
      speedKmH: 140,
      accuracy: 45,
      timestamp: '2026-08-08T10:00:10Z',
    });
    expect(s3.isValid).toBe(false);
    expect(s3.smoothedSpeedKmH).toBe(107);
  });
});

describe('2. Confidence Scoring', () => {
  it('calculates Trip Confidence according to 0.4*Accuracy + 0.3*Continuity + 0.3*Density', () => {
    const baseTime = new Date('2026-08-08T10:00:00Z').getTime();
    const samples: GPSSample[] = Array.from({ length: 10 }, (_, i) => ({
      latitude: -1.28 + i * 0.001,
      longitude: 36.82 + i * 0.001,
      speedKmH: 60,
      accuracy: 15, // (30 - 15) / 30 = 0.5 accuracy weight
      timestamp: new Date(baseTime + i * 5000).toISOString(),
    }));

    // Accuracy = 0.5, Continuity = 1.0, Density = 10 / (50s / 5s = 10) = 1.0
    // Expected confidence = 0.4*0.5 + 0.3*1.0 + 0.3*1.0 = 0.80
    const confidence = ConfidenceScorer.calculateTripConfidence(samples, 5, 50);
    expect(confidence).toBe(0.8);
  });

  it('calculates Violation Confidence with <= 30m accuracy gate and duration factors', () => {
    // 4s duration (factor = 1.0), 15m accuracy (factor = 0.5), 1 corroboration (factor = 0.5)
    // 0.4*1.0 + 0.4*0.5 + 0.2*0.5 = 0.4 + 0.2 + 0.1 = 0.70
    const conf = ConfidenceScorer.calculateViolationConfidence(4, 15, 1);
    expect(conf).toBe(0.7);

    // Accuracy > 30m -> fails gate
    const invalidConf = ConfidenceScorer.calculateViolationConfidence(10, 35, 2);
    expect(invalidConf).toBe(0.0);
  });

  it('calculates Hazard Confidence with corroborations, trust, and evidence photo', () => {
    // 3 corroborations (1.0), trust 0.75 (0.75), photo true (1.0)
    // 0.4*1.0 + 0.4*0.75 + 0.2*1.0 = 0.4 + 0.3 + 0.2 = 0.90
    const hazardConf = ConfidenceScorer.calculateHazardConfidence(3, 0.75, true);
    expect(hazardConf).toBe(0.9);
  });
});

describe('3. Reporter Trust Engine', () => {
  it('calculates ReporterTrustScore and assigns badge levels correctly', () => {
    // Base = 0.5, 3 confirmed (+0.3), 1 false (-0.2), 20 days age (+0.1) -> total = 0.7
    const trust = calculateReporterTrustScore(3, 1, 20);
    expect(trust).toBe(0.7);

    expect(getTrustBadgeLevel(0.7)).toBe('silver');
    expect(getTrustBadgeLevel(0.8)).toBe('gold');
    expect(getTrustBadgeLevel(0.95)).toBe('verified_guardian');
    expect(getTrustBadgeLevel(0.4)).toBe('bronze');
  });
});

describe('4. Risk Calculations', () => {
  it('calculates Vehicle Risk Score with exponential decay and sub-100 trip regularization', () => {
    const now = new Date('2026-08-08T12:00:00Z').getTime();

    // 1 recent high-severity event (penalty 18, decay = 1.0)
    const events = [{ severity: 'high' as const, timestamp: now }];

    // Total trips = 100 -> trip factor = 1.0
    // Raw score = 100 - 18 = 82
    const res100 = calculateVehicleRiskScore(events, 100, now);
    expect(res100.riskScore).toBe(82);

    // Total trips = 50 -> trip factor = 0.5
    // Regularized = 82 * 0.5 + 85 * 0.5 = 41 + 42.5 = 83.5 -> rounded 84
    const res50 = calculateVehicleRiskScore(events, 50, now);
    expect(res50.riskScore).toBe(84);
  });

  it('calculates SACCO Safety Score based on fleet vehicle risk scores and complaints', () => {
    // Fleet scores [90, 80, 70] -> avg = 80
    // Unresolved complaints = 2 -> deduction = 4
    // Final score = 80 - 4 = 76
    const saccoScore = calculateSaccoSafetyScore([90, 80, 70], 2);
    expect(saccoScore).toBe(76);
  });
});

describe('5. Overspeed Violation Detection Engine', () => {
  it('enforces 4-second-sustained overspeed and 20-second cooldown period', () => {
    const baseTime = new Date('2026-08-08T10:00:00Z').getTime();
    // Generate samples: 6 consecutive seconds of 95 km/h (limit 80 km/h)
    const samples: GPSSample[] = Array.from({ length: 6 }, (_, i) => ({
      latitude: -1.28 + i * 0.001,
      longitude: 36.82 + i * 0.001,
      speedKmH: 95,
      accuracy: 10,
      timestamp: new Date(baseTime + i * 1000).toISOString(),
    }));

    const violations = detectOverspeedViolations(samples, 80);
    expect(violations.length).toBe(1);
    expect(violations[0].maxSpeedKmH).toBe(95);
    expect(violations[0].speedLimitKmH).toBe(80);
    expect(violations[0].durationSec).toBeGreaterThanOrEqual(4.0);
  });
});
