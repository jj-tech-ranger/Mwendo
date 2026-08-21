import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { APP_CHECK_ENFORCED } from '../lib/env';

interface BlackSpotDocData {
  status?: string;
  verifiedByAuthority?: boolean;
  name?: string;
  title?: string;
  routeName?: string;
  latitude?: number;
  longitude?: number;
  severity?: string;
  [key: string]: unknown;
}

export async function processSyncPublicPinsLogic(
  db: Firestore
): Promise<{ syncedCount: number; deletedCount: number }> {
  const [spotsSnap, existingPinsSnap] = await Promise.all([
    db.collection('black_spots').get(),
    db.collection('public_pins').get(),
  ]);

  const validSpotMap = new Map<string, BlackSpotDocData>();
  for (const spotDoc of spotsSnap.docs) {
    const data = spotDoc.data() as BlackSpotDocData;
    if (data.status === 'published' || data.verifiedByAuthority === true) {
      validSpotMap.set(spotDoc.id, data);
    }
  }

  let syncedCount = 0;
  let deletedCount = 0;
  const batch = db.batch();

  // 1. Upsert all currently valid published black spots into public_pins
  for (const [spotId, data] of validSpotMap.entries()) {
    const pinRef = db.collection('public_pins').doc(spotId);
    batch.set(
      pinRef,
      {
        id: spotId,
        title: data.name || data.title || 'Hazardous Spot',
        routeName: data.routeName || '',
        latitude: data.latitude,
        longitude: data.longitude,
        severity: data.severity || 'high',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    syncedCount++;
  }

  // 2. CF-005: Clean up / delete any existing public pin that is no longer published or verified
  for (const pinDoc of existingPinsSnap.docs) {
    if (!validSpotMap.has(pinDoc.id)) {
      batch.delete(pinDoc.ref);
      deletedCount++;
    }
  }

  if (syncedCount > 0 || deletedCount > 0) {
    await batch.commit();
  }

  return { syncedCount, deletedCount };
}

export const syncPublicPins = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const role = (request.auth.token?.activeRole || request.auth.token?.role || 'passenger') as string;
    if (role !== 'admin' && role !== 'authority') {
      throw new HttpsError(
        'permission-denied',
        'Only administrative or authority staff can synchronize public pins.'
      );
    }

    const db = getFirestore();
    return await processSyncPublicPinsLogic(db);
  }
);
