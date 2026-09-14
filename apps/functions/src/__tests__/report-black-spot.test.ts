import { describe, it, expect, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { reportBlackSpot, processReportBlackSpotLogic, ReportBlackSpotPayload } from '../reports/reportBlackSpot';

describe('Cloud Functions — reportBlackSpot (HAZ-001, RATE-001 & AUDIT-002)', () => {
  let mockDbData: Record<string, any>;
  let transactionOperations: Array<() => void>;

  function matchesFilter(actual: any, op: string, target: any) {
    if (op === '==') return actual === target;
    if (op === '!=') return actual !== target;
    if (op === '<') return actual < target;
    if (op === '<=') return actual <= target;
    if (op === '>') return actual > target;
    if (op === '>=') return actual >= target;
    return actual === target;
  }

  function createMockDb() {
    const createDocRef = (path: string, id: string) => ({
      id,
      path,
      get: async () => {
        const data = mockDbData[path];
        return {
          id,
          path,
          exists: !!data,
          data: () => data || {},
        };
      },
      set: async (data: any, opts?: { merge?: boolean }) => {
        if (opts?.merge && mockDbData[path]) {
          mockDbData[path] = { ...mockDbData[path], ...data };
        } else {
          mockDbData[path] = data;
        }
      },
      collection: (subColName: string) => createCollectionRef(`${path}/${subColName}`),
    });

    const createCollectionRef = (basePath: string) => {
      const createQuery = (filters: Array<{ field: string; op: string; val: any }>) => ({
        where: (field: string, op: string, val: any) =>
          createQuery([...filters, { field, op, val }]),
        get: async () => {
          const matches = Object.entries(mockDbData).filter(([k, d]) => {
            if (!k.startsWith(`${basePath}/`)) return false;
            const remainder = k.slice(basePath.length + 1);
            if (remainder.includes('/')) return false;
            return filters.every((filter) =>
              matchesFilter(d[filter.field], filter.op, filter.val)
            );
          });
          const docs = matches.map(([k, d]) => {
            const docId = k.slice(basePath.length + 1);
            return {
              id: docId,
              ref: createDocRef(k, docId),
              data: () => d,
            };
          });
          return { docs, size: docs.length, empty: docs.length === 0 };
        },
      });

      return {
        ...createQuery([]),
        doc: (docId?: string) => {
          const actualId = docId || `generated_id_${Math.random().toString(36).substring(2, 9)}`;
          const docPath = `${basePath}/${actualId}`;
          return createDocRef(docPath, actualId);
        },
      };
    };

    return {
      collection: (colName: string) => createCollectionRef(colName),
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
      // Default baseline trust 0.5 with no photo: 0.4*(1/3) + 0.4*0.5 + 0.2*0 = 0.333
      expect(spotDoc.confidenceScore).toBe(0.333);

      // Verify audit log document
      const auditDoc = mockDbData[`audit_logs/audit_${result拼.spotId}`];
      expect(auditDoc).toBeDefined();
      expect(auditDoc.action).toBe('REPORT_BLACK_SPOT');
      expect(auditDoc.actorUid).toBe('user_kamau_1');
    });

    it('calculates dynamic confidenceScore based on reporter trust score and photo presence', async () => {
      const mockDb = createMockDb() as any;

      // Seed user profiles with different trust scores
      mockDbData['users/high_trust_user'] = { uid: 'high_trust_user', trustScore: 0.9 };
      mockDbData['users/low_trust_user'] = { uid: 'low_trust_user', trustScore: 0.2 };
      mockDbData['users/percent_scale_user'] = { uid: 'percent_scale_user', trustScore: 80 }; // 0-100 scale

      // Distinct locations for testing standalone initial reports across different trust tiers
      const payloadHigh: ReportBlackSpotPayload = {
        title: 'Oil Spill on Dual Carriageway',
        location: { lat: -1.28, lng: 36.82 },
      };
      const payloadLow: ReportBlackSpotPayload = {
        title: 'Oil Spill on Dual Carriageway - Segment B',
        location: { lat: -1.32, lng: 36.82 },
      };
      const payloadPhoto: ReportBlackSpotPayload = {
        title: 'Oil Spill on Dual Carriageway - Segment C',
        location: { lat: -1.36, lng: 36.82 },
        photoUrl: 'https://example.com/evidence.jpg',
      };
      const payloadPercent: ReportBlackSpotPayload = {
        title: 'Oil Spill on Dual Carriageway - Segment D',
        location: { lat: -1.40, lng: 36.82 },
      };

      // 1. High trust user without photo: 0.4*(1/3) + 0.4*0.9 = 0.493
      const resHigh = await processReportBlackSpotLogic(mockDb, payloadHigh, 'high_trust_user');
      const spotHigh = mockDbData[`black_spots/${resHigh.spotId}`];

      // 2. Low trust user without photo: 0.4*(1/3) + 0.4*0.2 = 0.213
      const resLow = await processReportBlackSpotLogic(mockDb, payloadLow, 'low_trust_user');
      const spotLow = mockDbData[`black_spots/${resLow.spotId}`];

      // 3. High trust user WITH photo: 0.4*(1/3) + 0.4*0.9 + 0.2 = 0.693
      const resPhoto = await processReportBlackSpotLogic(mockDb, payloadPhoto, 'high_trust_user');
      const spotPhoto = mockDbData[`black_spots/${resPhoto.spotId}`];

      // 4. Percentage-scale user (80% -> 0.8): 0.4*(1/3) + 0.4*0.8 = 0.453
      const resPercent = await processReportBlackSpotLogic(mockDb, payloadPercent, 'percent_scale_user');
      const spotPercent = mockDbData[`black_spots/${resPercent.spotId}`];

      expect(spotHigh.confidenceScore).toBe(0.493);
      expect(spotLow.confidenceScore).toBe(0.213);
      expect(spotPhoto.confidenceScore).toBe(0.693);
      expect(spotPercent.confidenceScore).toBe(0.453);

      // Verify acceptance criteria:
      // Reports from different trust scores produce different confidence scores
      expect(spotHigh.confidenceScore).not.toBe(spotLow.confidenceScore);
      // Photo presence increases confidence score
      expect(spotPhoto.confidenceScore).toBeGreaterThan(spotHigh.confidenceScore);
      // Initial reports start at corroboration count 1
      expect(spotHigh.corroborationCount).toBe(1);
      expect(spotLow.corroborationCount).toBe(1);
      expect(spotPhoto.corroborationCount).toBe(1);
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

  describe('Black Spot Deduplication & Corroboration Engine', () => {
    it('corroborates two reports within radius (150m) and time window into a single document with incremented count', async () => {
      const mockDb = createMockDb() as any;
      const baseLocation = { lat: -1.286389, lng: 36.817223 };

      const report1: ReportBlackSpotPayload = {
        title: 'Deep Crater on Expressway Exit',
        description: 'Dangerous pothole damaging vehicle rims',
        location: baseLocation,
        severity: 'high',
        reportedByDisplayName: 'Reporter One',
      };

      const res1 = await processReportBlackSpotLogic(mockDb, report1, 'user_commuter_1');
      expect(res1.success).toBe(true);
      expect(res1.corroborated).toBe(false);

      const spotDocAfterFirst = mockDbData[`black_spots/${res1.spotId}`];
      expect(spotDocAfterFirst).toBeDefined();
      expect(spotDocAfterFirst.corroborationCount).toBe(1);
      expect(spotDocAfterFirst.confidenceScore).toBe(0.333);

      // Report 2 is ~60m away (lat shifted by ~0.0005 deg) by a different user
      const report2: ReportBlackSpotPayload = {
        title: 'Crater Pothole near CBD exit',
        description: 'Saw three matatus swerve into oncoming lane to avoid it',
        location: { lat: -1.285889, lng: 36.817223 },
        severity: 'critical',
        reportedByDisplayName: 'Reporter Two',
      };

      const res2 = await processReportBlackSpotLogic(mockDb, report2, 'user_commuter_2');
      expect(res2.success).toBe(true);
      expect(res2.corroborated).toBe(true);
      expect(res2.spotId).toBe(res1.spotId);

      // Exactly ONE black_spots document must exist
      const blackSpotKeys = Object.keys(mockDbData).filter((k) =>
        k.startsWith('black_spots/') && !k.includes('/reports/') && !k.includes('/confirmations/')
      );
      expect(blackSpotKeys).toHaveLength(1);

      const spotDocAfterSecond = mockDbData[`black_spots/${res1.spotId}`];
      expect(spotDocAfterSecond.corroborationCount).toBe(2);
      expect(spotDocAfterSecond.corroborationsCount).toBe(2);
      // Recomputed confidence: 0.4*(2/3) + 0.4*0.5 + 0 = 0.267 + 0.2 = 0.467
      expect(spotDocAfterSecond.confidenceScore).toBe(0.467);
      expect(spotDocAfterSecond.confidenceScore).toBeGreaterThan(spotDocAfterFirst.confidenceScore);
      expect(spotDocAfterSecond.lastReportedAt).toBeDefined();

      // Reports subcollection under the black spot must contain details of both reports
      const subReports = Object.entries(mockDbData).filter(([k]) =>
        k.startsWith(`black_spots/${res1.spotId}/reports/`)
      );
      expect(subReports).toHaveLength(2);

      const reportUsers = subReports.map(([_, d]) => d.reportedByUid);
      expect(reportUsers).toContain('user_commuter_1');
      expect(reportUsers).toContain('user_commuter_2');

      // Audit log for corroboration must be recorded
      const corroborationAudit = Object.values(mockDbData).find(
        (doc: any) => doc.action === 'CORROBORATE_BLACK_SPOT' && doc.actorUid === 'user_commuter_2'
      );
      expect(corroborationAudit).toBeDefined();
    });

    it('creates two separate documents for reports outside the deduplication radius (> 150m)', async () => {
      const mockDb = createMockDb() as any;

      const report1: ReportBlackSpotPayload = {
        title: 'Road Hazard at Point A',
        location: { lat: -1.286389, lng: 36.817223 },
      };

      // Point B is ~1.5 km away (outside 150m radius)
      const report2: ReportBlackSpotPayload = {
        title: 'Road Hazard at Point B',
        location: { lat: -1.300000, lng: 36.817223 },
      };

      const res1 = await processReportBlackSpotLogic(mockDb, report1, 'user_commuter_1');
      const res2 = await processReportBlackSpotLogic(mockDb, report2, 'user_commuter_2');

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res1.spotId).not.toBe(res2.spotId);
      expect(res1.corroborated).toBe(false);
      expect(res2.corroborated).toBe(false);

      const blackSpotKeys = Object.keys(mockDbData).filter((k) =>
        k.startsWith('black_spots/') && !k.includes('/reports/') && !k.includes('/confirmations/')
      );
      expect(blackSpotKeys).toHaveLength(2);

      const spot1 = mockDbData[`black_spots/${res1.spotId}`];
      const spot2 = mockDbData[`black_spots/${res2.spotId}`];
      expect(spot1.corroborationCount).toBe(1);
      expect(spot2.corroborationCount).toBe(1);
    });

    it('creates a new document rather than reviving an archived or decayed black spot', async () => {
      const mockDb = createMockDb() as any;
      const hazardLocation = { lat: -1.286389, lng: 36.817223 };

      // Case A: Pre-existing spot is archived
      mockDbData['black_spots/archived_spot_1'] = {
        id: 'archived_spot_1',
        spotId: 'archived_spot_1',
        title: 'Old Hazard in 2024',
        status: 'archived',
        latitude: hazardLocation.lat,
        longitude: hazardLocation.lng,
        location: hazardLocation,
        corroborationCount: 5,
        lastReportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // Case B: Pre-existing spot is resolved
      mockDbData['black_spots/resolved_spot_1'] = {
        id: 'resolved_spot_1',
        spotId: 'resolved_spot_1',
        title: 'Repaired Hazard',
        status: 'resolved',
        latitude: hazardLocation.lat,
        longitude: hazardLocation.lng,
        location: hazardLocation,
        corroborationCount: 4,
        lastReportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // Case C: Pre-existing spot is stale (> 14 days old, per decayStaleBlackSpots rolling window)
      const staleTimestamp = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
      mockDbData['black_spots/stale_spot_1'] = {
        id: 'stale_spot_1',
        spotId: 'stale_spot_1',
        title: 'Expired Hazard from Last Month',
        status: 'pending',
        latitude: hazardLocation.lat,
        longitude: hazardLocation.lng,
        location: hazardLocation,
        corroborationCount: 2,
        lastReportedAt: staleTimestamp,
      };

      const newReportPayload: ReportBlackSpotPayload = {
        title: 'Fresh Pothole at Same Location',
        location: hazardLocation,
      };

      const res = await processReportBlackSpotLogic(mockDb, newReportPayload, 'user_fresh_reporter');

      expect(res.success).toBe(true);
      expect(res.corroborated).toBe(false);
      // New spotId must not be any of the stale/archived/resolved IDs
      expect(res.spotId).not.toBe('archived_spot_1');
      expect(res.spotId).not.toBe('resolved_spot_1');
      expect(res.spotId).not.toBe('stale_spot_1');

      // The new document starts fresh at corroborationCount: 1
      const newSpot = mockDbData[`black_spots/${res.spotId}`];
      expect(newSpot).toBeDefined();
      expect(newSpot.corroborationCount).toBe(1);
      expect(newSpot.status).toBe('pending');
    });

    it('corroborates ten reports of the same real-world hazard from ten different accounts into one document with corroborationCount: 10', async () => {
      const mockDb = createMockDb() as any;
      const hazardCenter = { lat: -0.985, lng: 36.589 }; // Mai Mahiu Escarpment

      // Ten independent commuters report the same hazard within a 50m cluster over several hours
      for (let i = 1; i <= 10; i++) {
        // Slight GPS jitter within 40 meters (~0.0003 deg)
        const latJitter = hazardCenter.lat + (i % 3 === 0 ? 0.0002 : -0.0001);
        const lngJitter = hazardCenter.lng + (i % 2 === 0 ? 0.0002 : -0.0001);

        const payload: ReportBlackSpotPayload = {
          title: 'Dangerous Oil Slick on Mai Mahiu Corner',
          description: `Reported by commuter ${i}`,
          location: { lat: latJitter, lng: lngJitter },
          severity: 'high',
          reportedByDisplayName: `Commuter ${i}`,
        };

        const result = await processReportBlackSpotLogic(mockDb, payload, `commuter_account_${i}`);
        expect(result.success).toBe(true);

        if (i === 1) {
          expect(result.corroborated).toBe(false);
        } else {
          expect(result.corroborated).toBe(true);
        }
      }

      // Exactly ONE black_spots document must exist (no map clutter / duplicates)
      const blackSpotKeys = Object.keys(mockDbData).filter((k) =>
        k.startsWith('black_spots/') && !k.includes('/reports/') && !k.includes('/confirmations/')
      );
      expect(blackSpotKeys).toHaveLength(1);

      const consolidatedSpot = mockDbData[blackSpotKeys[0]];
      expect(consolidatedSpot).toBeDefined();
      expect(consolidatedSpot.corroborationCount).toBe(10);
      expect(consolidatedSpot.corroborationsCount).toBe(10);

      // Max corroboration factor reaches 1.0 (corroborations >= 3)
      // Confidence: 0.4 * 1.0 + 0.4 * 0.5 + 0 = 0.600
      expect(consolidatedSpot.confidenceScore).toBe(0.6);

      // All 10 individual report details are preserved in the reports subcollection
      const allSubReports = Object.entries(mockDbData).filter(([k]) =>
        k.startsWith(`${blackSpotKeys[0]}/reports/`)
      );
      expect(allSubReports).toHaveLength(10);
    });

    it('respects product-tunable deduplication parameters from system_config/black_spots', async () => {
      const mockDb = createMockDb() as any;

      // Seed custom tunable parameters: tight 50m radius instead of default 150m
      mockDbData['system_config/black_spots'] = {
        deduplicationRadiusMeters: 50,
        deduplicationWindowDays: 7,
      };

      const baseLocation = { lat: -1.286389, lng: 36.817223 };

      const res1 = await processReportBlackSpotLogic(
        mockDb,
        { title: 'Spot Alpha', location: baseLocation },
        'user_alpha'
      );
      expect(res1.success).toBe(true);

      // Spot Beta is ~80m away (lat shift of ~0.00072 deg = ~80m)
      // Outside custom 50m radius, but within default 150m radius
      const res2 = await processReportBlackSpotLogic(
        mockDb,
        { title: 'Spot Beta', location: { lat: -1.285669, lng: 36.817223 } },
        'user_beta'
      );
      expect(res2.success).toBe(true);

      // Because the tunable radius is 50m, this must create 2 separate documents
      expect(res2.corroborated).toBe(false);
      expect(res2.spotId).not.toBe(res1.spotId);

      const blackSpotKeys = Object.keys(mockDbData).filter((k) =>
        k.startsWith('black_spots/') && !k.includes('/reports/') && !k.includes('/confirmations/')
      );
      expect(blackSpotKeys).toHaveLength(2);
    });
  });
});
