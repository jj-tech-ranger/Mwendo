import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Firestore, QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { calculateSaccoSafetyScore } from '../lib/engine';
import { APP_CHECK_ENFORCED } from '../lib/env';

export interface SaccoAnalyticsPayload {
  id: string;
  docId: string;
  saccoId: string;
  type: 'sacco';
  safetyScore: number;
  fleetCount: number;
  unresolvedComplaints: number;
  updatedAt: string;
}

export async function processRebuildSaccoAnalyticsLogic(
  db: Firestore,
  saccoId: string
): Promise<SaccoAnalyticsPayload> {
  const vehiclesSnap = await db.collection('vehicles').where('saccoId', '==', saccoId).get();
  const scores = vehiclesSnap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
    const score = d.data().riskScore;
    return typeof score === 'number' ? score : 85;
  });

  const complaintsSnap = await db
    .collection('complaints')
    .where('saccoId', '==', saccoId)
    .where('status', '==', 'open')
    .get();

  const unresolvedCount = complaintsSnap.size;
  const saccoSafetyScore = calculateSaccoSafetyScore(scores, unresolvedCount);

  // Update SACCO doc via Admin SDK
  const saccoRef = db.collection('saccos').doc(saccoId);
  const saccoSnap = await saccoRef.get();
  if (saccoSnap.exists) {
    await saccoRef.set(
      {
        safetyScore: saccoSafetyScore,
        fleetCount: vehiclesSnap.size,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  const docId = `sacco_${saccoId}`;
  const payload: SaccoAnalyticsPayload = {
    id: docId,
    docId,
    saccoId,
    type: 'sacco',
    safetyScore: saccoSafetyScore,
    fleetCount: vehiclesSnap.size,
    unresolvedComplaints: unresolvedCount,
    updatedAt: new Date().toISOString(),
  };

  // Write to analytics collection via Admin SDK
  await db.collection('analytics').doc(docId).set(payload, { merge: true });

  return payload;
}

export const rebuildSaccoAnalytics = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const saccoId = request.data?.saccoId;
    if (!saccoId || typeof saccoId !== 'string') {
      throw new HttpsError('invalid-argument', 'The saccoId string parameter must be provided.');
    }

    // Role-based multi-tenancy access check
    const role = (request.auth.token?.activeRole || request.auth.token?.role || 'passenger') as string;
    const userSaccoId = request.auth.token?.saccoId as string | undefined;

    const isPrivileged = role === 'admin' || role === 'authority';
    const isMatchingSaccoManager = role === 'sacco_manager' && userSaccoId === saccoId;

    if (!isPrivileged && !isMatchingSaccoManager) {
      throw new HttpsError(
        'permission-denied',
        'Insufficient permissions to view or rebuild analytics for this SACCO.'
      );
    }

    const db = getFirestore();
    return await processRebuildSaccoAnalyticsLogic(db, saccoId);
  }
);
