import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { APP_CHECK_ENFORCED } from '../lib/env';

const CERTIFICATE_VALIDITY_DAYS = 365;

export interface CreateInspectionPayload {
  vehicleId: string;
  saccoId: string;
  inspectionType?: 'routine' | 'spot_check' | 'follow_up';
  result: 'pass' | 'fail' | 'conditional';
  notes?: string;
  inspectionDate?: string;
}

export interface CreateInspectionResult {
  success: true;
  inspectionId: string;
  certificateNumber: string;
  expiryDate: string;
  createdAt: string;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `${field} is required.`);
  }

  return value.trim();
}

function resolveAuthorityRole(token: Record<string, unknown> | undefined): string {
  return String(token?.activeRole || token?.role || '');
}

function generateCertificateNumber(inspectionId: string, now: Date): string {
  const year = now.getUTCFullYear();
  const suffix = inspectionId.replace(/-/g, '').slice(-8).toUpperCase();
  return `MWD-${year}-${suffix}`;
}

export async function processCreateInspectionLogic(
  db: Firestore,
  payload: CreateInspectionPayload,
  inspectorId: string,
  inspectorRole: string
): Promise<CreateInspectionResult> {
  if (inspectorRole !== 'authority' && inspectorRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Only authority officers or administrators can create inspections.');
  }

  const vehicleId = requireNonEmptyString(payload.vehicleId, 'vehicleId');
  const saccoId = requireNonEmptyString(payload.saccoId, 'saccoId');

  if (!['pass', 'fail', 'conditional'].includes(payload.result)) {
    throw new HttpsError('invalid-argument', 'result must be pass, fail, or conditional.');
  }

  if (payload.inspectionType && !['routine', 'spot_check', 'follow_up'].includes(payload.inspectionType)) {
    throw new HttpsError('invalid-argument', 'inspectionType is invalid.');
  }

  const [vehicleSnapshot, saccoSnapshot] = await Promise.all([
    db.collection('vehicles').doc(vehicleId).get(),
    db.collection('saccos').doc(saccoId).get(),
  ]);

  if (!vehicleSnapshot.exists) {
    throw new HttpsError('not-found', 'The selected vehicle does not exist.');
  }

  if (!saccoSnapshot.exists) {
    throw new HttpsError('not-found', 'The selected SACCO does not exist.');
  }

  const vehicle = vehicleSnapshot.data() || {};
  if (vehicle.saccoId !== saccoId) {
    throw new HttpsError('failed-precondition', 'The selected vehicle does not belong to the selected SACCO.');
  }

  const now = new Date();
  const createdAt = now.toISOString();
  const expiry = new Date(now.getTime() + CERTIFICATE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  const inspectionRef = db.collection('inspections').doc();
  const inspectionId = inspectionRef.id;
  const certificateNumber = generateCertificateNumber(inspectionId, now);
  const sacco = saccoSnapshot.data() || {};

  const inspection = {
    id: inspectionId,
    inspectionId,
    vehicleId,
    saccoId,
    saccoName: typeof sacco.name === 'string' ? sacco.name : undefined,
    inspectorId,
    inspectionType: payload.inspectionType || 'routine',
    result: payload.result,
    notes: typeof payload.notes === 'string' ? payload.notes.trim() : '',
    inspectionDate: typeof payload.inspectionDate === 'string' && payload.inspectionDate.trim()
      ? payload.inspectionDate.trim()
      : createdAt,
    certificateNumber,
    expiryDate: expiry.toISOString(),
    createdAt,
    updatedAt: createdAt,
  };

  const auditRef = db.collection('audit_logs').doc();

  await db.runTransaction(async (transaction) => {
    transaction.create(inspectionRef, inspection);
    transaction.create(auditRef, {
      id: auditRef.id,
      action: 'CREATE_INSPECTION',
      actorId: inspectorId,
      actorRole: inspectorRole,
      target: `Inspection ${inspectionId}`,
      timestamp: createdAt,
      details: {
        inspectionId,
        vehicleId,
        saccoId,
        result: payload.result,
        certificateNumber,
      },
    });
  });

  return {
    success: true,
    inspectionId,
    certificateNumber,
    expiryDate: expiry.toISOString(),
    createdAt,
  };
}

export const createInspection = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'An authenticated authority session is required.');
    }

    const inspectorRole = resolveAuthorityRole(request.auth.token as Record<string, unknown> | undefined);
    return processCreateInspectionLogic(
      getFirestore(),
      request.data as CreateInspectionPayload,
      request.auth.uid,
      inspectorRole
    );
  }
);
