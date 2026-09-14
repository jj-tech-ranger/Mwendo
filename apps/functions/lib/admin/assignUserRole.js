"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignUserRole = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const env_1 = require("../lib/env");
const rateLimit_1 = require("../lib/rateLimit");
const FUNCTION_OPTIONS = {
    region: 'europe-west1',
    enforceAppCheck: env_1.APP_CHECK_ENFORCED,
};
const VALID_ROLES = ['admin', 'sacco_manager', 'authority', 'passenger'];
/**
 * Validates that caller is authenticated, not suspended, and holds the admin activeRole.
 */
function verifyAdminCaller(request) {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in to perform administrative actions.');
    }
    const token = request.auth.token;
    if (token.isSuspended === true) {
        throw new https_1.HttpsError('permission-denied', 'Suspended accounts cannot perform administrative actions.');
    }
    if (token.activeRole !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Only administrators are authorized to assign roles.');
    }
    return {
        uid: request.auth.uid,
        displayName: token.name || token.email || request.auth.uid,
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
exports.assignUserRole = (0, https_1.onCall)(FUNCTION_OPTIONS, async (request) => {
    const caller = verifyAdminCaller(request);
    const data = request.data;
    if (!data || typeof data !== 'object') {
        throw new https_1.HttpsError('invalid-argument', 'Request data payload is required.');
    }
    const { targetUid, newRole, saccoId, authorityScope, county, badgeNumber, authorityId, teamUserId } = data;
    // 1. Validate targetUid
    if (!targetUid || typeof targetUid !== 'string' || targetUid.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'A non-empty targetUid string is required.');
    }
    // 2. Validate newRole
    if (!newRole || !VALID_ROLES.includes(newRole)) {
        throw new https_1.HttpsError('invalid-argument', `Invalid role '${String(newRole)}'. Permitted roles: ${VALID_ROLES.join(', ')}.`);
    }
    const db = (0, firestore_1.getFirestore)();
    const authAdmin = (0, auth_1.getAuth)();
    // 3. Role-specific validation
    if (newRole === 'sacco_manager') {
        if (!saccoId || typeof saccoId !== 'string' || saccoId.trim() === '') {
            throw new https_1.HttpsError('invalid-argument', 'saccoId is required when assigning the sacco_manager role.');
        }
        const saccoSnap = await db.collection('saccos').doc(saccoId).get();
        if (!saccoSnap.exists) {
            throw new https_1.HttpsError('not-found', `SACCO with ID '${saccoId}' does not exist.`);
        }
    }
    if (newRole === 'authority') {
        if (authorityScope && authorityScope !== 'national' && authorityScope !== 'county') {
            throw new https_1.HttpsError('invalid-argument', "authorityScope must be either 'national' or 'county'.");
        }
        if (authorityScope === 'county' && (!county || typeof county !== 'string' || county.trim() === '')) {
            throw new https_1.HttpsError('invalid-argument', "county is required when authorityScope is 'county'.");
        }
    }
    // 4. Admin self-demotion lockout safeguard
    if (caller.uid === targetUid && newRole !== 'admin') {
        const adminDocs = await db.collection('users').where('activeRole', '==', 'admin').get();
        const activeAdminUids = new Set();
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
            throw new https_1.HttpsError('failed-precondition', 'Cannot remove admin role from the sole active administrator account. Promote another admin first.');
        }
    }
    // 5. Rate limiting for high-privilege operations (Max 20/hr per admin)
    await (0, rateLimit_1.enforceRateLimit)(db, caller.uid, 'role_assignment');
    // 6. Retrieve target user from Firebase Auth
    let userRecord;
    try {
        userRecord = await authAdmin.getUser(targetUid);
    }
    catch (err) {
        const errorObj = err;
        if (errorObj?.code === 'auth/user-not-found') {
            throw new https_1.HttpsError('not-found', `User with UID '${targetUid}' was not found in Firebase Authentication.`);
        }
        throw new https_1.HttpsError('internal', `Failed to retrieve user record: ${errorObj?.message || String(err)}`);
    }
    const existingClaims = (userRecord.customClaims || {});
    const previousRole = existingClaims.activeRole || 'passenger';
    // 7. Merge custom claims without clobbering existing flags (such as isSuspended)
    const updatedClaims = {
        ...existingClaims,
        activeRole: newRole,
    };
    if (newRole === 'sacco_manager') {
        updatedClaims.saccoId = saccoId;
        delete updatedClaims.authorityScope;
        delete updatedClaims.county;
    }
    else if (newRole === 'authority') {
        updatedClaims.authorityScope = authorityScope || 'national';
        if (county) {
            updatedClaims.county = county;
        }
        else {
            delete updatedClaims.county;
        }
        delete updatedClaims.saccoId;
    }
    else {
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
    const userUpdatePayload = {
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
    }
    else if (newRole === 'authority') {
        const resolvedScope = authorityScope || 'national';
        userUpdatePayload.authorityScope = resolvedScope;
        userUpdatePayload.claimedAuthorityScope = resolvedScope;
        if (county)
            userUpdatePayload.county = county;
        if (authorityId)
            userUpdatePayload.authorityId = authorityId;
        if (badgeNumber)
            userUpdatePayload.badgeNumber = badgeNumber;
        userUpdatePayload.saccoId = null;
        userUpdatePayload.claimedSaccoId = null;
    }
    else {
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
            await teamUserRef.set({
                status: 'active',
                uid: targetUid,
                updatedAt: nowIso,
            }, { merge: true });
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
//# sourceMappingURL=assignUserRole.js.map