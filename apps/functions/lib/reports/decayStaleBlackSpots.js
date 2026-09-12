"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decayStaleBlackSpots = exports.decayBlackSpotsScheduled = void 0;
exports.processDecayStaleBlackSpotsLogic = processDecayStaleBlackSpotsLogic;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const env_1 = require("../lib/env");
const ROLLING_WINDOW_DAYS = 14;
async function processDecayStaleBlackSpotsLogic(db) {
    const cutoffTime = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let spotsEvaluated = 0;
    let spotsDowngraded = 0;
    let spotsArchived = 0;
    const spotsSnapshot = await db.collection('black_spots').get();
    for (const doc of spotsSnapshot.docs) {
        const data = doc.data();
        if (data.status === 'archived' || data.status === 'resolved') {
            continue;
        }
        spotsEvaluated++;
        // Query confirmations subcollection
        const confirmationsSnapshot = await doc.ref.collection('confirmations').get();
        if (confirmationsSnapshot.empty) {
            continue;
        }
        let stillThereCount = 0;
        let resolvedCount = 0;
        confirmationsSnapshot.forEach((cDoc) => {
            const c = cDoc.data();
            const timestamp = c.timestamp || c.createdAt || '';
            // Consider confirmations within the rolling window
            if (!timestamp || timestamp >= cutoffTime) {
                if (c.type === 'resolved')
                    resolvedCount++;
                else if (c.type === 'still_there')
                    stillThereCount++;
            }
        });
        const netResolved = resolvedCount - stillThereCount;
        // Condition: At least 3 resolved confirmations and resolved outweighs still_there
        if (resolvedCount >= 3 && netResolved >= 2) {
            const currentSeverity = data.severity || 'medium';
            const nowIso = new Date().toISOString();
            if (currentSeverity === 'critical') {
                await doc.ref.set({
                    severity: 'high',
                    lastDecayedAt: nowIso,
                    decayReason: `Resolved confirmations (${resolvedCount}) outweighed active reports (${stillThereCount}).`,
                    updatedAt: nowIso,
                }, { merge: true });
                spotsDowngraded++;
            }
            else if (currentSeverity === 'high') {
                await doc.ref.set({
                    severity: 'medium',
                    lastDecayedAt: nowIso,
                    decayReason: `Resolved confirmations (${resolvedCount}) outweighed active reports (${stillThereCount}).`,
                    updatedAt: nowIso,
                }, { merge: true });
                spotsDowngraded++;
            }
            else if (currentSeverity === 'medium') {
                await doc.ref.set({
                    severity: 'low',
                    lastDecayedAt: nowIso,
                    decayReason: `Resolved confirmations (${resolvedCount}) outweighed active reports (${stillThereCount}).`,
                    updatedAt: nowIso,
                }, { merge: true });
                spotsDowngraded++;
            }
            else {
                // Already low or resolved outweighs by large margin -> archive
                await doc.ref.set({
                    status: 'archived',
                    statusReason: 'auto_decay_crowdsource_resolved',
                    lastDecayedAt: nowIso,
                    decayReason: `Report resolved by community consensus (${resolvedCount} resolved vs ${stillThereCount} still there).`,
                    updatedAt: nowIso,
                }, { merge: true });
                spotsArchived++;
            }
        }
    }
    console.log(`[DecayStaleBlackSpots] Evaluated: ${spotsEvaluated}, Downgraded: ${spotsDowngraded}, Archived: ${spotsArchived}`);
    return { spotsEvaluated, spotsDowngraded, spotsArchived };
}
exports.decayBlackSpotsScheduled = (0, scheduler_1.onSchedule)('every day 03:00', async () => {
    await processDecayStaleBlackSpotsLogic((0, firestore_1.getFirestore)());
});
exports.decayStaleBlackSpots = (0, https_1.onCall)({ enforceAppCheck: env_1.APP_CHECK_ENFORCED }, async (request) => {
    const role = String(request.auth?.token?.activeRole || request.auth?.token?.role || '');
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication is required.');
    }
    if (role !== 'admin' && role !== 'authority') {
        throw new https_1.HttpsError('permission-denied', 'Only authority or administrators can trigger decay cycle.');
    }
    return processDecayStaleBlackSpotsLogic((0, firestore_1.getFirestore)());
});
//# sourceMappingURL=decayStaleBlackSpots.js.map