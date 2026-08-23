import { describe, it, expect, vi, beforeEach } from 'vitest';
import { suspendUser, reactivateUser } from '../admin/suspendUser';

const mockFirestoreData: Record<string, any> = {};
const mockAuditLogs: any[] = [];
const mockUserClaims: Record<string, any> = {};
const mockRevokedTokens: string[] = [];

vi.mock('firebase-admin/firestore', () => {
  return {
    getFirestore: () => ({
      collection: (colName: string) => ({
        doc: (docId: string) => ({
          get: async () => {
            const data = mockFirestoreData[`${colName}/${docId}`];
            return {
              exists: !!data,
              data: () => data || {},
            };
          },
          set: async (data: any, options?: { merge: boolean }) => {
            const key = `${colName}/${docId}`;
            if (options?.merge && mockFirestoreData[key]) {
              mockFirestoreData[key] = { ...mockFirestoreData[key], ...data };
            } else {
              mockFirestoreData[key] = data;
            }
          },
        }),
        add: async (data: any) => {
          mockAuditLogs.push(data);
          return { id: `audit_${Date.now()}` };
        },
      }),
    }),
  };
});

vi.mock('firebase-admin/auth', () => {
  return {
    getAuth: () => ({
      getUser: async (uid: string) => {
        return {
          uid,
          customClaims: mockUserClaims[uid] || {},
        };
      },
      setCustomUserClaims: async (uid: string, claims: any) => {
        mockUserClaims[uid] = claims;
      },
      revokeRefreshTokens: async (uid: string) => {
        mockRevokedTokens.push(uid);
      },
    }),
  };
});

