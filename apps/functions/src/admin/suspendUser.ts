import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { APP_CHECK_ENFORCED } from '../lib/env';

/**
 * Verify caller is an active admin by inspecting Auth token claims.
 * SEC-004 & SEC-009: Auth custom claims (auth.token.activeRole === 'admin') are the sole source
 * of truth for authorization. Firestore document fields (role/activeRole) are display-only and
 * must never grant administrative privileges.
 */
async function verifyAdminCaller(auth: any): Promise<{ uid: string; displayName: string }> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const callerUid = auth.uid;
  const tokenClaimRole = auth.token?.activeRole;

  // SEC-004: Custom claim is the sole authorization source
  if (tokenClaimRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Caller does not possess administrative privileges.');
  }

  let displayName = auth.token?.name || 'System Admin';

  try {
    // Read Firestore document only for displayName in audit logging if available
    const db = getFirestore();
    const userSnap = await db.collection('users').doc(callerUid).get();
    if (userSnap.exists) {
      const userData = userSnap.data() || {};
      if (userData.displayName) {
        displayName = userData.displayName;
      }
    }
  } catch {
    // Fallback gracefully to token name / default without blocking admin execution
  }

  return {
    uid: callerUid,
    displayName,
  };
}

export const suspendUser = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED },
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
  { enforceAppCheck: APP_CHECK_ENFORCED },
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
