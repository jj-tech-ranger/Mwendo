import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processTripCompletion,
  processTripCompletionLogic,
} from '../trips/processTripCompletion';
import { GPSSample } from '../lib/engine';
import { normalizePlate } from '../lib/plate';

describe('Cloud Functions — processTripCompletion (Server-Authoritative Violations & Risk Pipeline)', () => {
  let mockDbData: Record<string, any>;
  let mockAuditLogs: any[];

  function createMockDb() {
    return {
      collection: (colName: string) => ({
        doc: (docId: string) => ({
          get: async () => {
            const data = mockDbData[`${colName}/${docId}`];
            return {
              exists: !!data,
              data: () => data || {},
            };
          },
          set: async (data: any, options?: { merge: boolean }) => {
            const key = `${colName}/${docId}`;
            if (options?.merge && mockDbData[key]) {
              mockDbData[key] = { ...mockDbData[key], ...data };
            } else {
              mockDbData[key] = data;
            }
          },
          collection: (subCol: string) => ({
            doc: (subDocId: string) => ({
              set: async (subData: any, subOptions?: { merge: boolean }) => {
                const subKey = `${colName}/${docId}/${subCol}/${subDocId}`;
                if (subOptions?.merge && mockDbData[subKey]) {
                  mockDbData[subKey] = { ...mockDbData[subKey], ...subData };
                } else {
                  mockDbData[subKey] = subData;
                }
              },
            }),
          }),
        }),
        where: (field: string, op: string, value: any) => ({
          where: (f2: string, o2: string, v2: any) => ({
            limit: (n: number) => ({
              get: async () => {
                const docs = Object.entries(mockDbData)
                  .filter(
                    ([k, val]) =>
                      k.startsWith(`${colName}/`) &&
                      !k.includes('/', colName.length + 1) &&
                      val[field] === value &&
                      val[f2] === v2
                  )
                  .slice(0, n)
                  .map(([_, d]) => ({ data: () => d }));
                return { docs, size: docs.length };
              },
            }),
          }),
          limit: (n: number) => ({
            get: async () => {
              const docs = Object.entries(mockDbData)
                .filter(
                  ([k, val]) =>
                    k.startsWith(`${colName}/`) &&
                    !k.includes('/', colName.length + 1) &&
                    val[field] === value
                )
                .slice(0, n)
                .map(([_, d]) => ({ data: () => d }));
              return { docs, size: docs.length };
            },
          }),
        }),
        add: async (data: any) => {
          mockAuditLogs.push(data);
          return { id: `audit_${Date.now()}` };
        },
      }),
      runTransaction: async (updateFn: (tx: any) => Promise<any>) => {
        const tx = {
          get: async (docRef: any) => {
            return await docRef.get();
          },
          set: (docRef: any, data: any) => {
            return docRef.set(data);
          },
        };
        return await updateFn(tx);
      },
    } as any;
  }

  beforeEach(() => {
    mockDbData = {};
    mockAuditLogs = [];
    vi.clearAllMocks();
  });

  describe('Security, Ownership and Payload Validation', () => {
    it('rejects unauthenticated caller with unauthenticated HttpsError', async () => {
      const unauthRequest = {
        data: {
          tripId: 'trip_100',
          samples: [],
        },
        auth: null,
      } as any;

      await expect(processTripCompletion.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects request with missing or invalid tripId', async () => {
      const db = createMockDb();
      await expect(
        processTripCompletionLogic(db, { tripId: '', samples: [] })
      ).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('rejects caller attempting to finalize a trip belonging to another passenger', async () => {
      const db = createMockDb();
      mockDbData['trips/trip_passenger_1'] = {
        id: 'trip_passenger_1',
        userId: 'user_original_owner',
        vehicleRegNumber: 'KCA 999Z',
        saccoId: 'sacco_metro',
        status: 'active',
      };

      const attackerAuth = { uid: 'user_attacker', role: 'passenger' };

      await expect(
        processTripCompletionLogic(
          db,
          { tripId: 'trip_passenger_1', samples: [] },
          attackerAuth
        )
      ).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });

    it('allows trip owner, admin, or authority to process trip completion', async () => {
      const db = createMockDb();
      mockDbData['trips/trip_passenger_2'] = {
        id: 'trip_passenger_2',
        userId: 'user_owner',
        vehicleRegNumber: 'KCA 999Z',
        saccoId: 'sacco_metro',
        status: 'active',
      };

      const ownerAuth = { uid: 'user_owner', role: 'passenger' };
      const res = await processTripCompletionLogic(
        db,
        { tripId: 'trip_passenger_2', samples: [] },
        ownerAuth
      );

      expect(res.success).toBe(true);
      expect(res.processed).toBe(true);
    });
  });

  describe('End-to-End Synthetic Trip: Violation Detection & Risk Score Movement', () => {
    it('completing a trip with a synthetic sustained overspeed event creates an auditable violation document and adjusts vehicle risk', async () => {
      const db = createMockDb();
      const tripId = 'trip_synthetic_overspeed_01';
      const vehicleReg = 'KCA 999Z';
      const saccoId = 'sacco_metro';
      const routeName = 'Nairobi - Thika Road';
      const baseTime = new Date('2026-08-08T10:00:00Z').getTime();

      const cleanPlate = normalizePlate(vehicleReg);
      // Seed initial vehicle state: score 100
      mockDbData[`vehicles/${cleanPlate}`] = {
        regNumber: cleanPlate,
        saccoId,
        riskScore: 100,
        riskTier: 'low',
        status: 'active',
      };

      // Seed trip document
      mockDbData[`trips/${tripId}`] = {
        id: tripId,
        userId: 'user_commuter_1',
        vehicleRegNumber: vehicleReg,
        saccoId,
        routeName,
        status: 'active',
      };

      // Generate identical synthetic GPS stream as src/lib/integration.test.ts: 5 seconds sustained at 105 km/h
      const syntheticTripSamples: GPSSample[] = [
        { latitude: -1.28, longitude: 36.82, speedKmH: 60, accuracy: 10, timestamp: new Date(baseTime).toISOString() },
        { latitude: -1.281, longitude: 36.821, speedKmH: 105, accuracy: 12, timestamp: new Date(baseTime + 1000).toISOString() },
        { latitude: -1.282, longitude: 36.822, speedKmH: 105, accuracy: 11, timestamp: new Date(baseTime + 2000).toISOString() },
        { latitude: -1.283, longitude: 36.823, speedKmH: 105, accuracy: 10, timestamp: new Date(baseTime + 3000).toISOString() },
        { latitude: -1.284, longitude: 36.824, speedKmH: 105, accuracy: 12, timestamp: new Date(baseTime + 4000).toISOString() },
        { latitude: -1.285, longitude: 36.825, speedKmH: 105, accuracy: 10, timestamp: new Date(baseTime + 5000).toISOString() },
        { latitude: -1.286, longitude: 36.826, speedKmH: 60, accuracy: 10, timestamp: new Date(baseTime + 6000).toISOString() },
      ];

      const result = await processTripCompletionLogic(
        db,
        {
          tripId,
          samples: syntheticTripSamples,
          speedLimitKmH: 80,
        },
        { uid: 'user_commuter_1', role: 'passenger' }
      );

      // Verify execution results
      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
      expect(result.violationsCount).toBe(1);
      expect(result.violations.length).toBe(1);

      // 1. Verify deterministic violation document in violations collection
      const expectedViolationId = `viol_${tripId}_0`;
      const createdViolation = mockDbData[`violations/${expectedViolationId}`];
      expect(createdViolation).toBeDefined();
      expect(createdViolation.id).toBe(expectedViolationId);
      expect(createdViolation.violationId).toBe(expectedViolationId);
      expect(createdViolation.vehicleRegNumber).toBe(cleanPlate);
      expect(createdViolation.saccoId).toBe(saccoId);
      expect(createdViolation.routeName).toBe(routeName);
      expect(createdViolation.speedLimitKmH).toBe(80);
      expect(createdViolation.recordedSpeedKmH).toBeGreaterThan(95);
      expect(createdViolation.durationSec).toBeGreaterThanOrEqual(4.0);
      expect(createdViolation.severity).toBe('high');
      expect(createdViolation.status).toBe('pending');
      expect(createdViolation.isCorroborated).toBe(false);
      expect(createdViolation.latitude).toBeCloseTo(-1.28, 1);
      expect(createdViolation.longitude).toBeCloseTo(36.82, 1);

      // 2. Verify vehicle risk score movement
      const updatedVehicle = mockDbData[`vehicles/${cleanPlate}`];
      expect(updatedVehicle).toBeDefined();
      expect(updatedVehicle.riskScore).toBeLessThanOrEqual(100);
      expect(updatedVehicle.riskScore).toBeGreaterThanOrEqual(80);
      expect(result.latestRiskScore).toBe(updatedVehicle.riskScore);

      // 3. Verify public-safe vehicle projection updated
      const publicProjection = mockDbData[`vehicle_public_summary/${cleanPlate}`];
      expect(publicProjection).toBeDefined();
      expect(publicProjection.riskScore).toBe(updatedVehicle.riskScore);

      // 4. Verify trip document updated with server-verified status
      const updatedTrip = mockDbData[`trips/${tripId}`];
      expect(updatedTrip.serverVerifiedViolationsCount).toBe(1);
      expect(updatedTrip.serverProcessedAt).toBeDefined();
      expect(updatedTrip.status).toBe('completed');

      // 5. Verify processedEvents ledger entry
      const tripLedger = mockDbData[`processedEvents/trip_completion_${tripId}`];
      expect(tripLedger).toBeDefined();
      expect(tripLedger.violationsCount).toBe(1);
      expect(tripLedger.handler).toBe('processTripCompletion');
    });

    it('trip with compliant speeds (no overspeed) creates zero violation records and leaves vehicle risk score unchanged', async () => {
      const db = createMockDb();
      const tripId = 'trip_compliant_01';
      const vehicleReg = 'KDD 456B';
      const saccoId = 'sacco_metro';
      const baseTime = new Date('2026-08-08T11:00:00Z').getTime();

      mockDbData[`vehicles/${vehicleReg}`] = {
        regNumber: vehicleReg,
        saccoId,
        riskScore: 98,
        riskTier: 'low',
        status: 'active',
      };

      mockDbData[`trips/${tripId}`] = {
        id: tripId,
        userId: 'user_commuter_2',
        vehicleRegNumber: vehicleReg,
        saccoId,
        routeName: 'CBD - Westlands',
        status: 'active',
      };

      // All speeds are strictly <= 75 km/h (speed limit 80)
      const compliantSamples: GPSSample[] = [
        { latitude: -1.28, longitude: 36.82, speedKmH: 50, accuracy: 8, timestamp: new Date(baseTime).toISOString() },
        { latitude: -1.281, longitude: 36.821, speedKmH: 65, accuracy: 9, timestamp: new Date(baseTime + 2000).toISOString() },
        { latitude: -1.282, longitude: 36.822, speedKmH: 70, accuracy: 10, timestamp: new Date(baseTime + 4000).toISOString() },
        { latitude: -1.283, longitude: 36.823, speedKmH: 72, accuracy: 8, timestamp: new Date(baseTime + 6000).toISOString() },
        { latitude: -1.284, longitude: 36.824, speedKmH: 55, accuracy: 9, timestamp: new Date(baseTime + 8000).toISOString() },
      ];

      const result = await processTripCompletionLogic(
        db,
        {
          tripId,
          samples: compliantSamples,
          speedLimitKmH: 80,
        },
        { uid: 'user_commuter_2', role: 'passenger' }
      );

      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
      expect(result.violationsCount).toBe(0);
      expect(result.violations).toEqual([]);

      // Zero violation docs in violations collection
      const violationKeys = Object.keys(mockDbData).filter((k) => k.startsWith('violations/'));
      expect(violationKeys.length).toBe(0);

      // Vehicle risk score remains unchanged
      const vehicle = mockDbData[`vehicles/${vehicleReg}`];
      expect(vehicle.riskScore).toBe(98);

      // Trip updated with 0 server-verified violations
      const trip = mockDbData[`trips/${tripId}`];
      expect(trip.serverVerifiedViolationsCount).toBe(0);
      expect(trip.status).toBe('completed');
    });
  });

  describe('Idempotency and Deduplication', () => {
    it('re-triggering the same trip completion does not duplicate violations or re-apply risk penalty', async () => {
      const db = createMockDb();
      const tripId = 'trip_idempotent_01';
      const vehicleReg = 'KCB 789C';
      const cleanPlate = normalizePlate(vehicleReg);
      const saccoId = 'sacco_metro';
      const baseTime = new Date('2026-08-08T12:00:00Z').getTime();

      mockDbData[`vehicles/${cleanPlate}`] = {
        regNumber: cleanPlate,
        saccoId,
        riskScore: 100,
        riskTier: 'low',
        status: 'active',
      };

      mockDbData[`trips/${tripId}`] = {
        id: tripId,
        userId: 'user_commuter_3',
        vehicleRegNumber: vehicleReg,
        saccoId,
        routeName: 'Nairobi - Rongai',
        status: 'active',
      };

      const samples: GPSSample[] = [
        { latitude: -1.35, longitude: 36.75, speedKmH: 60, accuracy: 10, timestamp: new Date(baseTime).toISOString() },
        { latitude: -1.351, longitude: 36.751, speedKmH: 102, accuracy: 10, timestamp: new Date(baseTime + 1000).toISOString() },
        { latitude: -1.352, longitude: 36.752, speedKmH: 102, accuracy: 10, timestamp: new Date(baseTime + 2000).toISOString() },
        { latitude: -1.353, longitude: 36.753, speedKmH: 102, accuracy: 10, timestamp: new Date(baseTime + 3000).toISOString() },
        { latitude: -1.354, longitude: 36.754, speedKmH: 102, accuracy: 10, timestamp: new Date(baseTime + 4000).toISOString() },
        { latitude: -1.355, longitude: 36.755, speedKmH: 102, accuracy: 10, timestamp: new Date(baseTime + 5000).toISOString() },
        { latitude: -1.356, longitude: 36.756, speedKmH: 60, accuracy: 10, timestamp: new Date(baseTime + 6000).toISOString() },
      ];

      // First execution
      const firstRun = await processTripCompletionLogic(
        db,
        { tripId, samples, speedLimitKmH: 80 },
        { uid: 'user_commuter_3', role: 'passenger' }
      );
      expect(firstRun.processed).toBe(true);
      expect(firstRun.violationsCount).toBe(1);

      const scoreAfterFirstRun = mockDbData[`vehicles/${cleanPlate}`].riskScore;

      // Second execution with identical tripId (e.g. duplicate trigger or network retry)
      const secondRun = await processTripCompletionLogic(
        db,
        { tripId, samples, speedLimitKmH: 80 },
        { uid: 'user_commuter_3', role: 'passenger' }
      );

      expect(secondRun.success).toBe(true);
      expect(secondRun.processed).toBe(false);
      expect(secondRun.alreadyProcessed).toBe(true);
      expect(secondRun.violationsCount).toBe(1);

      // Violations collection still only contains 1 violation for this trip
      const violationsForTrip = Object.keys(mockDbData).filter(
        (k) => k.startsWith('violations/viol_trip_idempotent_01_')
      );
      expect(violationsForTrip.length).toBe(1);

      // Vehicle score did not decrease a second time
      expect(mockDbData[`vehicles/${cleanPlate}`].riskScore).toBe(scoreAfterFirstRun);
    });
  });

  describe('Telemetry Plausibility and Bounding Box Filtering', () => {
    it('discards impossible speeds (>180 km/h) and coordinates outside Kenya bounds', async () => {
      const db = createMockDb();
      const tripId = 'trip_corrupted_telemetry';
      const vehicleReg = 'KCE 111D';
      const saccoId = 'sacco_metro';
      const baseTime = new Date('2026-08-08T14:00:00Z').getTime();

      mockDbData[`vehicles/${vehicleReg}`] = {
        regNumber: vehicleReg,
        saccoId,
        riskScore: 100,
        riskTier: 'low',
        status: 'active',
      };

      mockDbData[`trips/${tripId}`] = {
        id: tripId,
        userId: 'user_commuter_4',
        vehicleRegNumber: vehicleReg,
        saccoId,
        routeName: 'Nairobi - Mombasa Road',
        status: 'active',
      };

      // Mix of impossible speeds and out-of-bounds coordinates
      const dirtySamples: GPSSample[] = [
        // Out of bounds (Europe latitude 48.85, longitude 2.35)
        { latitude: 48.85, longitude: 2.35, speedKmH: 120, accuracy: 10, timestamp: new Date(baseTime).toISOString() },
        // Impossible speed (350 km/h)
        { latitude: -1.28, longitude: 36.82, speedKmH: 350, accuracy: 10, timestamp: new Date(baseTime + 1000).toISOString() },
        // Compliant real Kenya point
        { latitude: -1.281, longitude: 36.821, speedKmH: 60, accuracy: 10, timestamp: new Date(baseTime + 2000).toISOString() },
      ];

      const result = await processTripCompletionLogic(
        db,
        { tripId, samples: dirtySamples, speedLimitKmH: 80 },
        { uid: 'user_commuter_4', role: 'passenger' }
      );

      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
      // The dirty overspeed samples are rejected, so 0 violations are produced
      expect(result.violationsCount).toBe(0);
      expect(result.violations).toEqual([]);
    });
  });
});
