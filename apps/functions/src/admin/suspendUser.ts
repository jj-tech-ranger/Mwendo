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

export const suspendUser = onCall(
  { enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (request) => {
    const caller = await verifyAdminCaller(request.auth);
    const targetUid = request.data?.targetUid;
    const reason = request.data?.reason || 'Administrative action';

    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'The targetUid string parameter must be provided.');
    }

    const db = getFirestore();
    const authAdmin = getAuth();

    try {
      console.log(`[suspendUser] Step 1: Setting isActive=false on users/${targetUid}`);
      const targetRef = db.collection('users').doc(targetUid);
      await targetRef.set(
        {
          isActive: false,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log(`[suspendUser] Step 2: Setting isSuspended custom claim on auth uid ${targetUid}`);
      const userRecord = await authAdmin.getUser(targetUid);
      const existingClaims = userRecord.customClaims || {};
      await authAdmin.setCustomUserClaims(targetUid, {
        ...existingClaims,
        isSuspended: true,
      });

      console.log(`[suspendUser] Step 3: Revoking refresh tokens for uid ${targetUid}`);
      await authAdmin.revokeRefreshTokens(targetUid);

      console.log(`[suspendUser] Step 4: Recording audit log for suspension`);
      await db.collection('audit_logs').add({
        action: `SUSPEND_USER (${reason})`,
        actorName: caller.displayName,
        actorRole: 'admin',
        target: `User ID: ${targetUid}`,
        timestamp: new Date().toISOString(),
      });

      return { success: true, targetUid, isSuspended: true };
    } catch (err: any) {
      console.error(`[suspendUser] Error suspending user ${targetUid}:`, err);
      throw new HttpsError('internal', err.message || 'Failed to complete user suspension sequence.');
    }
  }
);

export const reactivateUser = onCall(
  { enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (request) => {
    const caller = await verifyAdminCaller(request.auth);
    const targetUid = request.data?.targetUid;

    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'The targetUid string parameter must be provided.');
    }

    const db = getFirestore();
    const authAdmin = getAuth();

    try {
      console.log(`[reactivateUser] Step 1: Setting isActive=true on users/${targetUid}`);
      const targetRef = db.collection('users').doc(targetUid);
      await targetRef.set(
        {
          isActive: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log(`[reactivateUser] Step 2: Clearing isSuspended custom claim on auth uid ${targetUid}`);
      const userRecord = await authAdmin.getUser(targetUid);
      const existingClaims = userRecord.customClaims || {};
      await authAdmin.setCustomUserClaims(targetUid, {
        ...existingClaims,
        isSuspended: false,
      });

      console.log(`[reactivateUser] Step 3: Revoking refresh tokens for uid ${targetUid}`);
      await authAdmin.revokeRefreshTokens(targetUid);

      console.log(`[reactivateUser] Step 4: Recording audit log for reactivation`);
      await db.collection('audit_logs').add({
        action: 'UNSUSPEND_USER',
        actorName: caller.displayName,
        actorRole: 'admin',
        target: `User ID: ${targetUid}`,
        timestamp: new Date().toISOString(),
      });

      return { success: true, targetUid, isSuspended: false };
    } catch (err: any) {
      console.error(`[reactivateUser] Error reactivating user ${targetUid}:`, err);
      throw new HttpsError('internal', err.message || 'Failed to complete user reactivation sequence.');
    }
  }
);
