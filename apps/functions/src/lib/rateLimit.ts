import { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export const RATE_LIMIT_CONFIGS = {
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
} as const;

export type RateLimitedAction = keyof typeof RATE_LIMIT_CONFIGS;

export interface RateLimitResult {
  allowed: boolean;
  action: RateLimitedAction;
  count: number;
  maxAllowed: number;
  resetTimeMs: number;
}

/**
 * Transactionally checks and records rate limiting in Firestore rate_limits/{userId}
 */
export async function enforceRateLimit(
  db: Firestore,
  userId: string,
  action: RateLimitedAction,
  nowMs: number = Date.now()
): Promise<RateLimitResult> {
  if (!userId || userId === 'anonymous') {
    return {
      allowed: true,
      action,
      count: 1,
      maxAllowed: RATE_LIMIT_CONFIGS[action].maxAllowed,
      resetTimeMs: nowMs + RATE_LIMIT_CONFIGS[action].windowMs,
    };
  }

  const config = RATE_LIMIT_CONFIGS[action];
  const rateLimitRef = db.collection('rate_limits').doc(userId);

  return await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(rateLimitRef);
    const data = snap.exists ? snap.data() || {} : {};

    const fieldKey = action === 'sos' ? 'sosTimestamps' : 'blackSpotTimestamps';
    const rawTimestamps: number[] = Array.isArray(data[fieldKey]) ? data[fieldKey] : [];

    const cutoff = nowMs - config.windowMs;
    const validTimestamps = rawTimestamps.filter((ts) => typeof ts === 'number' && ts > cutoff);

    if (validTimestamps.length >= config.maxAllowed) {
      const oldestValid = Math.min(...validTimestamps);
      const resetTimeMs = oldestValid + config.windowMs;

      throw new HttpsError('resource-exhausted', config.errorMessage, {
        code: 'RATE_LIMIT_EXCEEDED',
        action,
        currentCount: validTimestamps.length,
        maxAllowed: config.maxAllowed,
        resetTimeMs,
      });
    }

    validTimestamps.push(nowMs);

    const updatePayload: {
      userId: string;
      updatedAt: string;
      [key: string]: string | number[] | undefined;
    } = {
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
