import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import {
  detectOverspeedViolations,
  ConfidenceScorer,
  GPSSample,
  OverspeedViolationTrigger,
} from '../lib/engine';
import { processVehicleRiskLogic, VehicleRiskEventPayload } from '../risk/computeVehicleRisk';
import { APP_CHECK_ENFORCED } from '../lib/env';
import { normalizePlate } from '../lib/plate';
import { isWithinKenya, isPlausibleSpeed } from '../lib/constants';

export interface ProcessTripCompletionPayload {
  tripId: string;
  samples: GPSSample[];
  speedLimitKmH?: number;
}

export interface CreatedViolationDetail {
  id: string;
  violationId: string;
  tripId: string;
  vehicleRegNumber: string;
  vehicleId: string;
  saccoId: string;
  routeName: string;
  recordedSpeedKmH: number;
  smoothedSpeedKmH: number;
  speedLimitKmH: number;
  durationSec: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore: number;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface ProcessTripCompletionResult {
  success: boolean;
  processed: boolean;
  alreadyProcessed?: boolean;
  tripId: string;
  violationsCount: number;
  violations: CreatedViolationDetail[];
  latestRiskScore?: number;
  latestRiskTier?: string;
}

/**
 * Core server-authoritative trip completion processing logic.
 * Re-runs overspeed detection on raw GPS samples, writes verified violation records
 * directly using the Admin SDK, updates the idempotency ledger, and invokes vehicle risk scoring.
 */
export async function processTripCompletionLogic(
  db: Firestore,
  payload: ProcessTripCompletionPayload,
  callerAuth?: { uid: string; role?: string }
): Promise<ProcessTripCompletionResult> {
  const { tripId, samples, speedLimitKmH } = payload;

  if (!tripId || typeof tripId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid tripId.');
  }

  // 1. Idempotency Check via processedEvents ledger
  const tripLedgerRef = db.collection('processedEvents').doc(`trip_completion_${tripId}`);
  const ledgerSnap = await tripLedgerRef.get();
  if (ledgerSnap.exists) {
    const existingData = ledgerSnap.data() || {};
    return {
      success: true,
      processed: false,
      alreadyProcessed: true,
      tripId,
      violationsCount: typeof existingData.violationsCount === 'number' ? existingData.violationsCount : 0,
      violations: [],
    };
  }

  // 2. Fetch authoritative trip document
  const tripRef = db.collection('trips').doc(tripId);
  const tripSnap = await tripRef.get();
  if (!tripSnap.exists) {
    throw new HttpsError('not-found', `Trip with id ${tripId} not found in database.`);
  }

  const tripData = tripSnap.data() || {};

  // Security Check: Verify caller ownership unless admin or authority
  if (callerAuth) {
    const isPrivileged = callerAuth.role === 'admin' || callerAuth.role === 'authority';
    if (!isPrivileged && tripData.userId && tripData.userId !== callerAuth.uid) {
      throw new HttpsError('permission-denied', 'Cannot complete a trip owned by another passenger.');
    }
  }

  const rawPlate = tripData.vehicleRegNumber || tripData.plateNumber || '';
  const cleanPlate = normalizePlate(rawPlate);
  const vehicleId = tripData.vehicleId || cleanPlate;
  const saccoId = tripData.saccoId || 'unassigned';
  const routeName = tripData.routeName || 'Standard Route';

  // 3. Telemetry Plausibility & Sanity Filtering
  const validatedSamples: GPSSample[] = [];
  if (Array.isArray(samples)) {
    for (const s of samples) {
      if (!s || typeof s !== 'object') continue;
      const lat = Number(s.latitude);
      const lng = Number(s.longitude);
      const speed = Number(s.speedKmH);
      const accuracy = Number(s.accuracy);
      const timeMs = new Date(s.timestamp).getTime();

      // Bounds validation: Kenya coordinates, plausible speed (0-180 km/h), valid timestamp
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isWithinKenya(lat, lng)) continue;
      if (!Number.isFinite(speed) || !isPlausibleSpeed(speed)) continue;
      if (!Number.isFinite(timeMs)) continue;
      if (Number.isFinite(accuracy) && accuracy < 0) continue;

      validatedSamples.push({
        latitude: lat,
        longitude: lng,
        speedKmH: speed,
        accuracy: Number.isFinite(accuracy) ? accuracy : 15,
        timestamp: typeof s.timestamp === 'string' ? s.timestamp : new Date(s.timestamp).toISOString(),
      });
    }
  }

  // Ensure chronological order
  validatedSamples.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // 4. Server-Authoritative Overspeed Detection
  const effectiveSpeedLimit =
    typeof speedLimitKmH === 'number' && speedLimitKmH > 0 && speedLimitKmH <= 180
      ? speedLimitKmH
      : 80;

  const detectedTriggers: OverspeedViolationTrigger[] = detectOverspeedViolations(
    validatedSamples,
    effectiveSpeedLimit
  );

  const createdViolations: CreatedViolationDetail[] = [];
  let latestRiskScore: number | undefined;
  let latestRiskTier: string | undefined;

