import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';

export interface RegisterTokenPayload {
  token: string;
  platform?: string | undefined;
}

export interface UnregisterTokenPayload {
  token: string;
}

export function sanitizeTokenId(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex').slice(0, 32);
}

export async function processRegisterToken(
  db: Firestore,
  userId: string,
  payload: RegisterTokenPayload
): Promise<{ success: boolean; tokenId: string }> {
  if (!userId) {
    throw new HttpsError('unauthenticated', 'Caller must be authenticated to register an FCM device token.');
  }

  const token = typeof payload.token === 'string' ? payload.token.trim() : '';
  if (!token || token.length < 10 || token.length > 500) {
    throw new HttpsError('invalid-argument', 'A valid FCM registration token (10-500 characters) is required.');
  }

  const platform = typeof payload.platform === 'string' && payload.platform.length <= 32 ? payload.platform.trim() : 'web';
  const tokenId = sanitizeTokenId(token);
  const now = new Date().toISOString();

  // Persist into user's private fcm_tokens subcollection
  const tokenDocRef = db.collection('users').doc(userId).collection('fcm_tokens').doc(tokenId);
  await tokenDocRef.set(
    {
      id: tokenId,
      token,
      platform,
      userId,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    },
    { merge: true }
  );

  // Maintain primary fcmToken attribute on users/{userId} for fast server lookup
  await db.collection('users').doc(userId).set(
    {
      fcmToken: token,
      updatedAt: now,
    },
    { merge: true }
  );

  return { success: true, tokenId };
}

export async function processUnregisterToken(
  db: Firestore,
  userId: string,
  payload: UnregisterTokenPayload
): Promise<{ success: boolean }> {
  if (!userId) {
    throw new HttpsError('unauthenticated', 'Caller must be authenticated to unregister an FCM device token.');
  }

  const token = typeof payload.token === 'string' ? payload.token.trim() : '';
  if (!token) {
    throw new HttpsError('invalid-argument', 'Token string is required.');
  }

  const tokenId = sanitizeTokenId(token);
  const tokenDocRef = db.collection('users').doc(userId).collection('fcm_tokens').doc(tokenId);
  await tokenDocRef.delete();

  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (userSnap.exists && userSnap.data()?.fcmToken === token) {
    await userRef.update({ fcmToken: null });
  }

  return { success: true };
}

export const registerDeviceToken = onCall({ enforceAppCheck: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Caller must be authenticated to register an FCM device token.');
  }
  return processRegisterToken(getFirestore(), request.auth.uid, request.data);
});

export const unregisterDeviceToken = onCall({ enforceAppCheck: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Caller must be authenticated to unregister an FCM device token.');
  }
  return processUnregisterToken(getFirestore(), request.auth.uid, request.data);
});
