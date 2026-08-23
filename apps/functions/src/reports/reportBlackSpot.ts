import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { enforceRateLimit } from '../lib/rateLimit';

export interface ReportBlackSpotPayload {
  id?: string;
  title?: string;
  description?: string;
  hazardType?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  locationName?: string;
  routeName?: string;
  county?: string;
  location?: { lat: number; lng: number };
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  reportedByUid?: string;
  reportedByDisplayName?: string;
}

export interface ReportBlackSpotResult {
  success: boolean;
  spotId: string;
  title: string;
  status: string;
  createdAt: string;
}

/**
 * Core business logic for submitting a black-spot report with rate limiting
 */
export async function processReportBlackSpotLogic(
  db: Firestore,
  payload: ReportBlackSpotPayload,
  userId: string
): Promise<ReportBlackSpotResult> {
  if (!userId || userId === 'anonymous') {
    throw new HttpsError('unauthenticated', 'User must be authenticated to report a road hazard.');
  }

  const lat = payload.location?.lat ?? payload.latitude;
  const lng = payload.location?.lng ?? payload.longitude;

  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    throw new HttpsError('invalid-argument', 'A valid location is required.');
  }

  // 1. SEC-005: Enforce rate limit (Max 10 hazard reports per 24h)
  if (typeof db.runTransaction === 'function') {
    await enforceRateLimit(db, userId, 'black_spot');
  }

  const spotId = payload.id || `bs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const docData = {
    id: spotId,
    spotId,
    title: payload.title || 'Road Hazard',
    name: payload.title || payload.locationName || 'Road Hazard',
    description: payload.description || '',
    hazardDescription: payload.description || payload.title || 'Road Hazard',
    hazardType: payload.hazardType || 'accident_prone',
    severity: payload.severity || 'high',
    locationName: payload.locationName || '',
    routeName: payload.routeName || payload.locationName || 'Kenyan Highway',
    county: payload.county || 'Nairobi',
    latitude: lat,
    longitude: lng,
    location: { lat, lng },
    photoUrl: payload.photoUrl || undefined,
    reportedByUid: userId,
    reportedByUserId: userId,
    reportedByDisplayName: payload.reportedByDisplayName || 'Commuter',
    status: 'pending',
    corroborationCount: 1,
    corroborationsCount: 1,
    confidenceScore: 0.8,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('black_spots').doc(spotId).set(docData, { merge: true });

  // Record audit log
  await db.collection('audit_logs').doc(`audit_${spotId}`).set({
    id: `audit_${spotId}`,
    action: 'REPORT_BLACK_SPOT',
    actorName: payload.reportedByDisplayName || 'Commuter',
    actorRole: 'passenger',
    target: `Black Spot ${spotId} (${docData.title})`,
    timestamp: now,
    details: {
      spotId,
      hazardType: docData.hazardType,
      severity: docData.severity,
      location: { lat, lng },
    },
  });

  return {
    success: true,
    spotId,
    title: docData.title,
    status: 'pending',
    createdAt: now,
  };
}

/**
 * Cloud Function: reportBlackSpot
 */
export const reportBlackSpot = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Caller must be authenticated to report a road hazard.');
  }

  const db = getFirestore();
  const userId = request.auth.uid;
  const payload: ReportBlackSpotPayload = {
    ...request.data,
    reportedByUid: userId,
  };

  try {
    return await processReportBlackSpotLogic(db, payload, userId);
  } catch (err: unknown) {
    if (err instanceof HttpsError) {
      throw err;
    }
    console.error('[reportBlackSpot] Execution failed:', err);
    const message = err instanceof Error ? err.message : 'Black spot submission failed.';
    throw new HttpsError('internal', message);
  }
});
