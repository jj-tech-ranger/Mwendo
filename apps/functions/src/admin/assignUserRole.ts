import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { APP_CHECK_ENFORCED } from '../lib/env';
import { enforceRateLimit } from '../lib/rateLimit';
import { requireMfaVerification } from '../lib/auth';

const FUNCTION_OPTIONS = {
  region: 'europe-west1',
  enforceAppCheck: APP_CHECK_ENFORCED,
};

export type ValidRole = 'admin' | 'sacco_manager' | 'authority' | 'passenger';
const VALID_ROLES: ReadonlyArray<ValidRole> = ['admin', 'sacco_manager', 'authority', 'passenger'];

export interface AssignUserRoleRequest {
  targetUid: string;
  newRole: ValidRole;
  saccoId?: string;
  authorityScope?: 'national' | 'county';
  county?: string;
  badgeNumber?: string;
  authorityId?: string;
  teamUserId?: string;
}

export interface AssignUserRoleResponse {
  success: boolean;
  targetUid: string;
  previousRole: string;
  newRole: ValidRole;
  claims: Record<string, unknown>;
}

/**
 * Validates that caller is authenticated, not suspended, and holds the admin activeRole.
 */
function verifyAdminCaller(request: CallableRequest<unknown>): { uid: string; displayName: string } {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to perform administrative actions.');
  }

  const token = request.auth.token;
  if (token.isSuspended === true) {
    throw new HttpsError('permission-denied', 'Suspended accounts cannot perform administrative actions.');
  }

  if (token.activeRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Only administrators are authorized to assign roles.');
  }

  // SEC-MFA: Authoritative backend MFA check for role assignments
  requireMfaVerification(token);

  return {
    uid: request.auth.uid,
    displayName: (token.name as string) || (token.email as string) || request.auth.uid,
  };
}

/**
 * Gen 2 Cloud Function: assignUserRole
 *
 * Server-authoritative role and claim provisioning. Admin-gated, App Check-enforced.
 * Merges Auth custom claims, revokes refresh tokens to force re-authentication,
 * synchronizes Firestore users/{targetUid}, updates pending team_users invites,
 * and records an immutable audit log entry.
 */
