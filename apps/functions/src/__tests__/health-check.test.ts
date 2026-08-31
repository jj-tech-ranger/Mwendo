import { describe, it, expect, beforeEach, vi } from 'vitest';
import { healthCheck } from '../admin/healthCheck';

let mockFirestoreData: Record<string, any> = {};
let shouldThrowFirestoreError = false;

vi.mock('firebase-admin/firestore', () => {
  return {
    getFirestore: () => ({
      collection: (colName: string) => ({
        doc: (docId: string) => ({
          set: async (data: any, options?: { merge: boolean }) => {
            if (shouldThrowFirestoreError) {
              throw new Error('Firestore connection timeout');
            }
            const key = `${colName}/${docId}`;
            if (options?.merge && mockFirestoreData[key]) {
              mockFirestoreData[key] = { ...mockFirestoreData[key], ...data };
            } else {
              mockFirestoreData[key] = data;
            }
          },
        }),
      }),
    }),
  };
});

describe('Cloud Functions — healthCheck (SEC-004 & OPS-001)', () => {
  beforeEach(() => {
    mockFirestoreData = {};
    shouldThrowFirestoreError = false;
  });

  it('rejects unauthenticated caller with unauthenticated error code', async () => {
    const unauthRequest = {
      data: {},
      auth: null,
    } as any;

    await expect(healthCheck.run(unauthRequest)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects non-admin caller (passenger) with permission-denied', async () => {
    const passengerRequest = {
      data: {},
      auth: {
        uid: 'pass_1',
        token: { activeRole: 'passenger' },
      },
    } as any;

    await expect(healthCheck.run(passengerRequest)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects non-admin caller (sacco_manager) with permission-denied', async () => {
    const managerRequest = {
      data: {},
      auth: {
        uid: 'mgr_1',
        token: { activeRole: 'sacco_manager', saccoId: 'sacco_1' },
      },
    } as any;

    await expect(healthCheck.run(managerRequest)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('successfully executes health checks for authenticated administrator and records probe', async () => {
    const adminRequest = {
      data: {},
      auth: {
        uid: 'admin_1',
        token: { activeRole: 'admin' },
      },
    } as any;

    const result = await healthCheck.run(adminRequest);

    expect(result.checkedAt).toBeDefined();
    expect(result.checks.length).toBe(2);

    const backendCheck = result.checks.find((c: any) => c.service === 'backend');
    expect(backendCheck).toBeDefined();
    expect(backendCheck.status).toBe('healthy');

    const firestoreCheck = result.checks.find((c: any) => c.service === 'firestore');
    expect(firestoreCheck).toBeDefined();
    expect(firestoreCheck.status).toBe('healthy');

    expect(mockFirestoreData['system_health_checks/admin_probe']).toBeDefined();
    expect(mockFirestoreData['system_health_checks/admin_probe'].source).toBe('admin-health-check');
  });

  it('reports error status when Firestore probe write fails', async () => {
    shouldThrowFirestoreError = true;

    const adminRequest = {
      data: {},
      auth: {
        uid: 'admin_1',
        token: { activeRole: 'admin' },
      },
    } as any;

    const result = await healthCheck.run(adminRequest);

    const firestoreCheck = result.checks.find((c: any) => c.service === 'firestore');
    expect(firestoreCheck).toBeDefined();
    expect(firestoreCheck.status).toBe('error');
    expect(firestoreCheck.details).toContain('Firestore connection timeout');
  });
});
