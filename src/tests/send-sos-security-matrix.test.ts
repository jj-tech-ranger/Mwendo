import { describe, expect, it, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { processSendSosLogic } from '../../apps/functions/src/alerts/sendSOS';

type Stored = Record<string, any>;

function makeDb(userId = 'passenger_1') {
  const stored: Stored = {};
  const db: any = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const key = `${name}/${id}`;
          if (name === 'users' && id === userId) {
            return { exists: true, data: () => ({ displayName: 'Passenger', emergencyContacts: [] }) };
          }
          return { exists: key in stored, data: () => stored[key] || {} };
        },
        create: async (data: any) => {
          const key = `${name}/${id}`;
          if (key in stored) {
            const error: any = new Error('ALREADY_EXISTS');
            error.code = 6;
            throw error;
          }
          stored[key] = data;
        },
        set: async (data: any, options?: { merge?: boolean }) => {
          const key = `${name}/${id}`;
          stored[key] = options?.merge ? { ...(stored[key] || {}), ...data } : data;
        },
        update: async (data: any) => {
          const key = `${name}/${id}`;
          stored[key] = { ...(stored[key] || {}), ...data };
        },
      }),
    }),
  };
  return { db, stored };
}

function expectHttpsError(promise: Promise<unknown>, code: string) {
  return expect(promise).rejects.toMatchObject({ code });
}

describe('CF-006: SOS security matrix', () => {
  it('rejects missing caller identity', async () => {
    const { db } = makeDb();
    await expectHttpsError(
      processSendSosLogic(db, { sendToTopic: vi.fn() }, { sendSms: vi.fn() }, {
        location: { lat: -1.286, lng: 36.817 },
      }),
      'unauthenticated'
    );
  });

  it('rejects invalid coordinates and impossible speed values', async () => {
    const { db } = makeDb();
    const providers = { sendToTopic: vi.fn(), sendSms: vi.fn() };

    await expectHttpsError(
      processSendSosLogic(db, providers, providers, {
        userId: 'passenger_1',
        location: { lat: 91, lng: 36.817 },
      }),
      'invalid-argument'
    );

    await expectHttpsError(
      processSendSosLogic(db, providers, providers, {
        userId: 'passenger_1',
        location: { lat: -1.286, lng: 36.817 },
        speedKmH: 181,
      }),
      'invalid-argument'
    );
  });

  it('rejects oversized messages before dispatch', async () => {
    const { db } = makeDb();
    const sendToTopic = vi.fn();
    const sendSms = vi.fn();

    await expectHttpsError(
      processSendSosLogic(db, { sendToTopic }, { sendSms }, {
        userId: 'passenger_1',
        location: { lat: -1.286, lng: 36.817 },
        message: 'x'.repeat(1001),
      }),
      'invalid-argument'
    );

    expect(sendToTopic).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('returns the persisted result for a completed repeated request', async () => {
    const { db, stored } = makeDb();
    const alertId = 'sos_idempotent_1';
    const result = {
      success: true,
      alertId,
      userId: 'passenger_1',
      saccoId: 'sacco_1',
      contactsNotifiedCount: 0,
      fcmDispatchedCount: 1,
      dlqCount: 0,
      contactsSummary: [],
      fcmSummary: [{ target: 'authority_alerts', status: 'dispatched' as const }],
    };
    stored[`sos_requests/${alertId}`] = { status: 'completed', result };

    const sendToTopic = vi.fn();
    const sendSms = vi.fn();
    const actual = await processSendSosLogic(db, { sendToTopic }, { sendSms }, {
      alertId,
      userId: 'passenger_1',
      location: { lat: -1.286, lng: 36.817 },
    });

    expect(actual).toEqual(result);
    expect(sendToTopic).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('rejects an already-processing request instead of dispatching twice', async () => {
    const { db } = makeDb();
    const alertId = 'sos_processing_1';
    const stored = (db.collection('sos_requests').doc as any);
    // Seed through the mock's public persistence path.
    await db.collection('sos_requests').doc(alertId).set({ status: 'processing' });

    await expectHttpsError(
      processSendSosLogic(db, { sendToTopic: vi.fn() }, { sendSms: vi.fn() }, {
        alertId,
        userId: 'passenger_1',
        location: { lat: -1.286, lng: 36.817 },
      }),
      'aborted'
    );

    expect(stored).toBeDefined();
  });
});
