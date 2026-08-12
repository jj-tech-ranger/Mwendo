import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { calculateVehicleRiskScore, RiskEvent } from '../../../../src/lib/engine';

export interface VehicleRiskEventPayload {
  eventId: string;
  vehicleRegNumber: string;
  vehicleId?: string;
  saccoId: string;
  eventType: 'violation' | 'inspection' | 'complaint' | 'overspeed' | 'accident';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recordedSpeedKmH?: number;
  speedLimitKmH?: number;
  timestamp: string;
}

export async function processVehicleRiskLogic(
  db: Firestore,
  event: VehicleRiskEventPayload
): Promise<{ processed: boolean; riskScore: number; riskTier: string }> {
  const ledgerRef = db.collection('processedEvents').doc(event.eventId);
  const ledgerSnap = await ledgerRef.get();

  if (ledgerSnap.exists) {
    return { processed: false, riskScore: 0, riskTier: 'existing' };
  }

  // Mark event as processed in ledger
  await ledgerRef.set({
    eventId: event.eventId,
    handler: 'computeVehicleRisk',
    vehicleRegNumber: event.vehicleRegNumber,
    processedAt: new Date().toISOString(),
  });

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

  // Query violations
  const violSnap = await db
    .collection('violations')
    .where('vehicleRegNumber', '==', event.vehicleRegNumber)
    .get();

  const eventsList: RiskEvent[] = violSnap.docs.map((d: any) => ({
    severity: (d.data().severity || 'low') as any,
    timestamp: d.data().timestamp || new Date().toISOString(),
  }));

  eventsList.push({
    severity: event.severity as any,
    timestamp: event.timestamp,
  });

  // Query trips count
  const tripsSnap = await db
    .collection('trips')
    .where('vehicleRegNumber', '==', event.vehicleRegNumber)
    .get();

  const totalTripCount = tripsSnap.size || 1;

  const { riskScore, riskTier } = calculateVehicleRiskScore(eventsList, totalTripCount);

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

export const computeVehicleRisk = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  const event = request.data as VehicleRiskEventPayload;
  if (!event || !event.eventId || !event.vehicleRegNumber) {
    throw new HttpsError('invalid-argument', 'Missing required event fields.');
  }
  const db = getFirestore();
  return await processVehicleRiskLogic(db, event);
});
