import { describe, it, expect } from 'vitest';
import {
  isMfaCurrentlyVerified,
  requireMfaVerification,
  MFA_EXPIRY_WINDOW_MS,
} from '../lib/auth';
import { HttpsError } from 'firebase-functions/v2/https';

describe('MFA Backend Authorization Helper (apps/functions/src/lib/auth.ts)', () => {
  const fixedNow = 1_700_000_000_000; // ms

  it('rejects null or undefined token', () => {
    expect(isMfaCurrentlyVerified(null, fixedNow)).toBe(false);
    expect(isMfaCurrentlyVerified(undefined, fixedNow)).toBe(false);
  });

  it('rejects token without mfaVerifiedAt claim', () => {
    expect(isMfaCurrentlyVerified({ activeRole: 'admin' }, fixedNow)).toBe(false);
  });

  it('rejects non-numeric, negative, or NaN mfaVerifiedAt', () => {
    expect(isMfaCurrentlyVerified({ mfaVerifiedAt: 'invalid' }, fixedNow)).toBe(false);
    expect(isMfaCurrentlyVerified({ mfaVerifiedAt: NaN }, fixedNow)).toBe(false);
    expect(isMfaCurrentlyVerified({ mfaVerifiedAt: 0 }, fixedNow)).toBe(false);
    expect(isMfaCurrentlyVerified({ mfaVerifiedAt: -100 }, fixedNow)).toBe(false);
    expect(isMfaCurrentlyVerified({ mfaVerifiedAt: null }, fixedNow)).toBe(false);
  });

  it('rejects timestamps excessively in the future (> 60s skew)', () => {
    const futureSkew = fixedNow + 70_000; // 70s in the future
    expect(isMfaCurrentlyVerified({ mfaVerifiedAt: futureSkew }, fixedNow)).toBe(false);
  });

  it('accepts valid millisecond timestamp within 12-hour window', () => {
    const freshMs = fixedNow - 30 * 60 * 1000; // 30 minutes ago
    expect(isMfaCurrentlyVerified({ mfaVerifiedAt: freshMs }, fixedNow)).toBe(true);
  });

  it('accepts valid 10-digit second timestamp within 12-hour window', () => {
    const freshSeconds = Math.floor((fixedNow - 60 * 60 * 1000) / 1000); // 1 hour ago in seconds
    expect(isMfaCurrentlyVerified({ mfaVerifiedAt: freshSeconds }, fixedNow)).toBe(true);
  });

  it('rejects expired timestamp older than 12 hours', () => {
    const expiredMs = fixedNow - (MFA_EXPIRY_WINDOW_MS + 1000); // 12 hours + 1 second ago
    expect(isMfaCurrentlyVerified({ mfaVerifiedAt: expiredMs }, fixedNow)).toBe(false);
  });

  it('requireMfaVerification throws HttpsError failed-precondition when unverified', () => {
    expect(() => requireMfaVerification(null, fixedNow)).toThrow(HttpsError);
    try {
      requireMfaVerification({ activeRole: 'admin' }, fixedNow);
      expect.fail('Should have thrown HttpsError');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpsError);
      const httpsErr = err as HttpsError;
      expect(httpsErr.code).toBe('failed-precondition');
      expect(httpsErr.message).toBe('MFA re-verification required.');
    }
  });

  it('requireMfaVerification passes without throwing when token has fresh MFA verification', () => {
    const freshMs = fixedNow - 10_000;
    expect(() => requireMfaVerification({ mfaVerifiedAt: freshMs }, fixedNow)).not.toThrow();
  });
});
