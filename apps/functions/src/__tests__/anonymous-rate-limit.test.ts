import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enforceRateLimit,
  isAnonymousAuth,
  extractClientIdentifier,
  RATE_LIMIT_CONFIGS,
} from '../lib/rateLimit';
import { processReportBlackSpotLogic } from '../reports/reportBlackSpot';
import { processSendSosLogic } from '../alerts/sendSOS';

class MockFirestore {
  public data: Record<string, Record<string, any>> = {};

  collection(collName: string) {
    return {
      doc: (docId: string) => ({
        get: async () => ({
          exists: !!this.data[`${collName}/${docId}`],
          data: () => this.data[`${collName}/${docId}`],
        }),
        set: async (docData: any, opts?: { merge?: boolean }) => {
          const key = `${collName}/${docId}`;
          if (opts?.merge) {
            this.data[key] = { ...(this.data[key] || {}), ...docData };
          } else {
            this.data[key] = docData;
          }
        },
        create: async (docData: any) => {
          const key = `${collName}/${docId}`;
          if (this.data[key]) {
            throw new Error(`Document already exists: ${key}`);
          }
          this.data[key] = docData;
        },
        update: async (docData: any) => {
          const key = `${collName}/${docId}`;
          if (!this.data[key]) {
            throw new Error(`Document does not exist: ${key}`);
          }
          this.data[key] = { ...this.data[key], ...docData };
        },
      }),
    };
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    const tx = {
      get: async (docRef: any) => {
        return docRef.get();
      },
      set: (docRef: any, data: any, opts?: any) => {
        return docRef.set(data, opts);
      },
    };
    return await updateFunction(tx);
  }
}

const mockMessaging = {
  sendToTopic: vi.fn().mockResolvedValue({ messageId: 'msg_test_123' }),
};

const mockSms = {
  sendSms: vi.fn().mockResolvedValue({ messageId: 'sms_test_123', success: true }),
};

