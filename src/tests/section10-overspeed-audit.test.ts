import { describe, it, expect } from 'vitest';
import { detectOverspeedViolations, GPSSample } from '../lib/engine';

describe('Section 10 — Overspeed Engine Audit Suite (Cases 1 to 10)', () => {
  const SPEED_LIMIT = 80;
  const baseTime = new Date('2026-08-11T12:00:00Z').getTime();

  // Helper to build GPS samples
  const createSample = (offsetMs: number, speedKmH: number, accuracy: number = 10): GPSSample => ({
    latitude: -1.28 + offsetMs * 0.00001,
    longitude: 36.82 + offsetMs * 0.00001,
    speedKmH,
    accuracy,
    timestamp: new Date(baseTime + offsetMs).toISOString(),
  });

  // Case 1: Normal compliant cruise below limit
  it('Case 1: Compliant cruise (70 km/h for 10 seconds) produces zero violations', () => {
    const samples: GPSSample[] = Array.from({ length: 11 }, (_, i) =>
      createSample(i * 1000, 70)
    );
    const violations = detectOverspeedViolations(samples, SPEED_LIMIT);
    expect(violations.length).toBe(0);
  });

  // Case 2: Single-sample spike rejection
  it('Case 2: Single-sample spike (95 km/h for 1s between 70 km/h) is rejected with zero violations', () => {
    const samples: GPSSample[] = [
      createSample(0, 70),
      createSample(1000, 70),
      createSample(2000, 95), // 1-sec isolated spike
      createSample(3000, 70),
      createSample(4000, 70),
    ];
    const violations = detectOverspeedViolations(samples, SPEED_LIMIT);
    expect(violations.length).toBe(0);
  });

  // Case 3: Short sub-threshold burst (< 4 seconds)
  it('Case 3: Short burst above limit (< 4 seconds) produces zero violations', () => {
    const samples: GPSSample[] = [
      createSample(0, 70),
      createSample(1000, 95),
      createSample(2000, 95),
      createSample(3000, 95), // 2 seconds elapsed overspeed (t=1000 to t=3000)
      createSample(4000, 70),
      createSample(5000, 70),
    ];
    const violations = detectOverspeedViolations(samples, SPEED_LIMIT);
    expect(violations.length).toBe(0);
  });

  // Case 4: Large excursion sustained for >= 4 seconds
  it('Case 4: Large excursion (95 km/h sustained for 5s) triggers 1 violation with accurate metrics', () => {
    const samples: GPSSample[] = [
      createSample(0, 70),
      createSample(1000, 95),
      createSample(2000, 95),
      createSample(3000, 95),
      createSample(4000, 95),
      createSample(5000, 95), // 4 seconds elapsed (t=1000 to t=5000)
      createSample(6000, 70),
    ];
    const violations = detectOverspeedViolations(samples, SPEED_LIMIT);
    expect(violations.length).toBe(1);
    expect(violations[0]?.speedLimitKmH).toBe(80);
    expect(violations[0]?.maxSpeedKmH).toBe(95);
    expect(violations[0]?.durationSec).toBe(4.0);
    expect(violations[0]?.startTime).toBe(new Date(baseTime + 1000).toISOString());
    expect(violations[0]?.endTime).toBe(new Date(baseTime + 5000).toISOString());
  });

  // Case 5: Near-threshold sustained excursion (The core audit fix)
  it('Case 5: Near-threshold excursion (81 km/h sustained for 6s from 70 km/h cruise) triggers violation', () => {
    // Excursion starts at t=3000 and is sustained until t=9000 (6 seconds continuous at 81 km/h)
    const samples: GPSSample[] = [
      createSample(0, 70),
      createSample(1000, 70),
      createSample(2000, 70),
      // Excursion begins at t=3000:
      createSample(3000, 81),
      createSample(4000, 81),
      createSample(5000, 81),
      createSample(6000, 81),
      createSample(7000, 81), // Exactly 4.0s elapsed from excursion start -> violation triggers here
      createSample(8000, 81),
      createSample(9000, 81),
      createSample(10000, 70),
    ];
    const violations = detectOverspeedViolations(samples, SPEED_LIMIT);
    expect(violations.length).toBe(1);
    expect(violations[0]?.speedLimitKmH).toBe(80);
    expect(violations[0]?.maxSpeedKmH).toBe(81);
    expect(violations[0]?.durationSec).toBe(4.0);
    expect(violations[0]?.startTime).toBe(new Date(baseTime + 3000).toISOString());
    expect(violations[0]?.endTime).toBe(new Date(baseTime + 7000).toISOString());
  });

  // Case 6: 20-second cooldown enforcement
  it('Case 6: Overspeed continuing during 20-second cooldown window does not spawn duplicate violations', () => {
    // Sustained overspeed for 15 seconds continuously at 90 km/h
    const samples: GPSSample[] = Array.from({ length: 16 }, (_, i) =>
      createSample(i * 1000, 90)
    );
    const violations = detectOverspeedViolations(samples, SPEED_LIMIT);
    // Violation triggers at t=4000; t=5000..15000 are in 20s cooldown
    expect(violations.length).toBe(1);
    expect(violations[0]?.durationSec).toBe(4.0);
  });

  // Case 7: Second violation fires after 20-second cooldown expires
  it('Case 7: Excursion resuming or continuing after 20-second cooldown expires triggers subsequent violation', () => {
    const samples: GPSSample[] = [
      // First excursion: t=0 to t=4000 triggers at t=4000, cooldown until t=24000
      createSample(0, 90),
      createSample(1000, 90),
      createSample(2000, 90),
      createSample(3000, 90),
      createSample(4000, 90), // Trigger 1 -> cooldown until 24000
      createSample(10000, 70),
      createSample(20000, 70),
      createSample(24000, 70), // Cooldown expires
      // Second excursion: t=25000 to t=29000 triggers at t=29000
      createSample(25000, 92),
      createSample(26000, 92),
      createSample(27000, 92),
      createSample(28000, 92),
      createSample(29000, 92), // Trigger 2
    ];
    const violations = detectOverspeedViolations(samples, SPEED_LIMIT);
    expect(violations.length).toBe(2);
    expect(violations[0]?.maxSpeedKmH).toBe(90);
    expect(violations[1]?.maxSpeedKmH).toBe(92);
  });

  // Case 8: Invalid / low-accuracy GPS samples
  it('Case 8: Low accuracy (>30m) or NaN/non-finite samples are discarded and do not corrupt detection', () => {
    const samples: GPSSample[] = [
      createSample(0, 70, 10),
      createSample(1000, 120, 45), // Accuracy 45m (>30m) -> discarded
      createSample(2000, NaN as any, 10), // NaN -> discarded
      createSample(3000, Infinity as any, 10), // Non-finite -> discarded
      createSample(4000, 70, 10),
    ];
    const violations = detectOverspeedViolations(samples, SPEED_LIMIT);
    expect(violations.length).toBe(0);
  });

  // Case 9: Fluctuating speeds crossing threshold do not trigger violations
  it('Case 9: Fluctuating speeds dipping below threshold reset duration timer', () => {
    const samples: GPSSample[] = [
      createSample(0, 82),
      createSample(1000, 79), // Dips below 80 -> resets
      createSample(2000, 83),
      createSample(3000, 78), // Dips below 80 -> resets
      createSample(4000, 85),
      createSample(5000, 77),
    ];
    const violations = detectOverspeedViolations(samples, SPEED_LIMIT);
    expect(violations.length).toBe(0);
  });

  // Case 10: Data integrity: single noise spike during sustained excursion does not inflate maxSpeedKmH
  it('Case 10: Data integrity: single-sample 140 km/h spike during 81 km/h excursion does not corrupt maxSpeedKmH', () => {
    const samples: GPSSample[] = [
      createSample(0, 70),
      createSample(1000, 81),
      createSample(2000, 81),
      createSample(3000, 140), // Isolated single-sample noise spike
      createSample(4000, 81),
      createSample(5000, 81), // 4 seconds elapsed from t=1000 -> triggers violation
      createSample(6000, 70),
    ];
    const violations = detectOverspeedViolations(samples, SPEED_LIMIT);
    expect(violations.length).toBe(1);
    expect(violations[0]?.durationSec).toBe(4.0);
    expect(violations[0]?.maxSpeedKmH).toBe(81); // Accurate sustained speed, spike rejected
  });
});

