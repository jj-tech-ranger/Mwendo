import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

export async function processSyncPublicPinsLogic(
  db: Firestore
): Promise<{ syncedCount: number }> {
  const spotsSnap = await db
    .collection('black_spots')
    .where('verifiedByAuthority', '==', true)
    .get();

  let count = 0;
  const batch = db.batch();

  for (const spotDoc of spotsSnap.docs) {
    const data = spotDoc.data();
    // SEC-005: Only copy spots with verifiedByAuthority: true / status: 'published'.
    // MUST NEVER copy reportedByUid or PII.
    if (data.status === 'published' || data.verifiedByAuthority === true) {
      const pinRef = db.collection('public_pins').doc(spotDoc.id);
      batch.set(
        pinRef,
        {
          id: spotDoc.id,
          title: data.name || data.title || 'Hazardous Spot',
          routeName: data.routeName || '',
          latitude: data.latitude,
          longitude: data.longitude,
          severity: data.severity,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  return { syncedCount: count };
}

export const syncPublicPins = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  const db = getFirestore();
  return await processSyncPublicPinsLogic(db);
});
