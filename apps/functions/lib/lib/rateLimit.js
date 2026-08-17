"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_LIMIT_CONFIGS = void 0;
exports.enforceRateLimit = enforceRateLimit;
const https_1 = require("firebase-functions/v2/https");
exports.RATE_LIMIT_CONFIGS = {
    sos: {
        maxAllowed: 3,
        windowMs: 60 * 60 * 1000, // 1 hour
        errorMessage: 'RATE_LIMIT_EXCEEDED: Maximum 3 SOS alerts permitted per hour.',
    },
    black_spot: {
        maxAllowed: 10,
        windowMs: 24 * 60 * 60 * 1000, // 24 hours (1 day)
        errorMessage: 'RATE_LIMIT_EXCEEDED: Maximum 10 hazard reports permitted per 24 hours.',
    },
};
/**
 * Transactionally checks and records rate limiting in Firestore rate_limits/{userId}
 */
async function enforceRateLimit(db, userId, action, nowMs = Date.now()) {
    if (!userId || userId === 'anonymous') {
        return {
            allowed: true,
            action,
            count: 1,
            maxAllowed: exports.RATE_LIMIT_CONFIGS[action].maxAllowed,
            resetTimeMs: nowMs + exports.RATE_LIMIT_CONFIGS[action].windowMs,
        };
    }
    const config = exports.RATE_LIMIT_CONFIGS[action];
    const rateLimitRef = db.collection('rate_limits').doc(userId);
    return await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(rateLimitRef);
        const data = snap.exists ? snap.data() || {} : {};
        const fieldKey = action === 'sos' ? 'sosTimestamps' : 'blackSpotTimestamps';
        const rawTimestamps = Array.isArray(data[fieldKey]) ? data[fieldKey] : [];
        const cutoff = nowMs - config.windowMs;
        const validTimestamps = rawTimestamps.filter((ts) => typeof ts === 'number' && ts > cutoff);
        if (validTimestamps.length >= config.maxAllowed) {
            const oldestValid = Math.min(...validTimestamps);
            const resetTimeMs = oldestValid + config.windowMs;
            throw new https_1.HttpsError('resource-exhausted', config.errorMessage, {
                code: 'RATE_LIMIT_EXCEEDED',
                action,
                currentCount: validTimestamps.length,
                maxAllowed: config.maxAllowed,
                resetTimeMs,
            });
        }
        validTimestamps.push(nowMs);
        const updatePayload = {
            userId,
            [fieldKey]: validTimestamps,
            updatedAt: new Date(nowMs).toISOString(),
        };
        transaction.set(rateLimitRef, updatePayload, { merge: true });
        return {
            allowed: true,
            action,
            count: validTimestamps.length,
            maxAllowed: config.maxAllowed,
            resetTimeMs: (validTimestamps[0] ?? nowMs) + config.windowMs,
        };
    });
}
//# sourceMappingURL=rateLimit.js.map