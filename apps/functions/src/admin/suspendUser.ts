import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Verify caller is an active admin by inspecting Firestore users/{uid} and Auth token claims.
 */
async function verifyAdminCaller(auth: any): Promise<{ uid: string; displayName: string }> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const callerUid = auth.uid;
  const tokenClaimRole = auth.token?.activeRole;

  // Live Firestore check
  const db = getFirestore();
  const userSnap = await db.collection('users').doc(callerUid).get();
  
  if (!userSnap.exists) {
    throw new HttpsError('permission-denied', 'Caller user record not found in Firestore.');
  }

  const userData = userSnap.data() || {};
  const isDocAdmin = userData.role === 'admin' || userData.activeRole === 'admin';
  const isClaimAdmin = tokenClaimRole === 'admin';

  if (!isDocAdmin && !isClaimAdmin) {
    throw new HttpsError('permission-denied', 'Caller does not possess administrative privileges.');
  }

  return {
    uid: callerUid,
    displayName: userData.displayName || auth.token?.name || 'System Admin',
  };
}

export const suspendUser = onCall(async (request) => {
  const caller = await verifyAdminCaller(request.auth);
  const targetUid = request.data?.targetUid;
  const reason = request.data?.reason || 'Administrative action';

  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'The targetUid string parameter must be provided.');
  }

  const db = getFirestore();
  const authAdmin = getAuth();

  // 1. Write Firestore isActive = false
  const targetRef = db.collection('users').doc(targetUid);
  await targetRef.set(
    {
      isActive: false,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  // 2. Set custom claim isSuspended: true
  const userRecord = await authAdmin.getUser(targetUid);
  const existingClaims = userRecord.customClaims || {};
  await authAdmin.setCustomUserClaims(targetUid, {
    ...existingClaims,
    isSuspended: true,
  });

  // 3. Revoke active refresh tokens
  await authAdmin.revokeRefreshTokens(targetUid);

  // 4. Record audit log
  await db.collection('audit_logs').add({
    action: `SUSPEND_USER (${reason})`,
    actorName: caller.displayName,
    actorRole: 'admin',
    target: `User ID: ${targetUid}`,
    timestamp: new Date().toISOString(),
  });

  return { success: true, targetUid, isSuspended: true };
});

export const reactivateUser = onCall(async (request) => {
  const caller = await verifyAdminCaller(request.auth);
  const targetUid = request.data?.targetUid;

  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'The targetUid string parameter must be provided.');
  }

  const db = getFirestore();
  const authAdmin = getAuth();

  // 1. Write Firestore isActive = true
  const targetRef = db.collection('users').doc(targetUid);
  await targetRef.set(
    {
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  // 2. Set custom claim isSuspended: false
  const userRecord = await authAdmin.getUser(targetUid);
  const existingClaims = userRecord.customClaims || {};
  await authAdmin.setCustomUserClaims(targetUid, {
    ...existingClaims,
    isSuspended: false,
  });

  // 3. Revoke active refresh tokens
  await authAdmin.revokeRefreshTokens(targetUid);

  // 4. Record audit log
  await db.collection('audit_logs').add({
    action: 'UNSUSPEND_USER',
    actorName: caller.displayName,
    actorRole: 'admin',
    target: `User ID: ${targetUid}`,
    timestamp: new Date().toISOString(),
  });

  return { success: true, targetUid, isSuspended: false };
});
