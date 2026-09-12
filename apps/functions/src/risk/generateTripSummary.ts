import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { APP_CHECK_ENFORCED } from '../lib/env';

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

    return processGenerateTripSummaryLogic(payload);
  }
);
