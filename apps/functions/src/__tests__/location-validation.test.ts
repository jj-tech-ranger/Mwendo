import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
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
        create: async (docData: any) => {
          const key = `${collName}/${docId}`;
          if (this.data[key]) throw new Error('ALREADY_EXISTS');
          this.data[key] = docData;
        },
        set: async (docData: any, opts?: { merge?: boolean }) => {
          const key = `${collName}/${docId}`;
          if (opts?.merge) {
            this.data[key] = { ...(this.data[key] || {}), ...docData };
          } else {
            this.data[key] = docData;
          }
        },
        update: async (docData: any) => {
          const key = `${collName}/${docId}`;
          this.data[key] = { ...(this.data[key] || {}), ...docData };
        },
      }),
    };
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    const tx = {
      get: async (docRef: any) => docRef.get(),
      set: (docRef: any, data: any, opts?: any) => docRef.set(data, opts),
    };
    return await updateFunction(tx);
  }
}

describe('MED-02: Cloud Functions Location Validation & Zero Coordinate Fallback', () => {
  let db: any;
  let mockMessaging: any;
  let mockSms: any;

  beforeEach(() => {
    db = new MockFirestore();
    mockMessaging = {
      sendToTopic: vi.fn().mockResolvedValue({ messageId: 'fcm-123' }),
    };
    mockSms = {
      sendSms: vi.fn().mockResolvedValue({ messageId: 'sms-123', success: true }),
    };
  });

  describe('reportBlackSpot', () => {
    it('rejects report with missing location (no location object or lat/lng)', async () => {
      const payload = {
        title: 'Deep Pothole',
        locationName: 'Mombasa Road',
        severity: 'high' as const,
      };

      await expect(
        processReportBlackSpotLogic(db, payload as any, 'user_test_123')
      ).rejects.toThrowError(HttpsError);

      await expect(
        processReportBlackSpotLogic(db, payload as any, 'user_test_123')
      ).rejects.toThrowError('A valid location is required.');

      expect(Object.keys(db.data).length).toBe(0);
    });

    it('rejects report with non-finite or invalid coordinates (e.g. NaN, null, string)', async () => {
      const payload = {
        title: 'Hazard',
        location: { lat: NaN, lng: 36.817223 },
      };

      await expect(
        processReportBlackSpotLogic(db, payload as any, 'user_test_123')
      ).rejects.toThrowError('A valid location is required.');
    });

    it('successfully processes report when valid finite coordinates are provided', async () => {
      const payload = {
        title: 'Dangerous Intersection',
        location: { lat: -1.3005, lng: 36.8501 },
      };

      const result = await processReportBlackSpotLogic(db, payload as any, 'user_test_123');
      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');

      const savedDocs = Object.keys(db.data);
      const blackSpotDocKey = savedDocs.find((k) => k.startsWith('black_spots/'));
      expect(blackSpotDocKey).toBeDefined();
      expect(db.data[blackSpotDocKey!].latitude).toBe(-1.3005);
      expect(db.data[blackSpotDocKey!].longitude).toBe(36.8501);
    });
  });

  describe('sendSOS', () => {
    it('rejects SOS invocation when location is omitted', async () => {
      const payload = {
        alertId: 'sos_no_loc',
        userId: 'user_sos_1',
        vehicleRegNumber: 'KBZ 100A',
        saccoId: 'sacco_express',
      };

      await expect(
        processSendSosLogic(db, mockMessaging, mockSms, payload as any)
      ).rejects.toThrowError(HttpsError);

      await expect(
        processSendSosLogic(db, mockMessaging, mockSms, payload as any)
      ).rejects.toThrowError('A valid location is required.');

      expect(Object.keys(db.data).length).toBe(0);
      expect(mockSms.sendSms).not.toHaveBeenCalled();
      expect(mockMessaging.sendToTopic).not.toHaveBeenCalled();
    });

    it('rejects SOS invocation when coordinates are non-finite', async () => {
      const payload = {
        alertId: 'sos_invalid_coords',
        userId: 'user_sos_1',
        location: { lat: Infinity, lng: 36.817223 },
      };

      await expect(
        processSendSosLogic(db, mockMessaging, mockSms, payload as any)
      ).rejects.toThrowError('A valid location is required.');
    });

    it('successfully dispatches SOS when valid finite coordinates are provided', async () => {
      const payload = {
        alertId: 'sos_valid_1',
        userId: 'user_sos_1',
        vehicleRegNumber: 'KDA 777B',
        saccoId: 'sacco_metro',
        location: { lat: -1.2921, lng: 36.8219 },
      };

      const result = await processSendSosLogic(db, mockMessaging, mockSms, payload as any);
      expect(result.success).toBe(true);
      expect(result.alertId).toBe('sos_valid_1');
    });
  });
});