describe('Section 10 — Adversarial Parameter Sweep Matrix (72 cells)', () => {
  const SPEED_LIMIT = 80;
  const cruiseSpeeds = [60, 70, 79];
  const thresholdDeltas = [1, 2, 5, 10]; // 81, 82, 85, 90 km/h
  const sustainedDurations = [4, 5, 6, 8, 10, 15]; // seconds
  const baseTime = new Date('2026-08-11T14:00:00Z').getTime();

  cruiseSpeeds.forEach((cruiseSpeed) => {
    thresholdDeltas.forEach((delta) => {
      const excursionSpeed = SPEED_LIMIT + delta;
      sustainedDurations.forEach((durationSec) => {
        it(`cruise=${cruiseSpeed} km/h -> ${excursionSpeed} km/h (+${delta}) sustained for ${durationSec}s triggers bounded latency violation`, () => {
          const samples: GPSSample[] = [];

          // 1. Preceding cruise period (3 seconds at cruiseSpeed)
          for (let c = 0; c < 3; c++) {
            samples.push({
              latitude: -1.28 + c * 0.0001,
              longitude: 36.82 + c * 0.0001,
              speedKmH: cruiseSpeed,
              accuracy: 10,
              timestamp: new Date(baseTime + c * 1000).toISOString(),
            });
          }

          const excursionStartMs = baseTime + 3000;

          // 2. Sustained excursion period (durationSec elapsed seconds = durationSec + 1 samples at 1Hz)
          for (let s = 0; s <= durationSec; s++) {
            samples.push({
              latitude: -1.28 + (3 + s) * 0.0001,
              longitude: 36.82 + (3 + s) * 0.0001,
              speedKmH: excursionSpeed,
              accuracy: 10,
              timestamp: new Date(excursionStartMs + s * 1000).toISOString(),
            });
          }

          // 3. Post-excursion return to cruise
          samples.push({
            latitude: -1.28 + (4 + durationSec) * 0.0001,
            longitude: 36.82 + (4 + durationSec) * 0.0001,
            speedKmH: cruiseSpeed,
            accuracy: 10,
            timestamp: new Date(excursionStartMs + (durationSec + 1) * 1000).toISOString(),
          });

          // Run overspeed engine
          const violations = detectOverspeedViolations(samples, SPEED_LIMIT);

          // Assertions:
          // Must trigger exactly 1 violation (subsequent samples in same excursion are within 20s cooldown)
          expect(violations.length).toBe(1);

          const v = violations[0]!;
          expect(v.speedLimitKmH).toBe(SPEED_LIMIT);
          expect(v.maxSpeedKmH).toBe(excursionSpeed);
          expect(v.durationSec).toBe(4.0);

          // Start time must match the exact excursion start
          expect(v.startTime).toBe(new Date(excursionStartMs).toISOString());

          // Trigger latency must be exactly 4.0 seconds (bounded latency <= 4.0s)
          const triggerTimeMs = new Date(v.endTime).getTime();
          const latencyFromStartSec = (triggerTimeMs - excursionStartMs) / 1000;
          expect(latencyFromStartSec).toBe(4.0);
        });
      });
    });
  });
});
