import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  processRegisterToken,
  processUnregisterToken,
  sanitizeTokenId,
} from '../alerts/registerDeviceToken';
import {
  processSendSosLogic,
  SendSosPayload,
  MessagingProvider,
  SmsProvider,
} from '../alerts/sendSOS';

class MemoryFirestore {
  public data: Record<string, Record<string, any>> = {};

  collection(collName: string) {
    return {
      doc: (docId: string) => this.docRef(`${collName}/${docId}`),
      where: () => ({
        get: async () => ({ docs: [], empty: true }),
      }),
      get: async () => {
        const prefix = `${collName}/`;
        const docs = Object.entries(this.data)
          .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
          .map(([k, d]) => ({
            id: k.slice(prefix.length),
            ref: this.docRef(k),
            data: () => d,
          }));
        return { docs, empty: docs.length === 0, forEach: (cb: (d: any) => void) => docs.forEach(cb) };
      },
    };
  }

  docRef(path: string) {
    return {
      id: path.split('/').pop() || '',
      path,
      get: async () => ({
        id: path.split('/').pop() || '',
        exists: !!this.data[path],
        data: () => this.data[path] || {},
      }),
      set: async (docData: any, opts?: { merge?: boolean }) => {
        if (opts?.merge && this.data[path]) {
          this.data[path] = { ...this.data[path], ...docData };
        } else {
          this.data[path] = { ...docData };
        }
      },
      update: async (updates: any) => {
        if (!this.data[path]) throw new Error(`Document ${path} does not exist`);
        this.data[path] = { ...this.data[path], ...updates };
      },
      delete: async () => {
        delete this.data[path];
      },
      create: async (docData: any) => {
        if (this.data[path]) throw new Error(`Document ${path} already exists`);
        this.data[path] = { ...docData };
      },
      collection: (subCollName: string) => {
        const subPrefix = `${path}/${subCollName}`;
        return {
          doc: (subDocId: string) => this.docRef(`${subPrefix}/${subDocId}`),
          get: async () => {
            const prefix = `${subPrefix}/`;
            const docs = Object.entries(this.data)
              .filter(([k]) => k.startsWith(prefix))
              .map(([k, d]) => ({
                id: k.slice(prefix.length),
                ref: this.docRef(k),
                data: () => d,
              }));
            return { docs, empty: docs.length === 0, forEach: (cb: (d: any) => void) => docs.forEach(cb) };
          },
        };
      },
    };
  }

  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const tx = {
      get: async (ref: any) => ref.get(),
      set: (ref: any, data: any, opts?: any) => ref.set(data, opts),
      update: (ref: any, data: any) => ref.update(data),
      delete: (ref: any) => ref.delete(),
    };
    return fn(tx);
  }
}

