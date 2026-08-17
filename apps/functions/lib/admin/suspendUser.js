"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reactivateUser = exports.suspendUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const env_1 = require("../lib/env");
/**
 * Verify caller is an active admin by inspecting Auth token claims.
 * SEC-004 & SEC-009: Auth custom claims (auth.token.activeRole === 'admin') are the sole source
 * of truth for authorization. Firestore document fields (role/activeRole) are display-only and
 * must never grant administrative privileges.
 */
async function verifyAdminCaller(auth) {
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const callerUid = auth.uid;
    const tokenClaimRole = auth.token?.activeRole;
    // SEC-004: Custom claim is the sole authorization source
    if (tokenClaimRole !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Caller does not possess administrative privileges.');
    }
    let displayName = auth.token?.name || 'System Admin';
    try {
        // Read Firestore document only for displayName in audit logging if available
        const db = (0, firestore_1.getFirestore)();
        const userSnap = await db.collection('users').doc(callerUid).get();
        if (userSnap.exists) {
            const userData = userSnap.data() || {};
            if (userData.displayName) {
                displayName = userData.displayName;
            }
        }
    }
    catch {
        // Fallback gracefully to token name / default without blocking admin execution
    }
    return {
        uid: callerUid,
        displayName,
    };
}
exports.suspendUser = (0, https_1.onCall)({ enforceAppCheck: env_1.APP_CHECK_ENFORCED }, async (request) => {
    const caller = await verifyAdminCaller(request.auth);
    const targetUid = request.data?.targetUid;
    const reason = request.data?.reason || 'Administrative action';
    if (!targetUid || typeof targetUid !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'The targetUid string parameter must be provided.');
    }
    const db = (0, firestore_1.getFirestore)();
    const authAdmin = (0, auth_1.getAuth)();
    try {
        console.log(`[suspendUser] Step 1: Setting isActive=false on users/${targetUid}`);
        const targetRef = db.collection('users').doc(targetUid);
        await targetRef.set({
            isActive: false,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
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
    }
    catch (err) {
        console.error(`[suspendUser] Error suspending user ${targetUid}:`, err);
        throw new https_1.HttpsError('internal', err.message || 'Failed to complete user suspension sequence.');
    }
});
exports.reactivateUser = (0, https_1.onCall)({ enforceAppCheck: env_1.APP_CHECK_ENFORCED }, async (request) => {
    const caller = await verifyAdminCaller(request.auth);
    const targetUid = request.data?.targetUid;
    if (!targetUid || typeof targetUid !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'The targetUid string parameter must be provided.');
    }
    const db = (0, firestore_1.getFirestore)();
    const authAdmin = (0, auth_1.getAuth)();
    try {
        console.log(`[reactivateUser] Step 1: Setting isActive=true on users/${targetUid}`);
        const targetRef = db.collection('users').doc(targetUid);
        await targetRef.set({
            isActive: true,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
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
    }
    catch (err) {
        console.error(`[reactivateUser] Error reactivating user ${targetUid}:`, err);
        throw new https_1.HttpsError('internal', err.message || 'Failed to complete user reactivation sequence.');
    }
});
//# sourceMappingURL=suspendUser.js.map