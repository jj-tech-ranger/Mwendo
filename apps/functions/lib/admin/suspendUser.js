"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reactivateUser = exports.suspendUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
/**
 * Verify caller is an active admin by inspecting Firestore users/{uid} and Auth token claims.
 */
async function verifyAdminCaller(auth) {
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const callerUid = auth.uid;
    const tokenClaimRole = auth.token?.activeRole;
    // Live Firestore check
    const db = (0, firestore_1.getFirestore)();
    const userSnap = await db.collection('users').doc(callerUid).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Caller user record not found in Firestore.');
    }
    const userData = userSnap.data() || {};
    const isDocAdmin = userData.role === 'admin' || userData.activeRole === 'admin';
    const isClaimAdmin = tokenClaimRole === 'admin';
    if (!isDocAdmin && !isClaimAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Caller does not possess administrative privileges.');
    }
    return {
        uid: callerUid,
        displayName: userData.displayName || auth.token?.name || 'System Admin',
    };
}
exports.suspendUser = (0, https_1.onCall)({ enforceAppCheck: process.env.NODE_ENV === 'production' }, async (request) => {
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
exports.reactivateUser = (0, https_1.onCall)({ enforceAppCheck: process.env.NODE_ENV === 'production' }, async (request) => {
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