describe('AUDIT TASK: Anonymous Auth Rate Limit Bypass Investigation & Fix', () => {
  let db: any;

  beforeEach(() => {
    db = new MockFirestore();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // STEP 1: Reproduction & Confirmation of the Architectural Vulnerability
  // ---------------------------------------------------------------------------
  describe('Step 1: Ground Truth Reproduction', () => {
    it('demonstrates the rate-limit bypass when rate limiting is keyed solely by Firebase Auth UID without secondary keys', async () => {
      // Ground Truth Scenario:
      // Firebase Anonymous Auth assigns a unique, randomly-generated UID per session
      // (e.g. signInAnonymously produces random UIDs like "guest_session_1", "guest_session_2").
      // Under pure UID keying without secondary dimension, discarding and recreating guest
      // sessions resets the rate limit state completely.

      const session1Uid = 'anon_guest_session_alpha';
      const session2Uid = 'anon_guest_session_beta';
      const now = Date.now();

      // Session 1: Calling enforceRateLimit with anonymous quota
      const res1 = await enforceRateLimit(db, session1Uid, 'sos', now, { isAnonymous: true });
      expect(res1.allowed).toBe(true);

      // Session 1 exceeds its per-session limit (1 allowed per hour)
      await expect(
        enforceRateLimit(db, session1Uid, 'sos', now + 1000, { isAnonymous: true })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: expect.stringContaining('Guest accounts are limited to 1 SOS alert per hour'),
      });

      // Without secondary keys, Session 2 (fresh anonymous UID) would be completely unconstrained:
      const resSession2WithoutSecondary = await enforceRateLimit(db, session2Uid, 'sos', now + 2000, {
        isAnonymous: true,
      });
      expect(resSession2WithoutSecondary.allowed).toBe(true);
      // This confirms the audit finding: cycling anonymous UIDs resets pure UID-based Firestore counters.
    });

    it('demonstrates that the secondary rate-limit dimension closes multi-session cycling from the same device/network', async () => {
      // With secondaryKey (derived from deviceId, instanceId, or IP), the secondary barrier
      // caps all guest sessions sharing that key to secondaryMaxAllowed (2 for SOS).
      const sharedSecondaryKey = 'device_hardware_fingerprint_001';
      const now = Date.now();

      // Guest Session 1: 1st SOS alert -> allowed
      const session1Uid = 'guest_cycle_1';
      const res1 = await enforceRateLimit(db, session1Uid, 'sos', now, {
        isAnonymous: true,
        secondaryKey: sharedSecondaryKey,
      });
      expect(res1.allowed).toBe(true);

      // Guest Session 1 attempts a 2nd SOS -> blocked by session limit (1/hr)
      await expect(
        enforceRateLimit(db, session1Uid, 'sos', now + 100, {
          isAnonymous: true,
          secondaryKey: sharedSecondaryKey,
        })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: expect.stringContaining('Guest accounts are limited to 1 SOS alert per hour'),
      });

      // Attacker discards Session 1 and mints Guest Session 2 on the same device
      const session2Uid = 'guest_cycle_2';
      const res2 = await enforceRateLimit(db, session2Uid, 'sos', now + 200, {
        isAnonymous: true,
        secondaryKey: sharedSecondaryKey,
      });
      expect(res2.allowed).toBe(true);

      // Attacker discards Session 2 and mints Guest Session 3 on the same device
      // Secondary limit (max 2 across guest sessions) is now reached!
      const session3Uid = 'guest_cycle_3';
      await expect(
        enforceRateLimit(db, session3Uid, 'sos', now + 300, {
          isAnonymous: true,
          secondaryKey: sharedSecondaryKey,
        })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: expect.stringContaining('Multiple emergency alerts from this network or device detected'),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // STEP 2: sign_in_provider Detection Verification
  // ---------------------------------------------------------------------------
  describe('Step 2: Correct sign_in_provider check', () => {
    it('correctly identifies anonymous sessions vs registered sessions', () => {
      // Anonymous token
      const anonymousAuth = {
        uid: 'anon_random_uid_xyz123',
        token: {
          firebase: {
            sign_in_provider: 'anonymous',
          },
        } as any,
      };
      expect(isAnonymousAuth(anonymousAuth)).toBe(true);

      // Password (email/password) registered user
      const passwordAuth = {
        uid: 'registered_passenger_1',
        token: {
          firebase: {
            sign_in_provider: 'password',
          },
        } as any,
      };
      expect(isAnonymousAuth(passwordAuth)).toBe(false);

      // Google OAuth registered user
      const googleAuth = {
        uid: 'registered_passenger_google',
        token: {
          firebase: {
            sign_in_provider: 'google.com',
          },
        } as any,
      };
      expect(isAnonymousAuth(googleAuth)).toBe(false);

      // Phone authentication user
      const phoneAuth = {
        uid: 'registered_phone_user',
        token: {
          firebase: {
            sign_in_provider: 'phone',
          },
        } as any,
      };
      expect(isAnonymousAuth(phoneAuth)).toBe(false);

      // Null or undefined auth
      expect(isAnonymousAuth(null)).toBe(false);
      expect(isAnonymousAuth(undefined)).toBe(false);
      expect(isAnonymousAuth({} as any)).toBe(false);
    });

    it('correctly extracts client identifiers from CallableRequest', () => {
      // 1. Device ID takes highest precedence
      expect(
        extractClientIdentifier({
          data: { deviceId: 'unique_device_uuid_789' },
          instanceIdToken: 'inst_token_abc',
          rawRequest: { ip: '192.168.1.1' },
        })
      ).toBe('device_unique_device_uuid_789');

      // 2. Instance ID token takes second precedence
      expect(
        extractClientIdentifier({
          data: {},
          instanceIdToken: 'inst_token_abc',
          rawRequest: { ip: '192.168.1.1' },
        })
      ).toBe('instance_inst_token_abc');

      // 3. X-Forwarded-For IP address
      expect(
        extractClientIdentifier({
          data: {},
          rawRequest: {
            headers: { 'x-forwarded-for': '102.219.208.5, 127.0.0.1' },
          },
        })
      ).toBe('ip_102.219.208.5');

      // 4. Raw Request IP address
      expect(
        extractClientIdentifier({
          data: {},
          rawRequest: { ip: '10.0.0.1' },
        })
      ).toBe('ip_10.0.0.1');

      // 5. No client identifier available
      expect(extractClientIdentifier({ data: {} })).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // STEP 3: Stricter Anonymous Limits Enforcement
  // ---------------------------------------------------------------------------
  describe('Step 3: Stricter Anonymous Limits Enforcement', () => {
    it('enforces 1 SOS alert per hour for anonymous sessions and blocks the 2nd alert', async () => {
      const anonUserId = 'anon_passenger_test_01';
      const payload = {
        userId: anonUserId,
        location: { lat: -1.286389, lng: 36.817223 },
        message: 'Guest passenger distress call',
      };

      // 1st SOS alert succeeds
      const result1 = await processSendSosLogic(db, mockMessaging, mockSms, payload, {
        isAnonymous: true,
        secondaryKey: 'ip_102.1.2.3',
      });
      expect(result1.success).toBe(true);
      expect(result1.userId).toBe(anonUserId);

      // 2nd SOS alert within 1 hour is blocked
      await expect(
        processSendSosLogic(db, mockMessaging, mockSms, payload, {
          isAnonymous: true,
          secondaryKey: 'ip_102.1.2.3',
        })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: expect.stringContaining('Guest accounts are limited to 1 SOS alert per hour'),
      });
    });

    it('enforces 2 black spot hazard reports per 24 hours for anonymous sessions and blocks the 3rd', async () => {
      const anonUserId = 'anon_reporter_test_02';
      const basePayload = {
        title: 'Deep pothole',
        severity: 'high' as const,
        locationName: 'Jogoo Road',
        location: { lat: -1.2921, lng: 36.8219 },
      };

      // 1st report succeeds
      const r1 = await processReportBlackSpotLogic(db, basePayload, anonUserId, {
        isAnonymous: true,
        secondaryKey: 'ip_102.1.2.3',
      });
      expect(r1.success).toBe(true);

      // 2nd report succeeds
      const r2 = await processReportBlackSpotLogic(
        db,
        { ...basePayload, title: 'Broken guardrail' },
        anonUserId,
        { isAnonymous: true, secondaryKey: 'ip_102.1.2.3' }
      );
      expect(r2.success).toBe(true);

      // 3rd report in the same 24-hour window is blocked
      await expect(
        processReportBlackSpotLogic(
          db,
          { ...basePayload, title: 'Missing manhole cover' },
          anonUserId,
          { isAnonymous: true, secondaryKey: 'ip_102.1.2.3' }
        )
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: expect.stringContaining('Guest accounts are limited to 2 hazard reports per 24 hours'),
      });
    });

    it('disallows role assignment completely for anonymous callers (maxAllowed = 0)', async () => {
      await expect(
        enforceRateLimit(db, 'anon_user_role_test', 'role_assignment', Date.now(), {
          isAnonymous: true,
        })
      ).rejects.toMatchObject({
        code: 'permission-denied',
        message: expect.stringContaining('Guest accounts cannot assign roles'),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // STEP 4: Registered Users Remain Unaffected
  // ---------------------------------------------------------------------------
  describe('Step 4: Registered Users Unaffected', () => {
    it('allows registered passengers up to 3 SOS alerts per hour before blocking the 4th', async () => {
      const registeredUserId = 'reg_passenger_verified_99';
      const payload = {
        userId: registeredUserId,
        location: { lat: -1.286389, lng: 36.817223 },
        message: 'Verified passenger emergency',
      };

      // 1st alert
      const res1 = await processSendSosLogic(db, mockMessaging, mockSms, payload, {
        isAnonymous: false,
      });
      expect(res1.success).toBe(true);

      // 2nd alert
      const res2 = await processSendSosLogic(db, mockMessaging, mockSms, payload, {
        isAnonymous: false,
      });
      expect(res2.success).toBe(true);

      // 3rd alert
      const res3 = await processSendSosLogic(db, mockMessaging, mockSms, payload, {
        isAnonymous: false,
      });
      expect(res3.success).toBe(true);

      // 4th alert is blocked by the registered limit (3/hour)
      await expect(
        processSendSosLogic(db, mockMessaging, mockSms, payload, {
          isAnonymous: false,
        })
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: expect.stringContaining('Maximum 3 SOS alerts permitted per hour'),
      });
    });

    it('allows registered commuters up to 10 black spot reports per 24 hours before blocking the 11th', async () => {
      const registeredUserId = 'reg_commuter_verified_88';

      for (let i = 1; i <= 10; i++) {
        const res = await processReportBlackSpotLogic(
          db,
          {
            title: `Pothole #${i}`,
            severity: 'medium',
            locationName: 'Ngong Road',
            location: { lat: -1.3, lng: 36.8 },
          },
          registeredUserId,
          { isAnonymous: false }
        );
        expect(res.success).toBe(true);
      }

      // 11th report is blocked by the registered limit (10/day)
      await expect(
        processReportBlackSpotLogic(
          db,
          {
            title: 'Pothole #11',
            severity: 'medium',
            locationName: 'Ngong Road',
            location: { lat: -1.3, lng: 36.8 },
          },
          registeredUserId,
          { isAnonymous: false }
        )
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: expect.stringContaining('Maximum 10 hazard reports permitted per 24 hours'),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // STEP 5: Closure of the Literal 'anonymous' String Comparison
  // ---------------------------------------------------------------------------
  describe('Step 5: Literal "anonymous" string handling', () => {
    it('does not bypass rate limiting when userId is the literal string "anonymous"', async () => {
      const now = Date.now();

      // 1st call with userId = 'anonymous' succeeds under anonymous quota
      const res1 = await enforceRateLimit(db, 'anonymous', 'sos', now);
      expect(res1.allowed).toBe(true);

      // 2nd call with userId = 'anonymous' is blocked!
      // Previously, line 41 returned allowed: true unconditionally.
      await expect(enforceRateLimit(db, 'anonymous', 'sos', now + 1000)).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });

    it('rejects unauthenticated callers who pass missing or literal "anonymous" userId without auth context', async () => {
      const payload = {
        location: { lat: -1.286389, lng: 36.817223 },
      };

      // sendSOS rejects missing userId / unauthenticated caller
      await expect(
        processSendSosLogic(db, mockMessaging, mockSms, payload)
      ).rejects.toMatchObject({
        code: 'unauthenticated',
      });

      // reportBlackSpot rejects literal 'anonymous' without isAnonymous auth flag
      await expect(
        processReportBlackSpotLogic(db, payload as any, 'anonymous')
      ).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });
  });
});
