"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOwnAccount = void 0;
exports.processDeleteOwnAccountLogic = processDeleteOwnAccountLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const env_1 = require("../lib/env");
/**
 * Executes the core logic for user self-deletion under the Anonymize-and-Retain policy.
 *
 * DESIGN DECISION (Kenya DPA 2019 / Road Safety Accountability):
 * 1. The Firebase Auth user record is permanently removed to prevent further logins.
 * 2. Personal Identifying Information (PII) is removed from the user profile document (users/{userId}).
 * 3. Rate limiting records (rate_limits/{userId}) are deleted.
 * 4. Safety records (trips, safety_alerts, complaints, black_spots) are retained in de-identified
 *    form so that road safety and SACCO accountability investigations remain intact.
 * 5. An authoritative audit log entry is written for compliance tracking.
 */
async function processDeleteOwnAccountLogic(db, authAdmin, userId, userRole = 'passenger') {
    if (!userId || typeof userId !== 'string' || userId.trim() === '' || userId === 'anonymous') {
        throw new https_1.HttpsError('unauthenticated', 'A valid authenticated user ID is required.');
    }
    const nowIso = new Date().toISOString();
    // 1. Anonymize user profile document
    const userRef = db.collection('users').doc(userId);
    try {
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            await userRef.set({
                displayName: 'De-identified User',
                email: '',
                phoneNumber: '',
                photoUrl: null,
                avatarUrl: null,
                fcmTokens: [],
                deviceTokens: [],
                isActive: false,
                isDeleted: true,
                deletedAt: nowIso,
                anonymizedAt: nowIso,
                updatedAt: nowIso,
            }, { merge: true });
        }
    }
    catch (err) {
        console.warn(`[deleteOwnAccount] Could not update profile for user ${userId}:`, err);
    }
    // 2. Remove rate limits document
    try {
        await db.collection('rate_limits').doc(userId).delete();
    }
    catch (err) {
        console.warn(`[deleteOwnAccount] Could not delete rate limit for user ${userId}:`, err);
    }
    // 3. De-identify complaints filed by this user
    try {
        const complaintsSnap = await db.collection('complaints').where('reportedByUid', '==', userId).get();
        if (!complaintsSnap.empty) {
            const batch = db.batch();
            complaintsSnap.docs.forEach((docSnap) => {
                batch.update(docSnap.ref, {
                    passengerName: 'De-identified Passenger',
                    updatedAt: nowIso,
                });
            });
            await batch.commit();
        }
    }
    catch (err) {
        console.warn(`[deleteOwnAccount] Could not de-identify complaints for user ${userId}:`, err);
    }
    // 4. De-identify black spot reports filed by this user
    try {
        const blackSpotsSnap = await db.collection('black_spots').where('reportedByUid', '==', userId).get();
        if (!blackSpotsSnap.empty) {
            const batch = db.batch();
            blackSpotsSnap.docs.forEach((docSnap) => {
                batch.update(docSnap.ref, {
                    reportedByDisplayName: 'De-identified Commuter',
                    updatedAt: nowIso,
                });
            });
            await batch.commit();
        }
    }
    catch (err) {
        console.warn(`[deleteOwnAccount] Could not de-identify black spots for user ${userId}:`, err);
    }
    // 5. Record compliance audit log
    try {
        await db.collection('audit_logs').add({
            action: 'DELETE_OWN_ACCOUNT',
            actorUid: userId,
            actorName: 'De-identified User',
            actorRole: userRole,
            target: `User ID: ${userId}`,
            timestamp: nowIso,
            details: {
                retentionPolicy: 'anonymize-and-retain',
                authDeleted: true,
                profileAnonymized: true,
            },
        });
    }
    catch (err) {
        console.warn(`[deleteOwnAccount] Could not record audit log for user ${userId}:`, err);
    }
    // 6. Delete Firebase Auth user record (idempotent: ignore user-not-found)
    try {
        await authAdmin.deleteUser(userId);
    }
    catch (authErr) {
        const errCode = authErr?.code;
        if (errCode !== 'auth/user-not-found') {
            console.error(`[deleteOwnAccount] Error deleting auth user ${userId}:`, authErr);
            throw new https_1.HttpsError('internal', 'Failed to delete authentication credentials.');
        }
    }
    return {
        success: true,
        userId,
        retentionPolicy: 'anonymize-and-retain',
        anonymizedAt: nowIso,
    };
}
/**
 * Callable Cloud Function: deleteOwnAccount
 * Privileged account deletion callable with App Check enforcement.
 * STRICT SECURITY: Operates ONLY on request.auth.uid to prevent cross-account tampering.
 */
exports.deleteOwnAccount = (0, https_1.onCall)({ enforceAppCheck: env_1.APP_CHECK_ENFORCED }, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Caller must be authenticated to delete their account.');
    }
    // Explicitly derive UID strictly from request.auth.uid; ignore any payload ID
    const userId = request.auth.uid;
    const userRole = request.auth.token?.activeRole || 'passenger';
    const db = (0, firestore_1.getFirestore)();
    const authAdmin = (0, auth_1.getAuth)();
    try {
        return await processDeleteOwnAccountLogic(db, authAdmin, userId, userRole);
    }
    catch (err) {
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[deleteOwnAccount] Execution failed for ${userId}:`, err);
        throw new https_1.HttpsError('internal', message || 'Failed to complete account deletion sequence.');
    }
});
//# sourceMappingURL=deleteOwnAccount.js.map