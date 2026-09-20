import { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export const RATE_LIMIT_CONFIGS = {
  sos: {
    maxAllowed: 3,
    anonymousMaxAllowed: 1, // Stricter limit for guest accounts: 1 SOS alert per hour
    secondaryMaxAllowed: 2, // Secondary IP/device limit across cycled guest sessions
    windowMs: 60 * 60 * 1000, // 1 hour
    errorMessage: 'RATE_LIMIT_EXCEEDED: Maximum 3 SOS alerts permitted per hour.',
    anonymousErrorMessage:
      'RATE_LIMIT_EXCEEDED: Guest accounts are limited to 1 SOS alert per hour. Please register or sign in to send additional alerts.',
    secondaryErrorMessage:
      'RATE_LIMIT_EXCEEDED: Multiple emergency alerts from this network or device detected. Please register or sign in to verify your identity.',
  },
  black_spot: {
    maxAllowed: 10,
    anonymousMaxAllowed: 2, // Stricter limit for guest accounts: 2 reports per 24 hours
    secondaryMaxAllowed: 5, // Secondary IP/device limit across cycled guest sessions
    windowMs: 24 * 60 * 60 * 1000, // 24 hours (1 day)
    errorMessage: 'RATE_LIMIT_EXCEEDED: Maximum 10 hazard reports permitted per 24 hours.',
    anonymousErrorMessage:
      'RATE_LIMIT_EXCEEDED: Guest accounts are limited to 2 hazard reports per 24 hours. Please register to submit additional reports.',
    secondaryErrorMessage:
      'RATE_LIMIT_EXCEEDED: Maximum hazard reports from this network or device exceeded. Please register to continue reporting.',
  },
  role_assignment: {
    maxAllowed: 20,
    anonymousMaxAllowed: 0,
    secondaryMaxAllowed: 0,
    windowMs: 60 * 60 * 1000, // 1 hour
    errorMessage: 'RATE_LIMIT_EXCEEDED: Maximum 20 role assignments permitted per hour.',
    anonymousErrorMessage: 'RATE_LIMIT_EXCEEDED: Guest accounts cannot assign roles.',
    secondaryErrorMessage: 'RATE_LIMIT_EXCEEDED: Guest accounts cannot assign roles.',
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

export interface EnforceRateLimitOptions {
  isAnonymous?: boolean | undefined;
  secondaryKey?: string | null | undefined;
  maxAllowedOverride?: number | undefined;
}

/**
 * Determines whether a Firebase Auth context represents an anonymous / guest session.
 */
export function isAnonymousAuth(auth?: { token?: { firebase?: { sign_in_provider?: string } } } | null): boolean {
  return auth?.token?.firebase?.sign_in_provider === 'anonymous';
}

/**
 * Extracts a secondary rate limiting key (device ID, instance ID token, or IP address)
 * from a CallableRequest.
 */
export function extractClientIdentifier(request: {
  data?: any;
  instanceIdToken?: string;
  rawRequest?: any;
}): string | null {
  const payloadDeviceId =
    typeof request.data?.deviceId === 'string' && request.data.deviceId.trim()
      ? request.data.deviceId.trim()
      : null;
  if (payloadDeviceId) return `device_${payloadDeviceId.slice(0, 64)}`;

  const instanceId =
    typeof request.instanceIdToken === 'string' && request.instanceIdToken.trim()
      ? request.instanceIdToken.trim()
      : null;
  if (instanceId) return `instance_${instanceId.slice(0, 64)}`;

  const rawReq = request.rawRequest;
  if (rawReq) {
    const forwarded = rawReq.headers?.['x-forwarded-for'];
    let ip: string | null = null;
    if (typeof forwarded === 'string' && forwarded.trim()) {
      const firstIp = forwarded.split(',')[0];
      if (firstIp) ip = firstIp.trim();
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
      const firstForwarded = forwarded[0];
      if (typeof firstForwarded === 'string') ip = firstForwarded.trim();
    } else if (typeof rawReq.ip === 'string' && rawReq.ip.trim()) {
      ip = rawReq.ip.trim();
    }
    if (ip) {
      return `ip_${ip.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 64)}`;
    }
  }

  return null;
}

/**
 * Transactionally checks and records rate limiting in Firestore rate_limits/{userId}
 * and optionally a secondary device/network document rate_limits/{sec_key} to prevent
 * guest session-cycling bypasses.
 */
export async function enforceRateLimit(
  db: Firestore,
  userId: string,
  action: RateLimitedAction,
  nowMs: number = Date.now(),
  options?: EnforceRateLimitOptions
): Promise<RateLimitResult> {
  // PRODUCTION HARDENING: this function must fail closed on a missing identity, not open.
  // Both current callers (sendSOS, reportBlackSpot) derive `userId` from the server-verified
  // `request.auth.uid` after an explicit `request.auth` check, so it is always a real, non-empty
  // string here — including for genuine Firebase Anonymous-Auth sessions, whose uid is a random
  // string, never the literal word 'anonymous'. A previous version of this check special-cased
  // the literal string 'anonymous' and returned `allowed: true` (an unconditional bypass) for it;
  // that branch was dead code in practice, but "unlimited on a falsy/placeholder id" is the wrong
  // default to leave in place for any future caller. Note: this guard does not by itself defend
  // against an attacker minting many fresh anonymous sessions to obtain many fresh per-uid rate
  // budgets — that is a separate, product-level question (e.g. whether anonymous sessions should
  // have a stricter limit, or require phone verification before SOS/report access) that this fix
  // does not resolve and that requires a product decision, not a code change.
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('enforceRateLimit called without a verified userId.');
  }

  const isAnon = Boolean(options?.isAnonymous);
  const config = RATE_LIMIT_CONFIGS[action];
  const effectiveMaxAllowed =
    options?.maxAllowedOverride ?? (isAnon ? config.anonymousMaxAllowed : config.maxAllowed);
  const effectiveErrorMessage = isAnon ? config.anonymousErrorMessage : config.errorMessage;

  if (effectiveMaxAllowed <= 0) {
    throw new HttpsError('permission-denied', effectiveErrorMessage, {
      code: 'RATE_LIMIT_EXCEEDED',
      action,
      currentCount: 0,
      maxAllowed: 0,
      resetTimeMs: nowMs + config.windowMs,
    });
  }

  const primaryDocId = userId;
  const rateLimitRef = db.collection('rate_limits').doc(primaryDocId);

  const secondaryRef =
    options?.secondaryKey && typeof options.secondaryKey === 'string' && options.secondaryKey.trim()
      ? db
          .collection('rate_limits')
          .doc(`sec_${action}_${options.secondaryKey.trim().replace(/[^a-zA-Z0-9_.-]/g, '_')}`)
      : null;

  return await db.runTransaction(async (transaction) => {
    // 1. Get primary record
    const snap = await transaction.get(rateLimitRef);
    // 2. Get secondary record if present
    const secondarySnap = secondaryRef ? await transaction.get(secondaryRef) : null;

    const fieldKey =
      action === 'sos'
        ? 'sosTimestamps'
        : action === 'black_spot'
        ? 'blackSpotTimestamps'
        : 'roleAssignmentTimestamps';

    const cutoff = nowMs - config.windowMs;

    // Check primary rate limit
    const data = snap.exists ? snap.data() || {} : {};
    const rawTimestamps: number[] = Array.isArray(data[fieldKey]) ? data[fieldKey] : [];
    const validTimestamps = rawTimestamps.filter((ts) => typeof ts === 'number' && ts > cutoff);

    if (validTimestamps.length >= effectiveMaxAllowed) {
      const oldestValid = Math.min(...validTimestamps);
      const resetTimeMs = oldestValid + config.windowMs;

      throw new HttpsError('resource-exhausted', effectiveErrorMessage, {
        code: 'RATE_LIMIT_EXCEEDED',
        action,
        currentCount: validTimestamps.length,
        maxAllowed: effectiveMaxAllowed,
        resetTimeMs,
        isAnonymous: isAnon,
      });
    }

    // Check secondary rate limit if caller is anonymous and secondaryKey exists
    let validSecondaryTimestamps: number[] = [];
    if (secondaryRef && secondarySnap && isAnon) {
      const secondaryData = secondarySnap.exists ? secondarySnap.data() || {} : {};
      const rawSecondary: number[] = Array.isArray(secondaryData[fieldKey]) ? secondaryData[fieldKey] : [];
      validSecondaryTimestamps = rawSecondary.filter((ts) => typeof ts === 'number' && ts > cutoff);
      const secondaryMax = config.secondaryMaxAllowed;

      if (validSecondaryTimestamps.length >= secondaryMax) {
        const oldestSecondary = Math.min(...validSecondaryTimestamps);
        const resetTimeMs = oldestSecondary + config.windowMs;

        throw new HttpsError('resource-exhausted', config.secondaryErrorMessage, {
          code: 'RATE_LIMIT_EXCEEDED',
          action,
          currentCount: validSecondaryTimestamps.length,
          maxAllowed: secondaryMax,
          resetTimeMs,
          dimension: 'secondary_device_or_network',
        });
      }
    }

    // Write primary updates
    validTimestamps.push(nowMs);
    const updatePayload: {
      userId: string;
      isAnonymous?: boolean;
      updatedAt: string;
      [key: string]: string | boolean | number[] | undefined;
    } = {
      userId,
      isAnonymous: isAnon,
      [fieldKey]: validTimestamps,
      updatedAt: new Date(nowMs).toISOString(),
    };
    transaction.set(rateLimitRef, updatePayload, { merge: true });

    // Write secondary updates
    if (secondaryRef && isAnon) {
      validSecondaryTimestamps.push(nowMs);
      const secondaryPayload: {
        secondaryKey: string;
        action: string;
        updatedAt: string;
        [key: string]: string | number[] | undefined;
      } = {
        secondaryKey: options?.secondaryKey || '',
        action,
        [fieldKey]: validSecondaryTimestamps,
        updatedAt: new Date(nowMs).toISOString(),
      };
      transaction.set(secondaryRef, secondaryPayload, { merge: true });
    }

    return {
      allowed: true,
      action,
      count: validTimestamps.length,
      maxAllowed: effectiveMaxAllowed,
      resetTimeMs: (validTimestamps[0] ?? nowMs) + config.windowMs,
    };
  });
}

