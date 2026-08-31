import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { createInspection, processCreateInspectionLogic, CreateInspectionPayload } from '../inspections/createInspection';

let mockDbData: Record<string, any> = {};
let transactionOperations: Array<() => void> = [];

function createMockDb() {
  return {
    collection: (colName: string) => ({
      doc: (docId?: string) => {
        const actualDocId = docId || `generated_id_${Math.random().toString(36).substring(2, 9)}`;
        const docPath = `${colName}/${actualDocId}`;
        return {
          id: actualDocId,
          path: docPath,
          get: async () => {
            const data = mockDbData[docPath];
            return {
              id: actualDocId,
              exists: !!data,
              data: () => data || {},
            };
          },
          set: async (data: any) => {
            mockDbData[docPath] = data;
          },
        };
      },
    }),
    runTransaction: async <T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> => {
      transactionOperations = [];
      const tx = {
        get: async (docRef: any) => docRef.get(),
        create: (docRef: any, data: any) => {
          const path = docRef.path || `unknown/${docRef.id}`;
          if (mockDbData[path]) {
            throw new Error(`Document already exists: ${path}`);
          }
          transactionOperations.push(() => {
            mockDbData[path] = data;
          });
        },
        set: (docRef: any, data: any) => {
          const path = docRef.path || `unknown/${docRef.id}`;
          transactionOperations.push(() => {
            mockDbData[path] = data;
          });
        },
      };
      const result = await updateFunction(tx);
      transactionOperations.forEach((op) => op());
      return result;
    },
  };
}

vi.mock('firebase-admin/firestore', () => {
  return {
    getFirestore: () => createMockDb(),
  };
});

