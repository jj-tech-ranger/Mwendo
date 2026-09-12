import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeVehicleRisk, processVehicleRiskLogic, VehicleRiskEventPayload } from '../risk/computeVehicleRisk';

describe('Cloud Functions — computeVehicleRisk (CF-002 & TEST-002)', () => {
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
        }),
        where: (field: string, op: string, value: any) => ({
          where: (f2: string, o2: string, v2: any) => ({
            limit: (n: number) => ({
              get: async () => {
                const docs = Object.entries(mockDbData)
                  .filter(([k, val]) => k.startsWith(`${colName}/`) && val[field] === value && val[f2] === v2)
                  .slice(0, n)
                  .map(([_, d]) => ({ data: () => d }));
                return { docs, size: docs.length };
              },
            }),
          }),
          limit: (n: number) => ({
            get: async () => {
              const docs = Object.entries(mockDbData)
                .filter(([k, val]) => k.startsWith(`${colName}/`) && val[field] === value)
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
    };
  }

  beforeEach(() => {
    mockDbData = {};
    mockAuditLogs = [];
    vi.clearAllMocks();
  });

  describe('Authorization and Tenant Boundaries', () => {
    it('rejects unauthenticated caller with unauthenticated code', async () => {
      const unauthRequest = {
        data: {
          eventId: 'evt_1',
          vehicleRegNumber: 'KDA 123A',
          saccoId: 'sacco_metro',
        },
        auth: null,
      } as any;

      await expect(computeVehicleRisk.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects request with missing eventId or vehicleRegNumber with invalid-argument', async () => {
      const invalidRequest = {
        data: {
          saccoId: 'sacco_metro',
        },
        auth: {
          uid: 'user_1',
          token: { activeRole: 'sacco_manager', saccoId: 'sacco_metro' },
        },
      } as any;

      await expect(computeVehicleRisk.run(invalidRequest)).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('rejects tenant boundary violation: sacco_manager for sacco_A attempting to compute for sacco_B', async () => {
      const tenantViolationRequest = {
        data: {
          eventId: 'evt_cross_tenant_01',
          vehicleRegNumber: 'KBZ 999X',
          saccoId: 'sacco_city_shuttle', // SACCO B
          eventType: 'violation',
          severity: 'high',
          timestamp: new Date().toISOString(),
        },
        auth: {
          uid: 'manager_metro_01',
          token: {
            activeRole: 'sacco_manager',
            saccoId: 'sacco_metro_trans', // SACCO A
          },
        },
      } as any;

      await expect(computeVehicleRisk.run(tenantViolationRequest)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });
  });

  describe('Idempotency Under Duplicate Invocation (CF-002 Transactional Check)', () => {
    it('processes event on 1st invocation, and returns processed:false on duplicate invocation without re-computing', async () => {
      const mockDb = createMockDb() as any;

      // Seed initial vehicle
      mockDbData['vehicles/KDA123A'] = {
        id: 'KDA123A',
        regNumber: 'KDA123A',
        saccoId: 'sacco_metro',
        riskScore: 85,
        riskTier: 'medium',
      };

      const eventPayload: VehicleRiskEventPayload = {
        eventId: 'evt_idempotent_999',
        vehicleRegNumber: 'KDA 123A',
        saccoId: 'sacco_metro',
        eventType: 'overspeed',
        severity: 'high',
        recordedSpeedKmH: 105,
        confidenceScore: 0.95,
        timestamp: new Date().toISOString(),
      };

      // 1st Invocation
      const firstResult = await processVehicleRiskLogic(mockDb, eventPayload);
      expect(firstResult.processed).toBe(true);
      expect(firstResult.riskScore).toBeGreaterThan(0);
      expect(mockDbData['processedEvents/evt_idempotent_999']).toBeDefined();
      expect(mockDbData['processedEvents/evt_idempotent_999'].handler).toBe('computeVehicleRisk');
      expect(mockAuditLogs.length).toBe(1);

      const computedScore = mockDbData['vehicles/KDA123A'].riskScore;

      // 2nd Duplicate Invocation with the EXACT same eventId
      const secondResult = await processVehicleRiskLogic(mockDb, eventPayload);
      expect(secondResult.processed).toBe(false);
      expect(secondResult.riskTier).toBe('existing');
      expect(secondResult.riskScore).toBe(0);

      // Audit logs count must NOT have increased
      expect(mockAuditLogs.length).toBe(1);
      // Vehicle score must not have been mutated again
      expect(mockDbData['vehicles/KDA123A'].riskScore).toBe(computedScore);
    });

    it('creates provisional vehicle doc if vehicle did not previously exist in database', async () => {
      const mockDb = createMockDb() as any;

      const eventPayload: VehicleRiskEventPayload = {
        eventId: 'evt_new_vehicle_101',
        vehicleRegNumber: 'KCG 456Z',
        saccoId: 'sacco_express',
        eventType: 'violation',
        severity: 'low',
        timestamp: new Date().toISOString(),
      };

      const result = await processVehicleRiskLogic(mockDb, eventPayload);

      expect(result.processed).toBe(true);
      expect(mockDbData['vehicles/KCG456Z']).toBeDefined();
      expect(mockDbData['vehicles/KCG456Z'].regNumber).toBe('KCG456Z');
      expect(mockDbData['vehicles/KCG456Z'].saccoId).toBe('sacco_express');
    });

    it('proves two whitespace variants of the same plate resolve to the same vehicle document ID', async () => {
      const mockDb = createMockDb() as any;

      // Event 1 with internal spaces "KAA 123B"
      const event1: VehicleRiskEventPayload = {
        eventId: 'evt_variant_1',
        vehicleRegNumber: 'KAA 123B',
        saccoId: 'sacco_metro',
        eventType: 'violation',
        severity: 'low',
        timestamp: new Date().toISOString(),
      };

      await processVehicleRiskLogic(mockDb, event1);
      expect(mockDbData['vehicles/KAA123B']).toBeDefined();
      expect(mockDbData['vehicles/KAA123B'].id).toBe('KAA123B');
      expect(mockDbData['vehicles/KAA_123B']).toBeUndefined();

      // Mutate the record so we can verify the second variant updates the SAME document
      mockDbData['vehicles/KAA123B'].notes = 'variant_1_recorded';

      // Event 2 without spaces "KAA123B"
      const event2: VehicleRiskEventPayload = {
        eventId: 'evt_variant_2',
        vehicleRegNumber: 'KAA123B',
        saccoId: 'sacco_metro',
        eventType: 'overspeed',
        severity: 'medium',
        recordedSpeedKmH: 88,
        timestamp: new Date().toISOString(),
      };

      await processVehicleRiskLogic(mockDb, event2);

      // Both resolved to vehicles/KAA123B
      expect(mockDbData['vehicles/KAA123B']).toBeDefined();
      expect(mockDbData['vehicles/KAA123B'].notes).toBe('variant_1_recorded');
      // No duplicate or fragmented document created
      expect(Object.keys(mockDbData).filter((k) => k.startsWith('vehicles/'))).toHaveLength(1);
    });

    it('filters out implausible speeds (>180 km/h) or unparseable timestamps from risk calculation', async () => {
      const mockDb = createMockDb() as any;

      mockDbData['vehicles/KAA001A'] = {
        id: 'KAA001A',
        regNumber: 'KAA001A',
        saccoId: 'sacco_metro',
        riskScore: 85,
        riskTier: 'medium',
      };

      // Seed an implausible violation (>180 km/h) in history
      mockDbData['violations/viol_crazy_speed'] = {
        vehicleRegNumber: 'KAA 001A',
        severity: 'critical',
        recordedSpeedKmH: 350, // Physical impossibility
        timestamp: new Date().toISOString(),
      };

      const validEvent: VehicleRiskEventPayload = {
        eventId: 'evt_plausibility_check',
        vehicleRegNumber: 'KAA 001A',
        saccoId: 'sacco_metro',
        eventType: 'violation',
        severity: 'low',
        timestamp: new Date().toISOString(),
      };

      const result = await processVehicleRiskLogic(mockDb, validEvent);
      expect(result.processed).toBe(true);
      // Because the 350 km/h event is discarded, vehicle does not plummet to critical
      expect(result.riskScore).toBeGreaterThanOrEqual(80);
    });
  });
});
