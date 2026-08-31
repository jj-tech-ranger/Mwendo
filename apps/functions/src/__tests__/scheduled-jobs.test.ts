import { describe, it, expect, beforeEach } from 'vitest';
import { runDailyPurgeLogic } from '../scheduled/dailyPurge';
import { runWeeklyReportLogic } from '../scheduled/weeklyReport';
import { runMonthlyArchivalLogic } from '../scheduled/monthlyArchival';
import { processUpdateDailyAnalyticsLogic } from '../analytics/updateDailyAnalytics';

describe('Cloud Functions — Scheduled Jobs & Retention (SCHED-001, RET-001 & ANALYTICS-002)', () => {
  let mockDbData: Record<string, any>;

  function matchesFilter(actual: any, op: string, target: any): boolean {
    if (op === '==') return actual === target;
    if (op === '!=') return actual !== target;
    if (op === '<') return actual < target;
    if (op === '<=') return actual <= target;
    if (op === '>') return actual > target;
    if (op === '>=') return actual >= target;
    return actual === target;
  }

  function createMockDb() {
    return {
      collection: (colName: string) => {
        const createQuery = (filters: Array<{ field: string; op: string; val: any }>, limitVal?: number) => ({
          where: (f: string, op: string, val: any) =>
            createQuery([...filters, { field: f, op, val }], limitVal),
          limit: (n: number) => createQuery(filters, n),
          get: async () => {
            let matches = Object.entries(mockDbData).filter(([k, d]) => {
              if (!k.startsWith(`${colName}/`)) return false;
              return filters.every((filter) =>
                matchesFilter(d[filter.field], filter.op, filter.val)
              );
            });

            if (typeof limitVal === 'number') {
              matches = matches.slice(0, limitVal);
            }

            const docs = matches.map(([k, d]) => {
              const docId = k.slice(`${colName}/`.length);
              return {
                id: docId,
                ref: {
                  id: docId,
                  path: k,
                },
                data: () => d,
              };
            });
            return {
              docs,
              size: docs.length,
              empty: docs.length === 0,
            };
          },
        });

        return {
          doc: (docId: string) => {
            const docPath = `${colName}/${docId}`;
            return {
              id: docId,
              path: docPath,
              get: async () => ({
                id: docId,
                exists: !!mockDbData[docPath],
                data: () => mockDbData[docPath] || {},
              }),
              set: async (data: any, opts?: { merge?: boolean }) => {
                if (opts?.merge && mockDbData[docPath]) {
                  mockDbData[docPath] = { ...mockDbData[docPath], ...data };
                } else {
                  mockDbData[docPath] = data;
                }
              },
              update: async (data: any) => {
                if (!mockDbData[docPath]) throw new Error(`Not found: ${docPath}`);
                mockDbData[docPath] = { ...mockDbData[docPath], ...data };
              },
            };
          },
          where: (f: string, op: string, val: any) =>
            createQuery([{ field: f, op, val }]),
          limit: (n: number) => createQuery([], n),
          get: async () => {
            const docs = Object.entries(mockDbData)
              .filter(([k]) => k.startsWith(`${colName}/`))
              .map(([k, d]) => {
                const docId = k.slice(`${colName}/`.length);
                return {
                  id: docId,
                  ref: { id: docId, path: k },
                  data: () => d,
                };
              });
            return { docs, size: docs.length, empty: docs.length === 0 };
          },
        };
      },
      batch: () => {
        const batchOps: Array<() => void> = [];
        return {
          delete: (docRef: any) => {
            batchOps.push(() => {
              const key = docRef.path;
              delete mockDbData[key];
            });
          },
          update: (docRef: any, data: any) => {
            batchOps.push(() => {
              const key = docRef.path;
              if (mockDbData[key]) {
                mockDbData[key] = { ...mockDbData[key], ...data };
              }
            });
          },
          commit: async () => {
            batchOps.forEach((op) => op());
          },
        };
      },
    };
  }

  beforeEach(() => {
    mockDbData = {};
  });

  describe('dailyPurge (SCHED-001 & RET-001)', () => {
    it('purges processedEvents older than 30 days while keeping fresh events', async () => {
      const mockDb = createMockDb() as any;
      const now = Date.now();
      const oldTime = new Date(now - 35 * 86400000).toISOString();
      const freshTime = new Date(now - 5 * 86400000).toISOString();

      mockDbData['processedEvents/evt_old_1'] = { id: 'evt_old_1', processedAt: oldTime };
      mockDbData['processedEvents/evt_old_2'] = { id: 'evt_old_2', processedAt: oldTime };
      mockDbData['processedEvents/evt_fresh_1'] = { id: 'evt_fresh_1', processedAt: freshTime };

      const result = await runDailyPurgeLogic(mockDb);

      expect(result.purgedEvents).toBe(2);
      expect(mockDbData['processedEvents/evt_old_1']).toBeUndefined();
      expect(mockDbData['processedEvents/evt_old_2']).toBeUndefined();
      expect(mockDbData['processedEvents/evt_fresh_1']).toBeDefined();
    });

    it('purges dlq_notifications older than 30 days while keeping fresh failures', async () => {
      const mockDb = createMockDb() as any;
      const now = Date.now();
      const oldTime = new Date(now - 40 * 86400000).toISOString();
      const freshTime = new Date(now - 2 * 86400000).toISOString();

      mockDbData['dlq_notifications/dlq_old_1'] = { id: 'dlq_old_1', timestamp: oldTime };
      mockDbData['dlq_notifications/dlq_fresh_1'] = { id: 'dlq_fresh_1', timestamp: freshTime };

      const result = await runDailyPurgeLogic(mockDb);

      expect(result.purgedDlq).toBe(1);
      expect(mockDbData['dlq_notifications/dlq_old_1']).toBeUndefined();
      expect(mockDbData['dlq_notifications/dlq_fresh_1']).toBeDefined();
    });

    it('is safe and idempotent when collections are empty', async () => {
      const mockDb = createMockDb() as any;
      const result = await runDailyPurgeLogic(mockDb);
      expect(result.purgedEvents).toBe(0);
      expect(result.purgedDlq).toBe(0);
    });
  });

  describe('weeklyReport (SCHED-002 & CF-007)', () => {
    it('aggregates total SACCOs and violations breakdown into a weekly summary report', async () => {
      const mockDb = createMockDb() as any;

      mockDbData['saccos/sacco_metro'] = { id: 'sacco_metro', name: 'Metro Trans' };
      mockDbData['saccos/sacco_city'] = { id: 'sacco_city', name: 'City Shuttle' };

      mockDbData['violations/viol_1'] = { id: 'viol_1', saccoId: 'sacco_metro', type: 'overspeed' };
      mockDbData['violations/viol_2'] = { id: 'viol_2', saccoId: 'sacco_metro', type: 'harsh_braking' };
      mockDbData['violations/viol_3'] = { id: 'viol_3', saccoId: 'sacco_city', type: 'overspeed' };

      const result = await runWeeklyReportLogic(mockDb);

      expect(result.saccoCount).toBe(2);
      expect(result.reportId).toMatch(/^weekly_summary_\d{4}-\d{2}-\d{2}$/);

      const savedReport = mockDbData[`analytics/${result.reportId}`];
      expect(savedReport).toBeDefined();
      expect(savedReport.type).toBe('weekly_compliance_summary');
      expect(savedReport.totalSaccos).toBe(2);
      expect(savedReport.totalViolations).toBe(3);
      expect(savedReport.saccoBreakdown).toEqual({
        sacco_metro: 2,
        sacco_city: 1,
      });
    });

    it('is idempotent when re-run on the same day by merging into the daily docId', async () => {
      const mockDb = createMockDb() as any;
      mockDbData['saccos/sacco_1'] = { id: 'sacco_1' };

      const run1 = await runWeeklyReportLogic(mockDb);
      const run2 = await runWeeklyReportLogic(mockDb);

      expect(run1.reportId).toBe(run2.reportId);
      expect(Object.keys(mockDbData).filter((k) => k.startsWith('analytics/weekly_summary_')).length).toBe(1);
    });
  });

  describe('monthlyArchival (SCHED-003 & ARCH-001)', () => {
    it('marks completed trips older than 1 year as isArchived: true', async () => {
      const mockDb = createMockDb() as any;
      const now = Date.now();
      const twoYearsAgo = new Date(now - 730 * 86400000).toISOString();
      const sixMonthsAgo = new Date(now - 180 * 86400000).toISOString();

      mockDbData['trips/t_old_completed'] = {
        id: 't_old_completed',
        startTime: twoYearsAgo,
        status: 'completed',
        isArchived: false,
      };
      mockDbData['trips/t_old_active'] = {
        id: 't_old_active',
        startTime: twoYearsAgo,
        status: 'in_transit',
        isArchived: false,
      };
      mockDbData['trips/t_recent_completed'] = {
        id: 't_recent_completed',
        startTime: sixMonthsAgo,
        status: 'completed',
        isArchived: false,
      };

      const result = await runMonthlyArchivalLogic(mockDb);

      expect(result.archivedTripsCount).toBe(1);
      expect(mockDbData['trips/t_old_completed'].isArchived).toBe(true);
      expect(mockDbData['trips/t_old_active'].isArchived).toBe(false);
      expect(mockDbData['trips/t_recent_completed'].isArchived).toBe(false);
    });

    it('marks violations older than 2 years as isArchived: true', async () => {
      const mockDb = createMockDb() as any;
      const now = Date.now();
      const threeYearsAgo = new Date(now - 1095 * 86400000).toISOString();
      const oneYearAgo = new Date(now - 365 * 86400000).toISOString();

      mockDbData['violations/v_ancient'] = {
        id: 'v_ancient',
        timestamp: threeYearsAgo,
        isArchived: false,
      };
      mockDbData['violations/v_recent'] = {
        id: 'v_recent',
        timestamp: oneYearAgo,
        isArchived: false,
      };

      const result = await runMonthlyArchivalLogic(mockDb);

      expect(result.archivedViolationsCount).toBe(1);
      expect(mockDbData['violations/v_ancient'].isArchived).toBe(true);
      expect(mockDbData['violations/v_recent'].isArchived).toBe(false);
    });

    it('skips already archived documents idempotently', async () => {
      const mockDb = createMockDb() as any;
      const threeYearsAgo = new Date(Date.now() - 1095 * 86400000).toISOString();

      mockDbData['violations/v_already_archived'] = {
        id: 'v_already_archived',
        timestamp: threeYearsAgo,
        isArchived: true,
      };

      const result = await runMonthlyArchivalLogic(mockDb);
      expect(result.archivedViolationsCount).toBe(0);
    });
  });
});
