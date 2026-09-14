import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { APP_CHECK_ENFORCED } from '../lib/env';
import { requireMfaVerification } from '../lib/auth';

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

export interface SyncPublicPinsOptions {
  forceFullScan?: boolean;
  syncFromTimestamp?: string;
}

export interface SyncPublicPinsResult {
  syncedCount: number;
  deletedCount: number;
  cursor: string;
}

export async function processSyncPublicPinsLogic(
  db: Firestore,
  options?: SyncPublicPinsOptions
): Promise<SyncPublicPinsResult> {
  const currentRunTimestamp = new Date().toISOString();
  const cursorRef = db.collection('system_config').doc('public_pins_sync');
  const cursorSnap = await cursorRef.get();
  const cursorData = cursorSnap.exists ? cursorSnap.data() : null;

  const lastSyncedAt = options?.syncFromTimestamp ?? (options?.forceFullScan ? null : (cursorData?.lastSyncedAt as string | undefined));

  let syncedCount = 0;
  let deletedCount = 0;
  const batch = db.batch();

  if (!lastSyncedAt) {
    // -------------------------------------------------------------
    // Baseline / Initial Sync:
    // Full scan executed only once (or on forced reset) to establish the cursor.
    // -------------------------------------------------------------
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
          updatedAt: data.updatedAt || currentRunTimestamp,
        },
        { merge: true }
      );
      syncedCount++;
    }

    // 2. Clean up / delete any existing public pin that is no longer published or verified
    for (const pinDoc of existingPinsSnap.docs) {
      if (!validSpotMap.has(pinDoc.id)) {
        batch.delete(pinDoc.ref);
        deletedCount++;
      }
    }

    // 3. Save initial watermark cursor
    batch.set(
      cursorRef,
      {
        lastSyncedAt: currentRunTimestamp,
        lastRunAt: currentRunTimestamp,
        syncedCountTotal: syncedCount,
      },
      { merge: true }
    );

    await batch.commit();
    return { syncedCount, deletedCount, cursor: currentRunTimestamp };
  }

  // -------------------------------------------------------------
  // Incremental Cursor-Based Sync:
  // Reads ONLY black_spots modified since lastSyncedAt.
  // Never scans the full collection or all public_pins.
  // -------------------------------------------------------------
  const changedSpotsSnap = await db
    .collection('black_spots')
    .where('updatedAt', '>', lastSyncedAt)
    .get();

  for (const doc of changedSpotsSnap.docs) {
    const data = doc.data() as BlackSpotDocData;
    const pinRef = db.collection('public_pins').doc(doc.id);

    if (data.status === 'published' || data.verifiedByAuthority === true) {
      batch.set(
        pinRef,
        {
          id: doc.id,
          title: data.name || data.title || 'Hazardous Spot',
          routeName: data.routeName || '',
          latitude: data.latitude,
          longitude: data.longitude,
          severity: data.severity || 'high',
          updatedAt: data.updatedAt || currentRunTimestamp,
        },
        { merge: true }
      );
      syncedCount++;
    } else {
      // If unverified, rejected, or archived — purge from public_pins
      const pinSnap = await pinRef.get();
      if (pinSnap.exists) {
        batch.delete(pinRef);
        deletedCount++;
      }
    }
  }

  // Update cursor with the new watermark
  batch.set(
    cursorRef,
    {
      lastSyncedAt: currentRunTimestamp,
      lastRunAt: currentRunTimestamp,
      lastDeltaSynced: syncedCount,
      lastDeltaDeleted: deletedCount,
    },
    { merge: true }
  );

  await batch.commit();

  return { syncedCount, deletedCount, cursor: currentRunTimestamp };
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

    // SEC-MFA: Authoritative backend MFA check for administrative pin synchronization
    requireMfaVerification(request.auth.token);

    const db = getFirestore();
    const data = request.data as SyncPublicPinsOptions | undefined;
    return await processSyncPublicPinsLogic(db, data);
  }
);