describe('Cloud Functions — createInspection (SEC-004, AUDIT-001 & INSPECT-001)', () => {

  beforeEach(() => {
    mockDbData = {};
    transactionOperations = [];
  });

  describe('Authorization & Role Validation', () => {
    it('rejects unauthenticated caller with unauthenticated error code', async () => {
      const unauthRequest = {
        data: { vehicleId: 'veh_1', saccoId: 'sacco_1', result: 'pass' },
        auth: null,
      } as any;

      await expect(createInspection.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects passenger caller with permission-denied', async () => {
      const passengerRequest = {
        data: { vehicleId: 'veh_1', saccoId: 'sacco_1', result: 'pass' },
        auth: {
          uid: 'passenger_1',
          token: { activeRole: 'passenger' },
        },
      } as any;

      await expect(createInspection.run(passengerRequest)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });

    it('rejects sacco_manager caller with permission-denied', async () => {
      const saccoManagerRequest = {
        data: { vehicleId: 'veh_1', saccoId: 'sacco_1', result: 'pass' },
        auth: {
          uid: 'manager_1',
          token: { activeRole: 'sacco_manager', saccoId: 'sacco_1' },
        },
      } as any;

      await expect(createInspection.run(saccoManagerRequest)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });

    it('allows authority role to proceed', async () => {
      const mockDb = createMockDb() as any;
      mockDbData['vehicles/veh_1'] = { id: 'veh_1', saccoId: 'sacco_metro' };
      mockDbData['saccos/sacco_metro'] = { id: 'sacco_metro', name: 'Metro Trans' };

      const payload: CreateInspectionPayload = {
        vehicleId: 'veh_1',
        saccoId: 'sacco_metro',
        result: 'pass',
      };

      const result = await processCreateInspectionLogic(mockDb, payload, 'authority_officer_1', 'authority');
      expect(result.success).toBe(true);
      expect(result.inspectionId).toBeDefined();
      expect(result.certificateNumber).toMatch(/^MWD-\d{4}-[A-Z0-9]{8}$/);
    });

    it('allows admin role to proceed', async () => {
      const mockDb = createMockDb() as any;
      mockDbData['vehicles/veh_2'] = { id: 'veh_2', saccoId: 'sacco_metro' };
      mockDbData['saccos/sacco_metro'] = { id: 'sacco_metro', name: 'Metro Trans' };

      const payload: CreateInspectionPayload = {
        vehicleId: 'veh_2',
        saccoId: 'sacco_metro',
        result: 'fail',
        notes: 'Failed brake safety check',
      };

      const result = await processCreateInspectionLogic(mockDb, payload, 'admin_super_1', 'admin');
      expect(result.success).toBe(true);
    });
  });

  describe('Input Validation & Business Preconditions', () => {
    it('rejects missing or empty vehicleId', async () => {
      const mockDb = createMockDb() as any;
      const payload: CreateInspectionPayload = {
        vehicleId: '  ',
        saccoId: 'sacco_metro',
        result: 'pass',
      };

      await expect(
        processCreateInspectionLogic(mockDb, payload, 'authority_1', 'authority')
      ).rejects.toThrow(HttpsError);

      await expect(
        processCreateInspectionLogic(mockDb, payload, 'authority_1', 'authority')
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('rejects missing or empty saccoId', async () => {
      const mockDb = createMockDb() as any;
      const payload: CreateInspectionPayload = {
        vehicleId: 'veh_1',
        saccoId: '',
        result: 'pass',
      };

      await expect(
        processCreateInspectionLogic(mockDb, payload, 'authority_1', 'authority')
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('rejects invalid result value', async () => {
      const mockDb = createMockDb() as any;
      const payload: any = {
        vehicleId: 'veh_1',
        saccoId: 'sacco_metro',
        result: 'unknown_result',
      };

      await expect(
        processCreateInspectionLogic(mockDb, payload, 'authority_1', 'authority')
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('rejects invalid inspectionType', async () => {
      const mockDb = createMockDb() as any;
      const payload: any = {
        vehicleId: 'veh_1',
        saccoId: 'sacco_metro',
        result: 'pass',
        inspectionType: 'unsupported_type',
      };

      await expect(
        processCreateInspectionLogic(mockDb, payload, 'authority_1', 'authority')
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('rejects when vehicle does not exist in Firestore', async () => {
      const mockDb = createMockDb() as any;
      mockDbData['saccos/sacco_metro'] = { id: 'sacco_metro', name: 'Metro Trans' };

      const payload: CreateInspectionPayload = {
        vehicleId: 'non_existent_veh',
        saccoId: 'sacco_metro',
        result: 'pass',
      };

      await expect(
        processCreateInspectionLogic(mockDb, payload, 'authority_1', 'authority')
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    it('rejects when SACCO does not exist in Firestore', async () => {
      const mockDb = createMockDb() as any;
      mockDbData['vehicles/veh_1'] = { id: 'veh_1', saccoId: 'sacco_metro' };

      const payload: CreateInspectionPayload = {
        vehicleId: 'veh_1',
        saccoId: 'non_existent_sacco',
        result: 'pass',
      };

      await expect(
        processCreateInspectionLogic(mockDb, payload, 'authority_1', 'authority')
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    it('rejects when vehicle belongs to a different SACCO (tenant mismatch)', async () => {
      const mockDb = createMockDb() as any;
      mockDbData['vehicles/veh_1'] = { id: 'veh_1', saccoId: 'sacco_other' };
      mockDbData['saccos/sacco_metro'] = { id: 'sacco_metro', name: 'Metro Trans' };

      const payload: CreateInspectionPayload = {
        vehicleId: 'veh_1',
        saccoId: 'sacco_metro',
        result: 'pass',
      };

      await expect(
        processCreateInspectionLogic(mockDb, payload, 'authority_1', 'authority')
      ).rejects.toMatchObject({ code: 'failed-precondition' });
    });
  });

  describe('Document Creation & Audit Trail', () => {
    it('creates inspection document and audit log atomically with certificate expiration set to 365 days', async () => {
      const mockDb = createMockDb() as any;
      mockDbData['vehicles/KBZ_123A'] = { id: 'KBZ_123A', saccoId: 'sacco_city' };
      mockDbData['saccos/sacco_city'] = { id: 'sacco_city', name: 'City Shuttle SACCO' };

      const payload: CreateInspectionPayload = {
        vehicleId: 'KBZ_123A',
        saccoId: 'sacco_city',
        inspectionType: 'routine',
        result: 'pass',
        notes: 'All safety equipment verified and functioning.',
      };

      const beforeTime = Date.now();
      const result = await processCreateInspectionLogic(mockDb, payload, 'officer_ntsa_44', 'authority');
      const afterTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.inspectionId).toBeDefined();
      expect(result.certificateNumber).toMatch(/^MWD-\d{4}-[A-Z0-9]{8}$/);

      // Verify certificate expiry is approximately 365 days in the future
      const expiryTimestamp = new Date(result.expiryDate).getTime();
      const expectedMinExpiry = beforeTime + 364 * 24 * 60 * 60 * 1000;
      const expectedMaxExpiry = afterTime + 366 * 24 * 60 * 60 * 1000;
      expect(expiryTimestamp).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(expiryTimestamp).toBeLessThanOrEqual(expectedMaxExpiry);

      // Verify inspection doc persisted
      const inspectionDocKey = Object.keys(mockDbData).find((k) => k.startsWith('inspections/'));
      expect(inspectionDocKey).toBeDefined();
      const inspectionDoc = mockDbData[inspectionDocKey!];
      expect(inspectionDoc.vehicleId).toBe('KBZ_123A');
      expect(inspectionDoc.saccoId).toBe('sacco_city');
      expect(inspectionDoc.saccoName).toBe('City Shuttle SACCO');
      expect(inspectionDoc.inspectorId).toBe('officer_ntsa_44');
      expect(inspectionDoc.result).toBe('pass');
      expect(inspectionDoc.inspectionType).toBe('routine');
      expect(inspectionDoc.notes).toBe('All safety equipment verified and functioning.');

      // Verify audit log created
      const auditDocKey = Object.keys(mockDbData).find((k) => k.startsWith('audit_logs/'));
      expect(auditDocKey).toBeDefined();
      const auditDoc = mockDbData[auditDocKey!];
      expect(auditDoc.action).toBe('CREATE_INSPECTION');
      expect(auditDoc.actorId).toBe('officer_ntsa_44');
      expect(auditDoc.actorRole).toBe('authority');
      expect(auditDoc.details.vehicleId).toBe('KBZ_123A');
      expect(auditDoc.details.result).toBe('pass');
      expect(auditDoc.details.certificateNumber).toBe(result.certificateNumber);
    });
  });
});
