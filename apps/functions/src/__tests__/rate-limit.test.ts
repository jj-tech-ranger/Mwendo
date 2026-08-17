import { describe, it, expect, beforeEach } from 'vitest';
import { enforceRateLimit, RATE_LIMIT_CONFIGS } from '../lib/rateLimit';
import { processReportBlackSpotLogic } from '../reports/reportBlackSpot';

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

describe('SEC-005: Rate Limiting Enforcement', () => {
  let db: any;

  beforeEach(() => {
    db = new MockFirestore();
  });

  it('allows SOS requests within the limit (max 3 per hour)', async () => {
    const userId = 'user_sos_test';
    const now = Date.now();

    const res1 = await enforceRateLimit(db, userId, 'sos', now);
    expect(res1.allowed).toBe(true);
    expect(res1.count).toBe(1);

    const res2 = await enforceRateLimit(db, userId, 'sos', now + 1000);
    expect(res2.allowed).toBe(true);
    expect(res2.count).toBe(2);

    const res3 = await enforceRateLimit(db, userId, 'sos', now + 2000);
    expect(res3.allowed).toBe(true);
    expect(res3.count).toBe(3);
  });

  it('rejects the 4th SOS request within 1 hour with RATE_LIMIT_EXCEEDED', async () => {
    const userId = 'user_sos_limit';
    const now = Date.now();

    await enforceRateLimit(db, userId, 'sos', now);
    await enforceRateLimit(db, userId, 'sos', now + 1000);
    await enforceRateLimit(db, userId, 'sos', now + 2000);

    // 4th request within 1 hour should fail
    await expect(enforceRateLimit(db, userId, 'sos', now + 3000)).rejects.toThrowError(
      /RATE_LIMIT_EXCEEDED/
    );
  });

  it('allows SOS request after the 1-hour window expires', async () => {
    const userId = 'user_sos_window';
    const now = Date.now();

    await enforceRateLimit(db, userId, 'sos', now);
    await enforceRateLimit(db, userId, 'sos', now + 1000);
    await enforceRateLimit(db, userId, 'sos', now + 2000);

    // After 1 hour + 5 seconds
    const afterWindow = now + (60 * 60 * 1000) + 5000;
    const res = await enforceRateLimit(db, userId, 'sos', afterWindow);
    expect(res.allowed).toBe(true);
  });

  it('allows up to 10 black spot hazard reports per 24 hours and rejects 11th', async () => {
    const userId = 'user_hazard_test';
    const now = Date.now();

    for (let i = 0; i < 10; i++) {
      const res = await processReportBlackSpotLogic(
        db,
        {
          title: `Pothole on Waiyaki Way #${i + 1}`,
          locationName: 'Waiyaki Way',
          severity: 'medium',
          location: { lat: -1.26, lng: 36.79 },
        },
        userId
      );
      expect(res.success).toBe(true);
    }

    // 11th report within 24h should fail
    await expect(
      processReportBlackSpotLogic(
        db,
        {
          title: 'Excessive hazard report',
          locationName: 'Thika Road',
          severity: 'high',
          location: { lat: -1.22, lng: 36.88 },
        },
        userId
      )
    ).rejects.toThrowError(/RATE_LIMIT_EXCEEDED/);
  });
});
