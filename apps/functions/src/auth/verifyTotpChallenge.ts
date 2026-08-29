import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as crypto from 'crypto';

export function base32Decode(base32Str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0; let value = 0; let index = 0;
  const clean = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  const output = new Uint8Array(Math.floor((clean.length * 5) / 8));
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i] ?? '');
    if (val === -1) throw new Error('Invalid base32 character.');
    value = (value << 5) | val; bits += 5;
    if (bits >= 8) { output[index++] = (value >>> (bits - 8)) & 255; bits -= 8; }
  }
  return Buffer.from(output);
}

export function generateTotpToken(secretBase32: string, timestampMs = Date.now(), stepSec = 30, digits = 6): string {
  const key = base32Decode(secretBase32);
  const timeStep = Math.floor(timestampMs / 1000 / stepSec);
  const buf = Buffer.alloc(8); buf.writeBigInt64BE(BigInt(timeStep));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const code = (((hmac[offset] ?? 0) & 0x7f) << 24) | ((hmac[offset + 1] ?? 0) << 16) | ((hmac[offset + 2] ?? 0) << 8) | (hmac[offset + 3] ?? 0);
  return (code % 10 ** digits).toString().padStart(digits, '0');
}

export function verifyTotpToken(secretBase32: string, token: string, windowSteps = 1, timestampMs = Date.now()): boolean {
  const cleanToken = token.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;
  for (let w = -windowSteps; w <= windowSteps; w++) {
    if (generateTotpToken(secretBase32, timestampMs + w * 30_000) === cleanToken) return true;
  }
  return false;
}

export const verifyTotpChallenge = onCall({ enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  const callerUid = request.auth.uid;
  const rawCode = request.data?.code;
  if (typeof rawCode !== 'string') throw new HttpsError('invalid-argument', 'The code string parameter must be provided.');
  const cleanCode = rawCode.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) throw new HttpsError('invalid-argument', 'Verification code must be exactly 6 digits.');

  const db = getFirestore();
  const authAdmin = getAuth();
  const userRef = db.collection('users').doc(callerUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User record not found in Firestore.');
  const userData = userSnap.data() || {};
  const secretKey = typeof userData.totpSecret === 'string' ? userData.totpSecret : typeof userData.mfaSecret === 'string' ? userData.mfaSecret : '';

  if (!secretKey) {
    const authUser = await authAdmin.getUser(callerUid);
    if (!authUser.multiFactor?.enrolledFactors?.length) throw new HttpsError('failed-precondition', 'User has no enrolled MFA factors.');
    throw new HttpsError('failed-precondition', 'No server-side TOTP secret is configured for this account.');
  }

  if (!verifyTotpToken(secretKey, cleanCode)) throw new HttpsError('invalid-argument', 'Invalid 6-digit TOTP verification code.');

  await userRef.set({ isMfaVerified: true, isMfaEnrolled: true, updatedAt: new Date().toISOString() }, { merge: true });
  await db.collection('audit_logs').add({
    action: 'MFA_CHALLENGE_VERIFIED', actorUid: callerUid,
    actorName: userData.displayName || request.auth.token?.name || 'User',
    actorRole: request.auth.token?.activeRole || 'user', timestamp: new Date().toISOString(),
  });
  return { success: true, verified: true };
});
