import { describe, it, expect, beforeEach } from 'vitest';
import { rebuildSaccoAnalytics, processRebuildSaccoAnalyticsLogic } from '../analytics/rebuildSaccoAnalytics';
import { updateDailyAnalytics, processUpdateDailyAnalyticsLogic } from '../analytics/updateDailyAnalytics';

describe('Cloud Functions — rebuildSaccoAnalytics & updateDailyAnalytics (CF-004, CF-005 & TEST-002)', () => {
  let mockDbData: Record<string, any>;

  function matchesOp(actual: any, op: string, target: any): boolean {
    if (op === '==' || op === '===') return actual === target;
    if (op === '>=') return actual >= target;
    if (op === '<=') return actual <= target;
    if (op === '>') return actual > target;
    if (op === '<') return actual < target;
    return actual === target;
  }

  function createMockDb() {
    return {
      collection: (colName: string) => {
        const createQuery = (filters: Array<{ field: string; op: string; val: any }>) => ({
          where: (f: string, op: string, val: any) =>
            createQuery([...filters, { field: f, op, val }]),
          get: async () => {
            const docs = Object.entries(mockDbData)
              .filter(([k, item]) => {
                if (!k.startsWith(`${colName}/`)) return false;
                return filters.every((filter) =>
                  matchesOp(item[filter.field], filter.op, filter.val)
                );
              })
              .map(([_, d]) => ({ data: () => d }));
            return { docs, size: docs.length };
          },
        });

        return {
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
          where: (f1: string, op1: string, v1: any) =>
            createQuery([{ field: f1, op: op1, val: v1 }]),
          get: async () => {
            const docs = Object.entries(mockDbData)
              .filter(([k]) => k.startsWith(`${colName}/`))
              .map(([_, d]) => ({ data: () => d }));
            return { docs, size: docs.length };
          },
        };
      },
    };
  }

  beforeEach(() => {
    mockDbData = {};
  });

  describe('rebuildSaccoAnalytics', () => {
    it('rejects unauthenticated caller with unauthenticated error', async () => {
      const unauthRequest = {
        data: { saccoId: 'sacco_metro' },
        auth: null,
      } as any;

      await expect(rebuildSaccoAnalytics.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects missing or empty saccoId with invalid-argument', async () => {
      const invalidRequest = {
        data: {},
        auth: {
          uid: 'admin_1',
          token: { activeRole: 'admin' },
        },
      } as any;

      await expect(rebuildSaccoAnalytics.run(invalidRequest)).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('rejects cross-tenant caller: sacco_manager of sacco_A attempting to rebuild sacco_B', async () => {
      const crossTenantRequest = {
        data: { saccoId: 'sacco_city_shuttle' },
        auth: {
          uid: 'manager_metro',
          token: {
            activeRole: 'sacco_manager',
            saccoId: 'sacco_metro_trans',
          },
        },
      } as any;

      await expect(rebuildSaccoAnalytics.run(crossTenantRequest)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });

    it('rejects standard passenger caller with permission-denied', async () => {
      const passengerRequest = {
        data: { saccoId: 'sacco_metro' },
        auth: {
          uid: 'passenger_1',
          token: { activeRole: 'passenger' },
        },
      } as any;

      await expect(rebuildSaccoAnalytics.run(passengerRequest)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });

    it('successfully computes and persists SACCO analytics for matching sacco_manager and updates sacco document', async () => {
      const mockDb = createMockDb() as any;

      // Seed SACCO document
      mockDbData['saccos/sacco_metro'] = {
        id: 'sacco_metro',
        name: 'Metro Trans SACCO',
        safetyScore: 70,
        fleetCount: 0,
      };

      // Seed vehicles for SACCO
      mockDbData['vehicles/veh_1'] = {
        id: 'veh_1',
        saccoId: 'sacco_metro',
        riskScore: 90,
      };
      mockDbData['vehicles/veh_2'] = {
        id: 'veh_2',
        saccoId: 'sacco_metro',
        riskScore: 80,
      };

      // Seed open complaint
      mockDbData['complaints/comp_1'] = {
        id: 'comp_1',
        saccoId: 'sacco_metro',
        status: 'open',
      };

      const result = await processRebuildSaccoAnalyticsLogic(mockDb, 'sacco_metro');

      expect(result.saccoId).toBe('sacco_metro');
      expect(result.fleetCount).toBe(2);
      expect(result.unresolvedComplaints).toBe(1);
      expect(result.safetyScore).toBe(83); // Avg (85) - 2*1 = 83

      // Verify SACCO document updated
      expect(mockDbData['saccos/sacco_metro'].safetyScore).toBe(83);
      expect(mockDbData['saccos/sacco_metro'].fleetCount).toBe(2);

      // Verify analytics collection document
      expect(mockDbData['analytics/sacco_sacco_metro']).toBeDefined();
      expect(mockDbData['analytics/sacco_sacco_metro'].safetyScore).toBe(83);
    });

    it('is idempotent when executed multiple times for the same SACCO dataset', async () => {
      const mockDb = createMockDb() as any;

      mockDbData['saccos/sacco_test'] = { id: 'sacco_test', safetyScore: 85 };
      mockDbData['vehicles/veh_1'] = { id: 'veh_1', saccoId: 'sacco_test', riskScore: 92 };

      const res1 = await processRebuildSaccoAnalyticsLogic(mockDb, 'sacco_test');
      const res2 = await processRebuildSaccoAnalyticsLogic(mockDb, 'sacco_test');

      expect(res1.safetyScore).toBe(res2.safetyScore);
      expect(mockDbData['analytics/sacco_sacco_test'].safetyScore).toBe(res1.safetyScore);
    });
  });

  describe('updateDailyAnalytics', () => {
    it('rejects unauthenticated caller with unauthenticated code', async () => {
      const unauthRequest = {
        data: { dateStr: '2026-08-16' },
        auth: null,
      } as any;

      await expect(updateDailyAnalytics.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects non-admin/non-authority caller with permission-denied', async () => {
      const saccoManagerRequest = {
        data: { dateStr: '2026-08-16' },
        auth: {
          uid: 'manager_1',
          token: { activeRole: 'sacco_manager', saccoId: 'sacco_1' },
        },
      } as any;

      await expect(updateDailyAnalytics.run(saccoManagerRequest)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });

    it('computes daily platform totals and risk distribution strictly for the requested date', async () => {
      const mockDb = createMockDb() as any;

      // Target date: 2026-08-16
      // Seed trips for target date AND other dates
      mockDbData['trips/t1'] = { id: 't1', startTime: '2026-08-16T08:30:00.000Z' };
      mockDbData['trips/t2'] = { id: 't2', startTime: '2026-08-16T14:45:00.000Z' };
      mockDbData['trips/t_other_day'] = { id: 't_other', startTime: '2026-08-15T10:00:00.000Z' };

      // Seed violations
      mockDbData['violations/v1'] = { id: 'v1', timestamp: '2026-08-16T11:20:00.000Z' };
      mockDbData['violations/v_other_day'] = { id: 'v_other', timestamp: '2026-08-17T09:00:00.000Z' };

      // Seed safety alerts
      mockDbData['safety_alerts/a1'] = { id: 'a1', status: 'active', timestamp: '2026-08-16T07:15:00.000Z' };
      mockDbData['safety_alerts/a2'] = { id: 'a2', status: 'resolved', timestamp: '2026-08-16T16:00:00.000Z' };
      mockDbData['safety_alerts/a_other_day'] = { id: 'a_other', status: 'active', timestamp: '2026-08-14T12:00:00.000Z' };

      // Fleet vehicles snapshot
      mockDbData['vehicles/veh1'] = { id: 'veh1', riskTier: 'low' };
      mockDbData['vehicles/veh2'] = { id: 'veh2', riskTier: 'critical' };

      const result = await processUpdateDailyAnalyticsLogic(mockDb, '2026-08-16');

      expect(result.date).toBe('2026-08-16');
      expect(result.totalTrips).toBe(2); // Only t1 & t2 counted; t_other_day excluded
      expect(result.totalViolations).toBe(1); // Only v1 counted; v_other_day excluded
      expect(result.activeAlerts).toBe(1); // Only a1 counted; a_other_day excluded
      expect(result.riskDistribution).toEqual({
        low: 1,
        medium: 0,
        high: 0,
        critical: 1,
      });

      expect(mockDbData['analytics/daily_2026-08-16']).toBeDefined();
    });
  });
});