describe('FCM Device Push Notification Lifecycle (§27)', () => {
  let db: any;
  let mockMessaging: MessagingProvider;
  let mockSms: SmsProvider;

  beforeEach(() => {
    db = new MemoryFirestore();

    mockMessaging = {
      sendToTopic: vi.fn().mockResolvedValue({ messageId: 'topic_msg_123' }),
      sendToDevice: vi.fn().mockResolvedValue({ messageId: 'device_msg_456' }),
    };

    mockSms = {
      sendSms: vi.fn().mockResolvedValue({ messageId: 'sms_123', success: true }),
    };

    // Pre-populate user record
    db.data['users/passenger_1'] = {
      uid: 'passenger_1',
      displayName: 'Amina Kimani',
      role: 'passenger',
      activeRole: 'passenger',
      emergencyContacts: [
        { name: 'John Kimani', phone: '+254711000111', relationship: 'Spouse' },
      ],
    };

    // Pre-populate vehicle record
    db.data['vehicles/KCA_123A'] = {
      id: 'KCA_123A',
      regNumber: 'KCA 123A',
      registrationNumber: 'KCA 123A',
      saccoId: 'sacco_metro',
      status: 'active',
    };
  });

  describe('Token Registration & Unregistration (registerDeviceToken)', () => {
    it('registers a valid device token into subcollection and updates user doc', async () => {
      const token = 'fcm_token_valid_sample_web_browser_device_string_12345';
      const res = await processRegisterToken(db, 'passenger_1', {
        token,
        platform: 'web',
      });

      expect(res.success).toBe(true);
      expect(res.tokenId).toBe(sanitizeTokenId(token));

      // Assert private subcollection entry
      const subDocKey = `users/passenger_1/fcm_tokens/${res.tokenId}`;
      expect(db.data[subDocKey]).toBeDefined();
      expect(db.data[subDocKey].token).toBe(token);
      expect(db.data[subDocKey].platform).toBe('web');
      expect(db.data[subDocKey].userId).toBe('passenger_1');

      // Assert user doc fcmToken attribute
      expect(db.data['users/passenger_1'].fcmToken).toBe(token);
    });

    it('rejects invalid or empty token strings', async () => {
      await expect(
        processRegisterToken(db, 'passenger_1', { token: '' })
      ).rejects.toThrow();

      await expect(
        processRegisterToken(db, 'passenger_1', { token: 'short' })
      ).rejects.toThrow();
    });

    it('unregisters an existing device token and clears user doc attribute', async () => {
      const token = 'fcm_token_to_unregister_abcdef1234567890';
      await processRegisterToken(db, 'passenger_1', { token });

      const unregisterRes = await processUnregisterToken(db, 'passenger_1', { token });
      expect(unregisterRes.success).toBe(true);

      const subDocKey = `users/passenger_1/fcm_tokens/${sanitizeTokenId(token)}`;
      expect(db.data[subDocKey]).toBeUndefined();
      expect(db.data['users/passenger_1'].fcmToken).toBeNull();
    });
  });

  describe('SOS Push Dispatch (sendSOS direct device notifications)', () => {
    const defaultPayload: SendSosPayload = {
      alertId: 'sos_alert_unit_001',
      userId: 'passenger_1',
      vehicleRegNumber: 'KCA 123A',
      location: { lat: -1.286389, lng: 36.817223 }, // Nairobi, Kenya
      speedKmH: 45,
      message: 'Urgent assistance needed',
      timestamp: new Date().toISOString(),
    };

    it('dispatches to user device when a valid FCM token is stored', async () => {
      const token = 'fcm_active_registered_token_valid_12345678';
      await processRegisterToken(db, 'passenger_1', { token });

      const result = await processSendSosLogic(
        db,
        mockMessaging,
        mockSms,
        defaultPayload,
        { isAnonymous: false }
      );

      expect(result.success).toBe(true);
      expect(mockMessaging.sendToDevice).toHaveBeenCalledTimes(1);
      expect(mockMessaging.sendToDevice).toHaveBeenCalledWith(
        token,
        expect.objectContaining({
          notification: expect.objectContaining({
            title: expect.stringContaining('EMERGENCY SOS'),
          }),
        })
      );

      const deviceSummary = result.fcmSummary.find((s) => s.target.startsWith('device:'));
      expect(deviceSummary).toBeDefined();
      expect(deviceSummary?.status).toBe('dispatched');
      expect(result.fcmDispatchedCount).toBeGreaterThanOrEqual(1);

      // Verify passenger_fcm channel is included
      const channel = result.notifiedChannels?.find((c) => c.channel === 'passenger_fcm');
      expect(channel).toBeDefined();
      expect(channel?.status).toBe('dispatched');
    });

    it('does NOT call sendToDevice when caller has no registered FCM tokens', async () => {
      // Ensure no tokens on user
      delete db.data['users/passenger_1'].fcmToken;

      const result = await processSendSosLogic(
        db,
        mockMessaging,
        mockSms,
        { ...defaultPayload, alertId: 'sos_alert_unit_002' },
        { isAnonymous: false }
      );

      expect(result.success).toBe(true);
      expect(mockMessaging.sendToDevice).not.toHaveBeenCalled();
      const deviceSummary = result.fcmSummary.find((s) => s.target.startsWith('device:'));
      expect(deviceSummary).toBeUndefined();
    });

    it('gracefully handles stale or invalid FCM token without throwing and prunes it', async () => {
      const staleToken = 'fcm_stale_expired_token_1234567890';
      await processRegisterToken(db, 'passenger_1', { token: staleToken });

      // Mock sendToDevice failure with Firebase invalid/unregistered token error
      const staleError = new Error('Requested entity was not found: messaging/registration-token-not-registered');
      (staleError as any).code = 'messaging/registration-token-not-registered';
      mockMessaging.sendToDevice = vi.fn().mockRejectedValue(staleError);

      // Execute SOS — must not throw!
      const result = await processSendSosLogic(
        db,
        mockMessaging,
        mockSms,
        { ...defaultPayload, alertId: 'sos_alert_unit_003' },
        { isAnonymous: false }
      );

      expect(result.success).toBe(true);
      const deviceSummary = result.fcmSummary.find((s) => s.target.startsWith('device:'));
      expect(deviceSummary).toBeDefined();
      expect(deviceSummary?.status).toBe('failed');
      expect(result.dlqCount).toBeGreaterThanOrEqual(1);

      // Verify dead letter queue entry exists
      const dlqKeys = Object.keys(db.data).filter((k) => k.startsWith('dlq_notifications/dlq_fcm_device_'));
      expect(dlqKeys.length).toBeGreaterThanOrEqual(1);

      // Verify stale token was pruned from user profile
      expect(db.data['users/passenger_1'].fcmToken).toBeNull();
      const staleSubDocKey = `users/passenger_1/fcm_tokens/${sanitizeTokenId(staleToken)}`;
      expect(db.data[staleSubDocKey]).toBeUndefined();
    });
  });
});
