import { HttpsError } from 'firebase-functions/v2/https';

/**
 * MFA Verification Validity Window: 12 Hours.
 *
 * Security Policy Decision:
 * An authenticated admin or authority user must re-verify their TOTP second-factor
 * challenge at least once every 12 hours. This limits the risk window of long-lived
 * session tokens while minimizing friction for day-to-day administrative operations.
 */
export const MFA_EXPIRY_WINDOW_MS = 12 * 60 * 60 * 1000; // 43,200,000 ms (12 hours)
export const MFA_EXPIRY_WINDOW_HOURS = 12;

export interface TokenWithMfa {
  mfaVerifiedAt?: unknown;
  activeRole?: string;
  role?: string;
  isSuspended?: boolean;
  [key: string]: unknown;
}

/**
 * Checks whether the authentication token contains a valid, unexpired MFA verification timestamp.
 *
 * @param token Decoded ID token claims from request.auth.token
 * @param nowMs Current time in milliseconds (defaults to Date.now() for deterministic testing)
 * @param maxAgeMs Maximum validity window in milliseconds (defaults to MFA_EXPIRY_WINDOW_MS)
 * @returns boolean True if MFA is currently verified and unexpired
 */
export function isMfaCurrentlyVerified(
  token: TokenWithMfa | undefined | null,
  nowMs: number = Date.now(),
  maxAgeMs: number = MFA_EXPIRY_WINDOW_MS
): boolean {
  if (!token) return false;
  const verifiedAt = token.mfaVerifiedAt;
  if (typeof verifiedAt !== 'number' || isNaN(verifiedAt) || verifiedAt <= 0) {
    return false;
  }

  // Handle both millisecond timestamps (13 digits) and second timestamps (10 digits)
  const verifiedAtMs = verifiedAt < 1e11 ? verifiedAt * 1000 : verifiedAt;

  // Protect against excessive future skew (greater than 60 seconds in the future)
  if (verifiedAtMs > nowMs + 60_000) {
    return false;
  }

  const ageMs = nowMs - verifiedAtMs;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

/**
 * Enforces that caller has a valid, unexpired MFA verification claim.
 * Throws HttpsError('failed-precondition', 'MFA re-verification required.') if not verified.
 *
 * @param token Decoded ID token claims from request.auth.token
 * @param nowMs Current time in milliseconds
 * @param maxAgeMs Maximum validity window in milliseconds
 */
export function requireMfaVerification(
  token: TokenWithMfa | undefined | null,
  nowMs: number = Date.now(),
  maxAgeMs: number = MFA_EXPIRY_WINDOW_MS
): void {
  if (!isMfaCurrentlyVerified(token, nowMs, maxAgeMs)) {
    throw new HttpsError('failed-precondition', 'MFA re-verification required.');
  }
}
