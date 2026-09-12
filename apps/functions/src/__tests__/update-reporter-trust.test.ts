import { describe, it, expect, beforeEach } from 'vitest';
import {
  updateReporterTrust,
  processUpdateReporterTrustLogic,
} from '../trust/updateReporterTrust';

describe('Cloud Functions — updateReporterTrust (CF-015 & Trust Engine)', () => {
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

  describe('Authentication and Security Constraints', () => {
    it('rejects unauthenticated requests with unauthenticated error', async () => {
      const unauthRequest = {
        data: {},
        auth: null,
      } as any;

      await expect(updateReporterTrust.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects empty or invalid user ID with unauthenticated error', async () => {
      const mockDb = createMockDb() as any;
      await expect(processUpdateReporterTrustLogic(mockDb, '')).rejects.toMatchObject({
        code: 'unauthenticated',
      });
      await expect(processUpdateReporterTrustLogic(mockDb, 'anonymous')).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('derives identity strictly from caller and ignores client-supplied spoofed userId', async () => {
      const mockDb = createMockDb() as any;
      const callerUid = 'real_passenger_123';
      const spoofedUid = 'victim_user_999';

      mockDbData[`users/${callerUid}`] = {
        id: callerUid,
        displayName: 'Real Passenger',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      mockDbData[`users/${spoofedUid}`] = {
        id: spoofedUid,
        displayName: 'Victim User',
        createdAt: '2020-01-01T00:00:00.000Z',
      };

      // Real caller has 3 confirmed complaints
      mockDbData['complaints/c1'] = { id: 'c1', reportedByUid: callerUid, status: 'resolved' };
      mockDbData['complaints/c2'] = { id: 'c2', reportedByUid: callerUid, status: 'verified' };
      mockDbData['complaints/c3'] = { id: 'c3', reportedByUid: callerUid, status: 'resolved' };

      // Victim has 5 false complaints
      mockDbData['complaints/c_v1'] = { id: 'c_v1', reportedByUid: spoofedUid, status: 'dismissed' };

      const result = await processUpdateReporterTrustLogic(mockDb, callerUid, Date.parse('2026-06-01T00:00:00.000Z'));

      expect(result.userId).toBe(callerUid);
      expect(result.confirmedReportsCount).toBe(3);
      expect(result.falseReportsCount).toBe(0);
      expect(result.trustScore).toBeGreaterThan(0.5);
      expect(mockDbData[`users/${callerUid}`].trustScore).toBe(result.trustScore);
      expect(mockDbData[`users/${spoofedUid}`].trustScore).toBeUndefined();
    });
  });

  describe('Trust Computation and Lifecycle', () => {
    it('correctly calculates trust score for a new user with no reports', async () => {
      const mockDb = createMockDb() as any;
      const userId = 'new_user_1';

      mockDbData[`users/${userId}`] = {
        id: userId,
        createdAt: '2026-09-01T00:00:00.000Z', // 11 days old
      };

      const result = await processUpdateReporterTrustLogic(mockDb, userId, Date.parse('2026-09-12T00:00:00.000Z'));

      expect(result.success).toBe(true);
      expect(result.confirmedReportsCount).toBe(0);
      expect(result.falseReportsCount).toBe(0);
      expect(result.trustScore).toBe(0.56);
      expect(result.trustBadge).toBe('bronze');

      // Check user document was updated
      expect(mockDbData[`users/${userId}`].trustScore).toBe(0.56);
      expect(mockDbData[`users/${userId}`].trustBadge).toBe('bronze');
      expect(mockDbData[`users/${userId}`].updatedAt).toBeDefined();

      // Check audit log was created
      const auditEntries = Object.entries(mockDbData).filter(([k]) => k.startsWith('audit_logs/'));
      expect(auditEntries.length).toBe(1);
      const auditLog = auditEntries[0][1];
      expect(auditLog.action).toBe('UPDATE_REPORTER_TRUST');
      expect(auditLog.actorUid).toBe(userId);
      expect(auditLog.details.trustScore).toBe(0.56);
    });

    it('upgrades badge to verified_guardian with high confirmed reports and age', async () => {
      const mockDb = createMockDb() as any;
      const userId = 'veteran_reporter';

      mockDbData[`users/${userId}`] = {
        id: userId,
        createdAt: '2025-01-01T00:00:00.000Z', // > 365 days
      };

      // 10 confirmed reports
      for (let i = 1; i <= 10; i++) {
        mockDbData[`complaints/rep_${i}`] = {
          id: `rep_${i}`,
          reportedByUid: userId,
          status: 'resolved',
        };
      }

      const result = await processUpdateReporterTrustLogic(mockDb, userId, Date.parse('2026-09-12T00:00:00.000Z'));

      expect(result.confirmedReportsCount).toBe(10);
      expect(result.falseReportsCount).toBe(0);
      expect(result.trustScore).toBe(1.0);
      expect(result.trustBadge).toBe('verified_guardian');
    });

    it('penalizes trust score heavily when false/dismissed reports exist', async () => {
      const mockDb = createMockDb() as any;
      const userId = 'bad_faith_reporter';

      mockDbData[`users/${userId}`] = {
        id: userId,
        createdAt: '2026-06-01T00:00:00.000Z',
      };

      // 1 confirmed, 5 false reports
      mockDbData['complaints/rep_1'] = { id: 'rep_1', reportedByUid: userId, status: 'resolved' };
      for (let i = 1; i <= 5; i++) {
        mockDbData[`complaints/bad_${i}`] = {
          id: `bad_${i}`,
          reportedByUid: userId,
          status: 'dismissed',
        };
      }

      const result = await processUpdateReporterTrustLogic(mockDb, userId, Date.parse('2026-09-12T00:00:00.000Z'));

      expect(result.confirmedReportsCount).toBe(1);
      expect(result.falseReportsCount).toBe(5);
      expect(result.trustScore).toBeLessThan(0.5);
      expect(result.trustBadge).toBe('bronze');
    });
  });
});