describe('Cloud Functions — suspendUser & reactivateUser (CF-001 & TEST-002)', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockFirestoreData)) {
      delete mockFirestoreData[key];
    }
    mockAuditLogs.length = 0;
    for (const key of Object.keys(mockUserClaims)) {
      delete mockUserClaims[key];
    }
    mockRevokedTokens.length = 0;

    // Seed admin caller
    mockFirestoreData['users/admin_caller_01'] = {
      uid: 'admin_caller_01',
      displayName: 'Super Admin',
      role: 'admin',
      activeRole: 'admin',
    };

    // Seed target user
    mockFirestoreData['users/target_user_01'] = {
      uid: 'target_user_01',
      displayName: 'Reckless Driver',
      role: 'driver',
      isActive: true,
    };
  });

  it('rejects unauthenticated caller with unauthenticated error code', async () => {
    const unauthenticatedRequest = {
      data: { targetUid: 'target_user_01' },
      auth: null,
    } as any;

    await expect(suspendUser.run(unauthenticatedRequest)).rejects.toMatchObject({
      code: 'unauthenticated',
    });

    await expect(reactivateUser.run(unauthenticatedRequest)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects non-admin caller (passenger or sacco_manager) with permission-denied', async () => {
    // Seed non-admin caller
    mockFirestoreData['users/passenger_caller_01'] = {
      uid: 'passenger_caller_01',
      displayName: 'Normal Passenger',
      role: 'passenger',
      activeRole: 'passenger',
    };

    const unauthorizedRequest = {
      data: { targetUid: 'target_user_01' },
      auth: {
        uid: 'passenger_caller_01',
        token: { activeRole: 'passenger' },
      },
    } as any;

    await expect(suspendUser.run(unauthorizedRequest)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    await expect(reactivateUser.run(unauthorizedRequest)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('SEC-004: rejects caller when token.activeRole is not admin even if Firestore document has role: admin', async () => {
    // Seed user with admin role in Firestore doc but non-admin token claim
    mockFirestoreData['users/spoofed_admin_01'] = {
      uid: 'spoofed_admin_01',
      displayName: 'Spoofed Admin',
      role: 'admin',
      activeRole: 'admin',
    };

    const spoofedRequest = {
      data: { targetUid: 'target_user_01' },
      auth: {
        uid: 'spoofed_admin_01',
        token: { activeRole: 'passenger' },
      },
    } as any;

    await expect(suspendUser.run(spoofedRequest)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    await expect(reactivateUser.run(spoofedRequest)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('LOW-01: rejects caller with token { activeRole: "admin", isSuspended: true } with permission-denied', async () => {
    const suspendedAdminRequest = {
      data: { targetUid: 'target_user_01' },
      auth: {
        uid: 'admin_suspended_01',
        token: { activeRole: 'admin', isSuspended: true, name: 'Suspended Admin' },
      },
    } as any;

    await expect(suspendUser.run(suspendedAdminRequest)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'Suspended accounts cannot perform administrative actions.',
    });

    await expect(reactivateUser.run(suspendedAdminRequest)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'Suspended accounts cannot perform administrative actions.',
    });
  });

  it('SEC-004: caller with token.activeRole === admin succeeds even with no matching Firestore document', async () => {
    const missingCallerRequest = {
      data: { targetUid: 'target_user_01', reason: 'Emergency suspension' },
      auth: {
        uid: 'ghost_admin_99',
        token: { activeRole: 'admin', name: 'Ghost Admin' },
      },
    } as any;

    const result = await suspendUser.run(missingCallerRequest);
    expect(result.success).toBe(true);
    expect(mockFirestoreData['users/target_user_01'].isActive).toBe(false);
    expect(mockUserClaims['target_user_01']).toEqual({ isSuspended: true });
  });

  it('rejects execution when targetUid is missing or invalid', async () => {
    const missingTargetRequest = {
      data: {},
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin' },
      },
    } as any;

    await expect(suspendUser.run(missingTargetRequest)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    await expect(reactivateUser.run(missingTargetRequest)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('successfully suspends a user, sets custom claim isSuspended=true, revokes tokens, and records audit log', async () => {
    const validRequest = {
      data: { targetUid: 'target_user_01', reason: 'Repeated dangerous speeding' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', name: 'Super Admin' },
      },
    } as any;

    const result = await suspendUser.run(validRequest);

    expect(result).toEqual({
      success: true,
      targetUid: 'target_user_01',
      isSuspended: true,
    });

    // 1. Verify Firestore document updated
    expect(mockFirestoreData['users/target_user_01'].isActive).toBe(false);
    expect(mockFirestoreData['users/target_user_01'].updatedAt).toBeDefined();

    // 2. Verify Auth custom claim set
    expect(mockUserClaims['target_user_01']).toEqual({ isSuspended: true });

    // 3. Verify tokens revoked
    expect(mockRevokedTokens).toContain('target_user_01');

    // 4. Verify audit log entry
    expect(mockAuditLogs.length).toBe(1);
    expect(mockAuditLogs[0].action).toContain('SUSPEND_USER');
    expect(mockAuditLogs[0].actorRole).toBe('admin');
    expect(mockAuditLogs[0].target).toContain('target_user_01');
  });

  it('successfully reactivates a suspended user, sets isSuspended=false claim, and logs audit', async () => {
    // Suspend user first
    mockFirestoreData['users/target_user_01'].isActive = false;
    mockUserClaims['target_user_01'] = { isSuspended: true };

    const validReactivateRequest = {
      data: { targetUid: 'target_user_01' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', name: 'Super Admin' },
      },
    } as any;

    const result = await reactivateUser.run(validReactivateRequest);

    expect(result).toEqual({
      success: true,
      targetUid: 'target_user_01',
      isSuspended: false,
    });

    // 1. Verify Firestore document updated
    expect(mockFirestoreData['users/target_user_01'].isActive).toBe(true);

    // 2. Verify Auth custom claim set
    expect(mockUserClaims['target_user_01']).toEqual({ isSuspended: false });

    // 3. Verify tokens revoked
    expect(mockRevokedTokens).toContain('target_user_01');

    // 4. Verify audit log entry
    expect(mockAuditLogs.length).toBe(1);
    expect(mockAuditLogs[0].action).toBe('UNSUSPEND_USER');
  });

  it('is idempotent under duplicate suspension and reactivation calls', async () => {
    const validRequest = {
      data: { targetUid: 'target_user_01' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', name: 'Super Admin' },
      },
    } as any;

    // Call suspend twice
    await suspendUser.run(validRequest);
    const secondResult = await suspendUser.run(validRequest);

    expect(secondResult.success).toBe(true);
    expect(mockFirestoreData['users/target_user_01'].isActive).toBe(false);
    expect(mockUserClaims['target_user_01'].isSuspended).toBe(true);

    // Call reactivate twice
    await reactivateUser.run(validRequest);
    const fourthResult = await reactivateUser.run(validRequest);

    expect(fourthResult.success).toBe(true);
    expect(mockFirestoreData['users/target_user_01'].isActive).toBe(true);
    expect(mockUserClaims['target_user_01'].isSuspended).toBe(false);
  });
});
