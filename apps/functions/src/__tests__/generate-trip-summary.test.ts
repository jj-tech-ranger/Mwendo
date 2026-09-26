import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateDeterministicSummary,
  processGenerateTripSummaryLogic,
  GenerateTripSummaryPayload,
} from '../risk/generateTripSummary';

describe('Cloud Functions — generateTripSummary (Gemini AI & Fallback)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

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

  it('falls back gracefully to deterministic rule engine when Gemini key is null or empty', async () => {
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

    const deterministic = generateDeterministicSummary(payload);

    // Null key
    const resultNull = await processGenerateTripSummaryLogic(payload, null);
    expect(resultNull.success).toBe(true);
    expect(resultNull.generatedBy).toBe('rule_engine');
    expect(resultNull.summary).toBe(deterministic.summary);
    expect(resultNull.riskTier).toBe(deterministic.riskTier);

    // Empty string key
    const resultEmpty = await processGenerateTripSummaryLogic(payload, '   ');
    expect(resultEmpty.success).toBe(true);
    expect(resultEmpty.generatedBy).toBe('rule_engine');
    expect(resultEmpty.summary).toBe(deterministic.summary);
    expect(resultEmpty.riskTier).toBe(deterministic.riskTier);
  });

  it('returns generatedBy: gemini and AI summary when Gemini responds successfully while preserving deterministic riskTier', async () => {
    const payload: GenerateTripSummaryPayload = {
      maxSpeedKmH: 104,
      avgSpeedKmH: 72,
      durationSeconds: 1800,
      routeName: 'Nakuru - Eldoret Highway',
      overspeedEventsCount: 3,
      violations: [{ type: 'overspeed', speed: 104, location: 'Salgaa' }],
    };

    const deterministic = generateDeterministicSummary(payload);
    expect(deterministic.riskTier).toBe('high');

    const mockAiSummary = 'Trip along Nakuru - Eldoret Highway exhibited sustained speeds reaching 104 km/h with 3 overspeed infractions — high risk.';

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: mockAiSummary }],
            },
          },
        ],
      }),
    } as any);

    const result = await processGenerateTripSummaryLogic(payload, 'test-gemini-key');

    expect(result.success).toBe(true);
    expect(result.generatedBy).toBe('gemini');
    expect(result.summary).toBe(mockAiSummary);
    expect(result.riskTier).toBe(deterministic.riskTier);
    expect(result.overspeedEventsCount).toBe(3);

    // Verify endpoint called with model and key
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [callUrl, callOptions] = (globalThis.fetch as any).mock.calls[0];
    expect(callUrl).toContain('models/gemini-3.8-flash:generateContent');
    expect(callUrl).toContain('key=test-gemini-key');
    expect(JSON.parse(callOptions.body).contents[0].parts[0].text).toContain('Nakuru - Eldoret Highway');
  });

  it('falls back to rule_engine without throwing when Gemini call fails, throws, or times out', async () => {
    const payload: GenerateTripSummaryPayload = {
      maxSpeedKmH: 85,
      avgSpeedKmH: 50,
      durationSeconds: 1200,
      routeName: 'Jogoo Road',
      overspeedEventsCount: 1,
      violations: [{ type: 'overspeed', speed: 85, location: 'City Stadium' }],
    };

    const deterministic = generateDeterministicSummary(payload);

    // Case 1: Fetch throws network error / timeout
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Fetch timeout / network unreachable'));

    const resultNetworkError = await processGenerateTripSummaryLogic(payload, 'test-gemini-key');
    expect(resultNetworkError.success).toBe(true);
    expect(resultNetworkError.generatedBy).toBe('rule_engine');
    expect(resultNetworkError.summary).toBe(deterministic.summary);
    expect(resultNetworkError.riskTier).toBe(deterministic.riskTier);

    // Case 2: Fetch returns non-200 HTTP error (e.g. 403 or 503)
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'API key expired' } }),
    } as any);

    const resultHttpError = await processGenerateTripSummaryLogic(payload, 'test-gemini-key');
    expect(resultHttpError.success).toBe(true);
    expect(resultHttpError.generatedBy).toBe('rule_engine');
    expect(resultHttpError.summary).toBe(deterministic.summary);

    // Case 3: Fetch returns empty / malformed candidates
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [] }),
    } as any);

    const resultMalformed = await processGenerateTripSummaryLogic(payload, 'test-gemini-key');
    expect(resultMalformed.success).toBe(true);
    expect(resultMalformed.generatedBy).toBe('rule_engine');
    expect(resultMalformed.summary).toBe(deterministic.summary);
  });
});
