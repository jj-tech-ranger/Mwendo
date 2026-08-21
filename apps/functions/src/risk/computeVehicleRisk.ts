import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Firestore, QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { calculateVehicleRiskScore, RiskEvent } from '../lib/engine';
import { APP_CHECK_ENFORCED } from '../lib/env';

export interface VehicleRiskEventPayload {
  eventId: string;
  vehicleRegNumber: string;
  vehicleId?: string;
  saccoId: string;
  eventType: 'violation' | 'inspection' | 'complaint' | 'overspeed' | 'accident';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recordedSpeedKmH?: number;
  speedLimitKmH?: number;
  confidenceScore?: number;
  timestamp: string;
}

function parseSeverity(val: unknown): 'low' | 'medium' | 'high' | 'critical' {
  if (val === 'medium' || val === 'high' || val === 'critical') {
    return val;
  }
  return 'low';
}

interface ViolationCandidate extends RiskEvent {
  recordedSpeedKmH?: number;
}

export async function processVehicleRiskLogic(
  db: Firestore,
  event: VehicleRiskEventPayload
): Promise<{ processed: boolean; riskScore: number; riskTier: string }> {
  const ledgerRef = db.collection('processedEvents').doc(event.eventId);

  // Use a Firestore transaction for atomic idempotency check and write
  const shouldProcess = await db.runTransaction(async (transaction) => {
    const ledgerSnap = await transaction.get(ledgerRef);
    if (ledgerSnap.exists) {
      return false;
    }
    transaction.set(ledgerRef, {
      eventId: event.eventId,
      handler: 'computeVehicleRisk',
      vehicleRegNumber: event.vehicleRegNumber,
      processedAt: new Date().toISOString(),
    });
    return true;
  });

  if (!shouldProcess) {
    return { processed: false, riskScore: 0, riskTier: 'existing' };
  }

  const vehicleId = event.vehicleId || event.vehicleRegNumber.replace(/\s+/g, '_');
  const vehicleRef = db.collection('vehicles').doc(vehicleId);
  const vehicleSnap = await vehicleRef.get();

  if (!vehicleSnap.exists) {
    await vehicleRef.set({
      id: vehicleId,
      regNumber: event.vehicleRegNumber,
      saccoId: event.saccoId || 'unassigned',
      saccoName: event.saccoId === 'unassigned' ? 'Independent / Unassigned' : event.saccoId,
      capacity: 14,
      status: 'active',
      isProvisional: true,
      riskScore: 85,
      riskTier: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Query violations with bounded limit to prevent unbounded collection scans
  const violSnap = await db
    .collection('violations')
    .where('vehicleRegNumber', '==', event.vehicleRegNumber)
    .limit(200)
    .get();

  const nowMs = Date.now();
  const eventsList: RiskEvent[] = violSnap.docs
    .map((d: QueryDocumentSnapshot<DocumentData>): ViolationCandidate => {
      const data = d.data();
      return {
        severity: parseSeverity(data.severity),
        timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
        confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 1.0,
        recordedSpeedKmH: typeof data.recordedSpeedKmH === 'number' ? data.recordedSpeedKmH : undefined,
      };
    })
    .filter((e: ViolationCandidate) => {
      // VT-003: Plausibility checks - discard physically impossible speeds (>180 km/h) or invalid timestamps
      if (e.recordedSpeedKmH !== undefined && (e.recordedSpeedKmH < 0 || e.recordedSpeedKmH > 180)) {
        return false;
      }
      const t = new Date(e.timestamp).getTime();
      return Number.isFinite(t);
    });

  // Validate incoming event plausibility
  const incomingTimeMs = new Date(event.timestamp).getTime();
  if (
    Number.isFinite(incomingTimeMs) &&
    (event.recordedSpeedKmH === undefined || (event.recordedSpeedKmH >= 0 && event.recordedSpeedKmH <= 180))
  ) {
    eventsList.push({
      severity: parseSeverity(event.severity),
      timestamp: event.timestamp,
      confidenceScore: typeof event.confidenceScore === 'number' ? event.confidenceScore : 1.0,
    });
  }

  // Query trips count with limit
  const tripsSnap = await db
    .collection('trips')
    .where('vehicleRegNumber', '==', event.vehicleRegNumber)
    .limit(100)
    .get();

  const totalTripCount = tripsSnap.size || 1;

  const { riskScore, riskTier } = calculateVehicleRiskScore(eventsList, totalTripCount, nowMs);

  // Update vehicle score (Admin SDK bypasses Security Rules)
  await vehicleRef.set(
    {
      riskScore,
      riskTier,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  // Record audit log
  await db.collection('audit_logs').add({
    action: 'COMPUTE_VEHICLE_RISK',
    actorName: 'System (Cloud Function)',
    actorRole: 'system',
    target: event.vehicleRegNumber,
    saccoId: event.saccoId,
    timestamp: new Date().toISOString(),
    details: { eventId: event.eventId, riskScore, riskTier, totalEvents: eventsList.length },
  });

  return { processed: true, riskScore, riskTier };
}

export const computeVehicleRisk = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const event = request.data as VehicleRiskEventPayload;
    if (!event || !event.eventId || !event.vehicleRegNumber) {
      throw new HttpsError('invalid-argument', 'Missing required event fields.');
    }

    // Role and tenancy authorization check
    const role = (request.auth.token?.activeRole || request.auth.token?.role || 'passenger') as string;
    const userSaccoId = request.auth.token?.saccoId as string | undefined;

    if (role === 'sacco_manager' && userSaccoId && event.saccoId && userSaccoId !== event.saccoId) {
      throw new HttpsError('permission-denied', 'Cannot compute risk for a different SACCO.');
    }

    const db = getFirestore();
    return await processVehicleRiskLogic(db, event);
  }
);