export const assignUserRole = onCall(FUNCTION_OPTIONS, async (request: CallableRequest<AssignUserRoleRequest>): Promise<AssignUserRoleResponse> => {
  const caller = verifyAdminCaller(request);
  const data = request.data;

  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Request data payload is required.');
  }

  const { targetUid, newRole, saccoId, authorityScope, county, badgeNumber, authorityId, teamUserId } = data;

  // 1. Validate targetUid
  if (!targetUid || typeof targetUid !== 'string' || targetUid.trim() === '') {
    throw new HttpsError('invalid-argument', 'A non-empty targetUid string is required.');
  }

  // 2. Validate newRole
  if (!newRole || !VALID_ROLES.includes(newRole)) {
    throw new HttpsError(
      'invalid-argument',
      `Invalid role '${String(newRole)}'. Permitted roles: ${VALID_ROLES.join(', ')}.`
    );
  }

  const db = getFirestore();
  const authAdmin = getAuth();

  // 3. Role-specific validation
  if (newRole === 'sacco_manager') {
    if (!saccoId || typeof saccoId !== 'string' || saccoId.trim() === '') {
      throw new HttpsError('invalid-argument', 'saccoId is required when assigning the sacco_manager role.');
    }
    const saccoSnap = await db.collection('saccos').doc(saccoId).get();
    if (!saccoSnap.exists) {
      throw new HttpsError('not-found', `SACCO with ID '${saccoId}' does not exist.`);
    }
  }

  if (newRole === 'authority') {
    if (authorityScope && authorityScope !== 'national' && authorityScope !== 'county') {
      throw new HttpsError('invalid-argument', "authorityScope must be either 'national' or 'county'.");
    }
    if (authorityScope === 'county' && (!county || typeof county !== 'string' || county.trim() === '')) {
      throw new HttpsError('invalid-argument', "county is required when authorityScope is 'county'.");
    }
  }

  // 4. Admin self-demotion lockout safeguard
  if (caller.uid === targetUid && newRole !== 'admin') {
    const adminDocs = await db.collection('users').where('activeRole', '==', 'admin').get();
    const activeAdminUids = new Set<string>();
    adminDocs.forEach((doc) => {
      const uData = doc.data();
      if (uData.isActive !== false) {
        activeAdminUids.add(doc.id);
      }
    });

    // Also check role field for any admins
    const roleAdminDocs = await db.collection('users').where('role', '==', 'admin').get();
    roleAdminDocs.forEach((doc) => {
      const uData = doc.data();
      if (uData.isActive !== false) {
        activeAdminUids.add(doc.id);
      }
    });

    if (activeAdminUids.size <= 1) {
      throw new HttpsError(
        'failed-precondition',
        'Cannot remove admin role from the sole active administrator account. Promote another admin first.'
      );
    }
  }

  // 5. Rate limiting for high-privilege operations (Max 20/hr per admin)
  await enforceRateLimit(db, caller.uid, 'role_assignment');

  // 6. Retrieve target user from Firebase Auth
  let userRecord;
  try {
    userRecord = await authAdmin.getUser(targetUid);
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    if (errorObj?.code === 'auth/user-not-found') {
      throw new HttpsError('not-found', `User with UID '${targetUid}' was not found in Firebase Authentication.`);
    }
    throw new HttpsError('internal', `Failed to retrieve user record: ${errorObj?.message || String(err)}`);
  }

  const existingClaims = (userRecord.customClaims || {}) as Record<string, unknown>;
  const previousRole = (existingClaims.activeRole as string) || 'passenger';

  // 7. Merge custom claims without clobbering existing flags (such as isSuspended)
  const updatedClaims: Record<string, unknown> = {
    ...existingClaims,
    activeRole: newRole,
  };

  if (newRole === 'sacco_manager') {
    updatedClaims.saccoId = saccoId;
    delete updatedClaims.authorityScope;
    delete updatedClaims.county;
  } else if (newRole === 'authority') {
    updatedClaims.authorityScope = authorityScope || 'national';
    if (county) {
      updatedClaims.county = county;
    } else {
      delete updatedClaims.county;
    }
    delete updatedClaims.saccoId;
  } else {
    // admin or passenger
    delete updatedClaims.saccoId;
    delete updatedClaims.authorityScope;
    delete updatedClaims.county;
  }

  // 8. Write custom claims to Firebase Auth & revoke refresh tokens
  await authAdmin.setCustomUserClaims(targetUid, updatedClaims);
  await authAdmin.revokeRefreshTokens(targetUid);

  // 9. Update Firestore users/{targetUid} document
  const userDocRef = db.collection('users').doc(targetUid);
  const nowIso = new Date().toISOString();

  const userUpdatePayload: Record<string, unknown> = {
    role: newRole,
    activeRole: newRole,
    claimedActiveRole: newRole,
    updatedAt: nowIso,
  };

  if (newRole === 'sacco_manager') {
    userUpdatePayload.saccoId = saccoId;
    userUpdatePayload.claimedSaccoId = saccoId;
    userUpdatePayload.authorityScope = null;
    userUpdatePayload.claimedAuthorityScope = null;
    userUpdatePayload.county = null;
  } else if (newRole === 'authority') {
    const resolvedScope = authorityScope || 'national';
    userUpdatePayload.authorityScope = resolvedScope;
    userUpdatePayload.claimedAuthorityScope = resolvedScope;
    if (county) userUpdatePayload.county = county;
    if (authorityId) userUpdatePayload.authorityId = authorityId;
    if (badgeNumber) userUpdatePayload.badgeNumber = badgeNumber;
    userUpdatePayload.saccoId = null;
    userUpdatePayload.claimedSaccoId = null;
  } else {
    userUpdatePayload.saccoId = null;
    userUpdatePayload.claimedSaccoId = null;
    userUpdatePayload.authorityScope = null;
    userUpdatePayload.claimedAuthorityScope = null;
    userUpdatePayload.county = null;
  }

  await userDocRef.set(userUpdatePayload, { merge: true });

  // 10. Update team_users invite if teamUserId provided
  if (teamUserId && typeof teamUserId === 'string') {
    const teamUserRef = db.collection('team_users').doc(teamUserId);
    const teamUserSnap = await teamUserRef.get();
    if (teamUserSnap.exists) {
      await teamUserRef.set(
        {
          status: 'active',
          uid: targetUid,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }
  }

  // 11. Record immutable audit log
  await db.collection('audit_logs').add({
    action: `ASSIGN_USER_ROLE (${newRole})`,
    actorName: caller.displayName,
    actorRole: 'admin',
    target: `User ID: ${targetUid}`,
    saccoId: saccoId || 'none',
    timestamp: nowIso,
    details: {
      targetUid,
      previousRole,
      newRole,
      saccoId: saccoId || null,
      authorityScope: authorityScope || null,
      county: county || null,
      teamUserId: teamUserId || null,
    },
  });

  return {
    success: true,
    targetUid,
    previousRole,
    newRole,
    claims: updatedClaims,
  };
});
