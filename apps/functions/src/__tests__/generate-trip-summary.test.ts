import { describe, it, expect } from 'vitest';
import {
  generateDeterministicSummary,
  processGenerateTripSummaryLogic,
  GenerateTripSummaryPayload,
} from '../risk/generateTripSummary';

describe('Cloud Functions — generateTripSummary (Gemini AI & Fallback)', () => {
  it('generates low risk plain-language summary for compliant driving', () => {
    const payload: GenerateTripSummaryPayload = {
      maxSpeedKmH: 74,
      avgSpeedKmH: 48,
      durationSeconds: 1200,
      routeName: 'Thika Road Corridor',
      overspeedEventsCount: 0,
      violations: [],
    };

    const res = generateDeterministicSummary(payload);
    expect(res.riskTier).toBe('low');
    expect(res.summary).toContain('within the legal 80 km/h threshold');
  });

  it('generates moderate risk plain-language summary for overspeeding', () => {
    const payload: GenerateTripSummaryPayload = {
      maxSpeedKmH: 88,
      avgSpeedKmH: 55,
      durationSeconds: 900,
      routeName: 'Naivasha Road',
      overspeedEventsCount: 1,
      violations: [{ type: 'overspeed', speed: 88, location: 'Naivasha Road' }],
    };

    const res = generateDeterministicSummary(payload);
    expect(res.riskTier).toBe('moderate');
    expect(res.summary).toContain('moderate risk');
    expect(res.summary).toContain('88 km/h');
  });

  it('falls back gracefully to deterministic rule engine when Gemini key is absent', async () => {
    const payload: GenerateTripSummaryPayload = {
      maxSpeedKmH: 94,
      avgSpeedKmH: 60,
      durationSeconds: 1500,
      routeName: 'Mombasa Road',
      overspeedEventsCount: 2,
      violations: [
        { type: 'overspeed', speed: 94, location: 'Mlolongo' },
        { type: 'harsh_braking', location: 'Cabanas' },
      ],
    };

    const result = await processGenerateTripSummaryLogic(payload, null);
    expect(result.success).toBe(true);
    expect(result.generatedBy).toBe('rule_engine');
    expect(result.summary).toContain('Mombasa Road');
    expect(result.overspeedEventsCount).toBe(2);
  });
});
