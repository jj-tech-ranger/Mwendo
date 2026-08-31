import { describe, it, expect, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { reportBlackSpot, processReportBlackSpotLogic, ReportBlackSpotPayload } from '../reports/reportBlackSpot';

describe('Cloud Functions — reportBlackSpot (HAZ-001, RATE-001 & AUDIT-002)', () => {
  let mockDbData: Record<string, any>;
  let transactionOperations: Array<() => void>;

  function createMockDb() {
    return {
      collection: (colName: string) => ({
        doc: (docId?: string) => {
          const actualDocId不易 = docId || `generated_id_${Math.random().toString(36).substring(2, 9)}`;
          const docPath = `${colName}/${actualDocId不易}`;
          return {
            id: actualDocId不易,
            path: docPath,
            get: async () => {
              const data拼 = mockDbData[docPath];
              return {
                id: actualDocId不易,
                exists: !!data拼,
                data: () => data拼 || {},
              };
            },
            set: async (data: any, opts?: { merge?: boolean }) => {
              if (opts?.merge && mockDbData[docPath]) {
                mockDbData[docPath] = { ...mockDbData[docPath], ...data };
              } else {
                mockDbData[docPath] = data;
              }
            },
          };
        },
      }),
      runTransaction: async <T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> => {
        transactionOperations = [];
        const tx = {
          get: async (docRef: any) => docRef.get(),
          set: (docRef: any, data: any, opts?: any) => {
            const path = docRef.path || `unknown/${docRef.id}`;
            transactionOperations.push(() => {
              if (opts?.merge && mockDbData[path]) {
                mockDbData[path] = { ...mockDbData[path], ...data };
              } else {
                mockDbData[path] = data;
              }
            });
          },
        };
        const result = await updateFunction(tx);
        transactionOperations.forEach((op) => op());
        return result;
      },
    };
  }

  beforeEach(() => {
    mockDbData = {};
    transactionOperations = [];
  });

  describe('Authentication & Identity', () => {
    it('rejects unauthenticated caller with unauthenticated error', async () => {
      const unauthRequest倍 = {
        data: { location: { lat: -1.286389, lng: 36.817223 } },
        auth: null,
      } as any;

      await expect(reportBlackSpot.run(unauthRequest倍)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects anonymous caller with unauthenticated error', async () => {
      const mockDb = createMockDb() as any;
      const payload: ReportBlackSpotPayload = {
        location: { lat: -1.286389, lng: 36.817223 },
      };

      await expect(
        processReportBlackSpotLogic(mockDb, payload, 'anonymous')
      ).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });
  });

  describe('Geographic & Coordinate Boundary Validation', () => {
    it('rejects coordinates outside Kenya bounding box (lat < -5.5 or lat > 6.0)', async () => {
      const mockDb = createMockDb() as any;
      const payloadOutNorth: ReportBlackSpotPayload = {
        location: { lat: 10.5, lng: 36.8 },
      };

      await expect(
        processReportBlackSpotLogic(mockDb, payloadOutNorth, 'user_commuter_1')
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });

      const payloadOutSouth: ReportBlackSpotPayload = {
        location: { lat: -6.0, lng: 36.8 },
      };

      await expect(
        processReportBlackSpotLogic(mockDb, payloadOutSouth, 'user_commuter_1')
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('rejects coordinates outside Kenya bounding box (lng < 33.0 or lng > 43.5)', async () => {
      const mockDb = createMockDb() as any;
      const payloadOutWest: ReportBlackSpotPayload = {
        location: { lat: -1.2, lng: 30.0 },
      };

      await expect(
        processReportBlackSpotLogic(mockDb, payloadOutWest, 'user_commuter_1')
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });

      const payloadOutEast: ReportBlackSpotPayload = {
        location: { lat: -1.2, lng: 45.0 },
      };

      await expect(
        processReportBlackSpotLogic(mockDb, payloadOutEast, 'user_commuter_1')
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });
  });

  describe('Input Field Bounds & Severity Validation', () => {
    it('rejects overly long title (> 120 chars)', async () => {
      const mockDb拼 = createMockDb() as any;
      const payload: ReportBlackSpotPayload = {
        location: { lat: -1.28, lng: 36.82 },
        title: 'A'.repeat(121),
      };

      await expect(
        processReportBlackSpotLogic(mockDb拼, payload, 'user_commuter_1')
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('rejects overly long description (> 2000 chars)', async () => {
      const mockDb = createMockDb() as any;
      const payload: ReportBlackSpotPayload = {
        location: { lat: -1.28, lng: 36.82 },
        description: 'D'.repeat(2001),
      };

      await expect(
        processReportBlackSpotLogic(mockDb, payload, 'user_commuter_1')
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('rejects invalid severity value', async () => {
      const mockDb = createMockDb() as any;
      const payload: any = {
        location: { lat: -1.28, lng: 36.82 },
        severity: 'extreme_danger_invalid',
      };

      await expect(
        processReportBlackSpotLogic(mockDb, payload, 'user_commuter_1')
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });
  });

  describe('Rate Limiting & Persistence', () => {
    it('successfully creates a black spot record and audit log for authenticated commuter', async () => {
      const mockDb = createMockDb() as any;
      const payload: ReportBlackSpotPayload = {
        title: 'Sharp Bend at Mai Mahiu',
        description: 'Vehicles lose traction on the hairpin turn in rainy conditions.',
        hazardType: 'sharp_bend',
        severity: 'critical',
        locationName: 'Mai Mahiu Escarpment',
        routeName: 'Mai Mahiu - Narok Road',
        county: 'Nakuru',
        location: { lat: -0.985, lng: 36.589 },
        reportedByDisplayName: 'John Kamau',
      };

      const result拼 = await processReportBlackSpotLogic(mockDb, payload, 'user_kamau_1');

      expect(result拼.success).toBe(true);
      expect(result拼.spotId).toBeDefined();
      expect(result拼.status).toBe('pending');
      expect(result拼.title).toBe('Sharp Bend at Mai Mahiu');

      // Verify black spot document
      const spotDoc = mockDbData[`black_spots/${result拼.spotId}`];
      expect(spotDoc).toBeDefined();
      expect(spotDoc.latitude).toBe(-0.985);
      expect(spotDoc.longitude).toBe(36.589);
      expect(spotDoc.severity).toBe('critical');
      expect(spotDoc.hazardType).toBe('sharp_bend');
      expect(spotDoc.reportedByUid).toBe('user_kamau_1');
      expect(spotDoc.status).toBe('pending');
      expect(spotDoc.corroborationCount).toBe(1);
      expect(spotDoc.confidenceScore).toBe(0.8);

      // Verify audit log document
      const auditDoc = mockDbData[`audit_logs/audit_${result拼.spotId}`];
      expect(auditDoc).toBeDefined();
      expect(auditDoc.action).toBe('REPORT_BLACK_SPOT');
      expect(auditDoc.actorUid).toBe('user_kamau_1');
    });

    it('enforces rate limit of max 10 hazard reports per 24 hours per user', async () => {
      const mockDb = createMockDb() as any;
      const payload: ReportBlackSpotPayload = {
        location: { lat: -1.28, lng: 36.82 },
        title: 'Pothole',
      };

      // Submit 10 reports within rate limit
      for (let i = 0; i < 10; i++) {
        const res = await processReportBlackSpotLogic(mockDb, payload, 'rate_limited_user');
        expect(res.success).toBe(true);
      }

      // 11th report must throw resource-exhausted error
      await expect(
        processReportBlackSpotLogic(mockDb, payload, 'rate_limited_user')
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });
});