  // 5. Persist each violation record and trigger vehicle risk calculation
  for (let index = 0; index < detectedTriggers.length; index++) {
    const trigger = detectedTriggers[index];
    if (!trigger) continue;

    // Deterministic Event ID derived strictly from tripId and violation index
    const eventId = `viol_${tripId}_${index}`;
    const startMs = new Date(trigger.startTime).getTime();
    const endMs = new Date(trigger.endTime).getTime();

    // Locate peak speed sample during the violation window
    const windowSamples = validatedSamples.filter((s) => {
      const t = new Date(s.timestamp).getTime();
      return t >= startMs && t <= endMs;
    });

    const peakSample =
      windowSamples.find((s) => s.speedKmH >= trigger.maxSpeedKmH - 0.5) ||
      windowSamples[0] ||
      validatedSamples[0] || {
        latitude: 0,
        longitude: 0,
        accuracy: 15,
      };

    const accuracy = peakSample.accuracy ?? 15;
    const confidenceScore = ConfidenceScorer.calculateViolationConfidence(
      trigger.durationSec,
      accuracy,
      0
    );

    const severity: 'low' | 'medium' | 'high' | 'critical' =
      trigger.maxSpeedKmH > 110 ? 'critical' : trigger.maxSpeedKmH > 95 ? 'high' : 'medium';

    const violationData: Record<string, unknown> = {
      id: eventId,
      violationId: eventId,
      tripId,
      userId: tripData.userId || null,
      vehicleRegNumber: cleanPlate,
      vehicleId,
      saccoId,
      routeName,
      locationName: routeName,
      recordedSpeedKmH: trigger.maxSpeedKmH,
      smoothedSpeedKmH: trigger.maxSpeedKmH,
      speedLimitKmH: trigger.speedLimitKmH,
      durationSec: trigger.durationSec,
      severity,
      confidenceScore,
      isCorroborated: false,
      status: 'pending',
      latitude: peakSample.latitude,
      longitude: peakSample.longitude,
      timestamp: trigger.startTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Write violation to Firestore using Admin SDK (bypasses security rules)
    await db.collection('violations').doc(eventId).set(violationData);

    createdViolations.push({
      id: eventId,
      violationId: eventId,
      tripId,
      vehicleRegNumber: cleanPlate,
      vehicleId,
      saccoId,
      routeName,
      recordedSpeedKmH: trigger.maxSpeedKmH,
      smoothedSpeedKmH: trigger.maxSpeedKmH,
      speedLimitKmH: trigger.speedLimitKmH,
      durationSec: trigger.durationSec,
      severity,
      confidenceScore,
      latitude: peakSample.latitude,
      longitude: peakSample.longitude,
      timestamp: trigger.startTime,
    });

    // 6. Invoke Server-Authoritative Vehicle Risk Logic
    const riskEvent: VehicleRiskEventPayload = {
      eventId,
      vehicleRegNumber: cleanPlate,
      vehicleId,
      saccoId,
      eventType: 'overspeed',
      severity,
      recordedSpeedKmH: trigger.maxSpeedKmH,
      speedLimitKmH: trigger.speedLimitKmH,
      confidenceScore,
      timestamp: trigger.startTime,
    };

    const riskResult = await processVehicleRiskLogic(db, riskEvent);
    if (riskResult.processed) {
      latestRiskScore = riskResult.riskScore;
      latestRiskTier = riskResult.riskTier;
    }
  }

  // 7. Persist validated raw telemetry into server-only subcollection if samples present
  if (validatedSamples.length > 0) {
    try {
      await tripRef.collection('telemetry').doc('summary').set({
        tripId,
        sampleCount: validatedSamples.length,
        firstSampleTime: validatedSamples[0]?.timestamp,
        lastSampleTime: validatedSamples[validatedSamples.length - 1]?.timestamp,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Best-effort telemetry summary write
    }
  }

  // 8. Update Trip Document with authoritative verification status
  await tripRef.set(
    {
      serverVerifiedViolationsCount: detectedTriggers.length,
      serverProcessedAt: new Date().toISOString(),
      status: tripData.status === 'incomplete_signal_lost' ? 'incomplete_signal_lost' : 'completed',
    },
    { merge: true }
  );

  // 9. Record completion in idempotency ledger
  await tripLedgerRef.set({
    eventId: `trip_completion_${tripId}`,
    handler: 'processTripCompletion',
    tripId,
    vehicleRegNumber: cleanPlate,
    saccoId,
    violationsCount: detectedTriggers.length,
    processedAt: new Date().toISOString(),
  });

  return {
    success: true,
    processed: true,
    tripId,
    violationsCount: detectedTriggers.length,
    violations: createdViolations,
    latestRiskScore,
    latestRiskTier,
  };
}

/**
 * Callable Cloud Function: processTripCompletion
 * End-of-trip server-authoritative pipeline. Evaluates raw GPS telemetry,
 * persists immutable violation records, and updates vehicle risk scoring.
 */
export const processTripCompletion = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to finalize trip.');
    }

    const payload = request.data as ProcessTripCompletionPayload;
    if (!payload || !payload.tripId) {
      throw new HttpsError('invalid-argument', 'Missing tripId in request.');
    }

    const db = getFirestore();
    const role = (request.auth.token?.activeRole || request.auth.token?.role || 'passenger') as string;

    return await processTripCompletionLogic(db, payload, {
      uid: request.auth.uid,
      role,
    });
  }
);
