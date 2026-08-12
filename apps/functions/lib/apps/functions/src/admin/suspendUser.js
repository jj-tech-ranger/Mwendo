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
exports.suspendUser = (0, https_1.onCall)(async (request) => {
    const caller = await verifyAdminCaller(request.auth);
    const targetUid = request.data?.targetUid;
    const reason = request.data?.reason || 'Administrative action';
    if (!targetUid || typeof targetUid !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'The targetUid string parameter must be provided.');
    }
    const db = (0, firestore_1.getFirestore)();
    const authAdmin = (0, auth_1.getAuth)();
    // 1. Write Firestore isActive = false
    const targetRef = db.collection('users').doc(targetUid);
    await targetRef.set({
        isActive: false,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
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
exports.reactivateUser = (0, https_1.onCall)(async (request) => {
    const caller = await verifyAdminCaller(request.auth);
    const targetUid = request.data?.targetUid;
    if (!targetUid || typeof targetUid !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'The targetUid string parameter must be provided.');
    }
    const db = (0, firestore_1.getFirestore)();
    const authAdmin = (0, auth_1.getAuth)();
    // 1. Write Firestore isActive = true
    const targetRef = db.collection('users').doc(targetUid);
    await targetRef.set({
        isActive: true,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
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
//# sourceMappingURL=suspendUser.js.map