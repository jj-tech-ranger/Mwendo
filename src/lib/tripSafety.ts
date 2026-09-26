import { Trip } from '../types';

export interface TripSafetyAssessment {
  score: number | string;
  summary: string;
  riskTier: 'low' | 'moderate' | 'high';
  isSafe: boolean;
}

/**
 * Computes a standardized safety score and human-readable summary for a completed trip.
 */
export function computeTripSafety(trip: Trip): TripSafetyAssessment {
  const isIncomplete = trip.status === 'incomplete_signal_lost';
  if (isIncomplete) {
    return {
      score: '—',
      summary: 'Trip telemetry ended prematurely due to continuous GPS signal loss.',
      riskTier: 'moderate',
      isSafe: false,
    };
  }

  const overspeed = trip.overspeedEventsCount ?? trip.violationsCount ?? 0;
  const maxSpeed = trip.maxSpeedKmH || 0;
  const route = trip.routeName || 'corridor route';

  let riskTier: 'low' | 'moderate' | 'high' = 'low';
  let summary = '';
  let score = 96;

  if (maxSpeed > 100 || overspeed >= 3) {
    riskTier = 'high';
    score = Math.max(30, 72 - overspeed * 6);
    summary = `Recorded ${overspeed} severe overspeed violation${overspeed === 1 ? '' : 's'} peaking at ${maxSpeed} km/h along ${route} — high risk.`;
  } else if (maxSpeed > 80 || overspeed > 0) {
    riskTier = 'moderate';
    score = Math.max(60, 88 - overspeed * 5);
    summary = `Recorded ${overspeed} overspeed event${overspeed === 1 ? '' : 's'} peaking at ${maxSpeed} km/h along ${route} — moderate risk.`;
  } else {
    riskTier = 'low';
    score = 96;
    summary = `Maintained compliant speeds within the legal 80 km/h PSV limit along ${route} with 0 recorded violations — low risk.`;
  }

  return {
    score,
    summary,
    riskTier,
    isSafe: riskTier === 'low',
  };
}
