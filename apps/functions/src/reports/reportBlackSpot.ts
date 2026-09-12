import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { enforceRateLimit } from '../lib/rateLimit';
import { ConfidenceScorer } from '../lib/engine';
import { isWithinKenya } from '../lib/constants';

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

function boundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
}

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
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isWithinKenya(lat, lng)) {
    throw new HttpsError('invalid-argument', 'A valid location is required.');
  }
  if (payload.title !== undefined && !boundedText(payload.title, 120)) {
    throw new HttpsError('invalid-argument', 'Title must be 120 characters or fewer.');
  }
  if (payload.description !== undefined && !boundedText(payload.description, 2000)) {
    throw new HttpsError('invalid-argument', 'Description must be 2000 characters or fewer.');
  }
  if (payload.locationName !== undefined && !boundedText(payload.locationName, 160)) {
    throw new HttpsError('invalid-argument', 'Location name is too long.');
  }
  if (payload.routeName !== undefined && !boundedText(payload.routeName, 160)) {
    throw new HttpsError('invalid-argument', 'Route name is too long.');
  }
  if (payload.county !== undefined && !boundedText(payload.county, 80)) {
    throw new HttpsError('invalid-argument', 'County is too long.');
  }
  if (payload.hazardType !== undefined && !boundedText(payload.hazardType, 80)) {
    throw new HttpsError('invalid-argument', 'Hazard type is invalid.');
  }
  if (payload.severity !== undefined && !['low', 'medium', 'high', 'critical'].includes(payload.severity)) {
    throw new HttpsError('invalid-argument', 'Invalid hazard severity.');
  }

  await enforceRateLimit(db, userId, 'black_spot');

  // Fetch reporter's trustScore from users collection to calculate dynamic hazard confidence
  let reporterTrustScore = 0.5; // default sane baseline
  try {
    const userDocSnap = await db.collection('users').doc(userId).get();
    if (userDocSnap.exists) {
      const userData = userDocSnap.data();
      const rawTrust = userData?.trustScore;
      if (typeof rawTrust === 'number' && Number.isFinite(rawTrust)) {
        // Normalize 0-100 scale down to 0-1 if necessary
        reporterTrustScore = rawTrust > 1.0
          ? Math.min(1.0, Math.max(0.0, rawTrust / 100))
          : Math.min(1.0, Math.max(0.0, rawTrust));
      }
    }
  } catch (err) {
    console.warn(`[reportBlackSpot] Could not load trustScore for user ${userId}, using default:`, err);
  }

  const hasEvidencePhoto = Boolean(
    payload.photoUrl && typeof payload.photoUrl === 'string' && payload.photoUrl.trim().length > 0
  );

  // Use ConfidenceScorer.calculateHazardConfidence with corroborationCount = 1 (pending deduplication feature)
  const confidenceScore = ConfidenceScorer.calculateHazardConfidence(
    1,
    reporterTrustScore,
    hasEvidencePhoto
  );

  const spotId = payload.id && /^bs_[A-Za-z0-9_-]{1,100}$/.test(payload.id)
    ? payload.id
    : `bs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const docData = {
    id: spotId,
    spotId,
    title: payload.title?.trim() || 'Road Hazard',
    name: payload.title?.trim() || payload.locationName?.trim() || 'Road Hazard',
    description: payload.description?.trim() || '',
    hazardDescription: payload.description?.trim() || payload.title?.trim() || 'Road Hazard',
    hazardType: payload.hazardType || 'accident_prone',
    severity: payload.severity || 'high',
    locationName: payload.locationName?.trim() || '',
    routeName: payload.routeName?.trim() || payload.locationName?.trim() || 'Kenyan Highway',
    county: payload.county?.trim() || 'Nairobi',
    latitude: lat,
    longitude: lng,
    location: { lat, lng },
    photoUrl: payload.photoUrl || undefined,
    reportedByUid: userId,
    reportedByUserId: userId,
    reportedByDisplayName: payload.reportedByDisplayName?.trim().slice(0, 120) || 'Commuter',
    status: 'pending',
    corroborationCount: 1,
    corroborationsCount: 1,
    confidenceScore,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('black_spots').doc(spotId).set(docData, { merge: false });
  await db.collection('audit_logs').doc(`audit_${spotId}`).set({
    id: `audit_${spotId}`,
    action: 'REPORT_BLACK_SPOT',
    actorUid: userId,
    actorName: docData.reportedByDisplayName,
    actorRole: 'passenger',
    target: `Black Spot ${spotId} (${docData.title})`,
    timestamp: now,
    details: { spotId, hazardType: docData.hazardType, severity: docData.severity, location: { lat, lng } },
  });

  return { success: true, spotId, title: docData.title, status: 'pending', createdAt: now };
}

export const reportBlackSpot = onCall({ enforceAppCheck: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Caller must be authenticated to report a road hazard.');
  }

  const db = getFirestore();
  const userId = request.auth.uid;
  const payload: ReportBlackSpotPayload = { ...request.data, reportedByUid: userId };

  try {
    return await processReportBlackSpotLogic(db, payload, userId);
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    console.error('[reportBlackSpot] Execution failed:', err);
    throw new HttpsError('internal', 'Black spot submission failed.');
  }
});
