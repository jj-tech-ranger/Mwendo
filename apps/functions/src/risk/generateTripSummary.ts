import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { APP_CHECK_ENFORCED, GEMINI_API_KEY } from '../lib/env';

export interface TripViolation {
  type: string;
  speed?: number;
  location?: string;
  details?: string;
}

export interface GenerateTripSummaryPayload {
  tripId?: string;
  maxSpeedKmH: number;
  avgSpeedKmH?: number;
  durationSeconds?: number;
  saccoName?: string;
  routeName?: string;
  overspeedEventsCount?: number;
  violations?: TripViolation[];
}

export interface GenerateTripSummaryResult {
  success: boolean;
  summary: string;
  riskTier: 'low' | 'moderate' | 'high';
  overspeedEventsCount: number;
  generatedBy: 'gemini' | 'rule_engine';
}

export function generateDeterministicSummary(payload: GenerateTripSummaryPayload): {
  summary: string;
  riskTier: 'low' | 'moderate' | 'high';
} {
  const overspeed = payload.overspeedEventsCount ?? (payload.violations ? payload.violations.length : 0);
  const maxSpeed = payload.maxSpeedKmH || 0;
  const route = payload.routeName || 'this corridor';

  if (maxSpeed > 100 || overspeed >= 3) {
    return {
      summary: `This trip recorded ${overspeed} severe overspeed violation${overspeed === 1 ? '' : 's'} reaching a peak speed of ${maxSpeed} km/h along ${route} — high safety risk.`,
      riskTier: 'high',
    };
  }

  if (maxSpeed > 80 || overspeed > 0) {
    const violationSummary = payload.violations && payload.violations.length > 0
      ? payload.violations.map((v) => v.details || v.type).slice(0, 2).join(' and ')
      : `${overspeed} sustained overspeed event${overspeed === 1 ? '' : 's'}`;
    return {
      summary: `This trip recorded ${violationSummary} along ${route} — moderate risk. Speeds peaked at ${maxSpeed} km/h.`,
      riskTier: 'moderate',
    };
  }

  return {
    summary: `This trip maintained compliant driving speeds within the legal 80 km/h threshold along ${route} with 0 recorded violations — low risk.`,
    riskTier: 'low',
  };
}

export async function processGenerateTripSummaryLogic(
  payload: GenerateTripSummaryPayload,
  _geminiApiKey?: string | null
): Promise<GenerateTripSummaryResult> {
  const deterministic = generateDeterministicSummary(payload);
  const overspeed = payload.overspeedEventsCount ?? (payload.violations ? payload.violations.length : 0);

  const resolvedKey = _geminiApiKey !== undefined ? _geminiApiKey : GEMINI_API_KEY;
  const apiKey = resolvedKey ? resolvedKey.trim() : null;
  if (apiKey) {
    try {
      const prompt = `You are a Kenyan public transport safety analyst for Mwendo Salama. Write a concise 1-2 sentence passenger trip safety summary based strictly on this verified telemetry:
- Route: ${payload.routeName || 'Standard Route'}
- Peak Speed: ${payload.maxSpeedKmH} km/h (legal PSV threshold: 80 km/h)
- Average Speed: ${payload.avgSpeedKmH != null ? `${payload.avgSpeedKmH} km/h` : 'N/A'}
- Duration: ${payload.durationSeconds != null ? `${Math.round(payload.durationSeconds / 60)} minutes` : 'N/A'}
- Overspeed Events: ${overspeed}
- Assessed Risk Tier: ${deterministic.riskTier}
- Violations: ${payload.violations && payload.violations.length > 0 ? payload.violations.map((v) => v.details || v.type).join(', ') : 'None'}

Rules:
1. Provide only 1-2 factual, supportive sentences for the passenger.
2. The risk standing is strictly ${deterministic.riskTier} risk. Do not contradict or alter this assessment.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 120,
              temperature: 0.2,
            },
          }),
          signal: AbortSignal.timeout(5000),
        }
      );

      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };

        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidateText && candidateText.length > 0) {
          return {
            success: true,
            summary: candidateText,
            riskTier: deterministic.riskTier,
            overspeedEventsCount: payload.overspeedEventsCount ?? 0,
            generatedBy: 'gemini',
          };
        }
      }
    } catch {
      // Fall through to deterministic rule engine fallback on any failure
    }
  }

  return {
    success: true,
    summary: deterministic.summary,
    riskTier: deterministic.riskTier,
    overspeedEventsCount: payload.overspeedEventsCount ?? 0,
    generatedBy: 'rule_engine',
  };
}

export const generateTripSummary = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to generate trip safety summary.');
    }

    const payload = request.data as GenerateTripSummaryPayload;
    if (!payload || typeof payload.maxSpeedKmH !== 'number') {
      throw new HttpsError('invalid-argument', 'Trip speed profile with maxSpeedKmH is required.');
    }

    return processGenerateTripSummaryLogic(payload, GEMINI_API_KEY);
  }
);

