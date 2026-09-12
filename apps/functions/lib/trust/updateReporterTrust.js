"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReporterTrust = void 0;
exports.processUpdateReporterTrustLogic = processUpdateReporterTrustLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const engine_1 = require("../lib/engine");
const env_1 = require("../lib/env");
/**
 * Executes the core logic for recalculating a reporter's trust score and badge level.
 *
 * DESIGN CONSTRAINTS:
 * 1. Caller identity is strictly bound to the authenticated user's UID.
 * 2. Writes to `/users/{userId}` via Firebase Admin SDK bypass client-side rules,
 *    preventing permission-denied errors while keeping trust fields client-immutable.
 * 3. An authoritative audit log entry is recorded for security and audit trail.
 */
async function processUpdateReporterTrustLogic(db, userId, nowMs = Date.now(), actorRole = 'passenger') {
    if (!userId || typeof userId !== 'string' || userId.trim() === '' || userId === 'anonymous') {
        throw new https_1.HttpsError('unauthenticated', 'A valid authenticated user ID is required.');
    }
    const nowIso = new Date(nowMs).toISOString();
    // 1. Fetch user's complaints history
    const complaintsSnap = await db
        .collection('complaints')
        .where('reportedByUid', '==', userId)
        .get();
    let confirmedReportsCount = 0;
    let falseReportsCount = 0;
    for (const docSnap of complaintsSnap.docs) {
        const data = docSnap.data();
        const status = data.status;
        if (status === 'resolved' || status === 'verified') {
            confirmedReportsCount++;
        }
        else if (status === 'dismissed' || status === 'false') {
            falseReportsCount++;
        }
    }
    // 2. Fetch user document to determine account age
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    let accountAgeDays = 30; // Default baseline if account age cannot be determined
    if (userSnap.exists) {
        const userData = userSnap.data();
        const createdAt = userData?.createdAt;
        if (createdAt) {
            const createdTime = new Date(createdAt).getTime();
            if (!Number.isNaN(createdTime)) {
                accountAgeDays = Math.max(0, (nowMs - createdTime) / (1000 * 60 * 60 * 24));
            }
        }
    }
    // 3. Calculate trust score & badge level using the engine formula
    const trustScore = (0, engine_1.calculateReporterTrustScore)(confirmedReportsCount, falseReportsCount, accountAgeDays);
    const trustBadge = (0, engine_1.getTrustBadgeLevel)(trustScore);
    // 4. Update user document via Admin SDK
    if (userSnap.exists) {
        await userRef.set({
            trustScore,
            trustBadge,
            updatedAt: nowIso,
        }, { merge: true });
    }
    // 5. Authoritative audit log
    const auditId = `audit_trust_${userId}_${nowMs}`;
    await db.collection('audit_logs').doc(auditId).set({
        id: auditId,
        action: 'UPDATE_REPORTER_TRUST',
        actorUid: userId,
        actorRole,
        target: `User ${userId}`,
        timestamp: nowIso,
        details: {
            trustScore,
            trustBadge,
            confirmedReportsCount,
            falseReportsCount,
            accountAgeDays: Math.round(accountAgeDays * 10) / 10,
        },
    });
    return {
        success: true,
        userId,
        trustScore,
        trustBadge,
        confirmedReportsCount,
        falseReportsCount,
        accountAgeDays: Math.round(accountAgeDays * 10) / 10,
        updatedAt: nowIso,
    };
}
exports.updateReporterTrust = (0, https_1.onCall)({ enforceAppCheck: env_1.APP_CHECK_ENFORCED }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to update trust score.');
    }
    // Security constraint: The function must only ever update the calling user's own trust score,
    // derived from that user's own complaint history — NEVER accept a target userId parameter from the client.
    const userId = request.auth.uid;
    const actorRole = (request.auth.token?.activeRole || request.auth.token?.role || 'passenger');
    const db = (0, firestore_1.getFirestore)();
    return await processUpdateReporterTrustLogic(db, userId, Date.now(), actorRole);
});
//# sourceMappingURL=updateReporterTrust.js.map