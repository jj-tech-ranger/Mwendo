import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignUserRole } from '../admin/assignUserRole';

const mockFirestoreData: Record<string, any> = {};
const mockAuditLogs: any[] = [];
const mockUserClaims: Record<string, any> = {};
const mockAuthUsers: Record<string, any> = {};
const mockRevokedTokens: string[] = [];

vi.mock('firebase-admin/firestore', () => {
  return {
    getFirestore: () => ({
      collection: (colName: string) => {
        const createQuery = (filters: Array<{ field: string; op: string; val: any }> = []) => ({
          where: (field: string, op: string, val: any) => {
            return createQuery([...filters, { field, op, val }]);
          },
          doc: (docId: string) => ({
            get: async () => {
              const data = mockFirestoreData[`${colName}/${docId}`];
              return {
                exists: !!data,
                id: docId,
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
          runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
            const transaction = {
              get: async (docRef: any) => docRef.get(),
              set: async (docRef: any, data: any, options?: { merge: boolean }) => docRef.set(data, options),
            };
            return updateFunction(transaction);
          },
          get: async () => {
            const prefix = `${colName}/`;
            const matchingDocs: any[] = [];
            for (const [key, val] of Object.entries(mockFirestoreData)) {
              if (!key.startsWith(prefix)) continue;
              const docId = key.substring(prefix.length);
              // Evaluate filters
              let matches = true;
              for (const filter of filters) {
                if (filter.op === '==' && val[filter.field] !== filter.val) {
                  matches = false;
                  break;
                }
              }
              if (matches) {
                matchingDocs.push({
                  id: docId,
                  data: () => val,
                });
              }
            }
            return {
              docs: matchingDocs,
              size: matchingDocs.length,
              forEach: (cb: (doc: any) => void) => matchingDocs.forEach(cb),
            };
          },
        });
        return createQuery();
      },
      runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
        const transaction = {
          get: async (docRef: any) => docRef.get(),
          set: async (docRef: any, data: any, options?: { merge: boolean }) => docRef.set(data, options),
        };
        return updateFunction(transaction);
      },
    }),
  };
});

vi.mock('firebase-admin/auth', () => {
  return {
    getAuth: () => ({
      getUser: async (uid: string) => {
        if (!mockAuthUsers[uid]) {
          const err: any = new Error(`User not found: ${uid}`);
          err.code = 'auth/user-not-found';
          throw err;
        }
        return {
          uid,
          customClaims: mockUserClaims[uid] || {},
          ...mockAuthUsers[uid],
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

describe('Cloud Functions — assignUserRole (Server-Authoritative Role Provisioning)', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockFirestoreData)) {
      delete mockFirestoreData[key];
    }
    mockAuditLogs.length = 0;
    for (const key of Object.keys(mockUserClaims)) {
      delete mockUserClaims[key];
    }
    for (const key of Object.keys(mockAuthUsers)) {
      delete mockAuthUsers[key];
    }
    mockRevokedTokens.length = 0;

    // Seed primary admin caller in Auth and Firestore
    mockAuthUsers['admin_caller_01'] = { uid: 'admin_caller_01', email: 'admin@mwendosalama.co.ke' };
    mockUserClaims['admin_caller_01'] = { activeRole: 'admin' };
    mockFirestoreData['users/admin_caller_01'] = {
      uid: 'admin_caller_01',
      displayName: 'System Admin',
      role: 'admin',
      activeRole: 'admin',
      isActive: true,
    };

    // Seed second admin for demotion tests
    mockAuthUsers['admin_caller_02'] = { uid: 'admin_caller_02', email: 'admin2@mwendosalama.co.ke' };
    mockUserClaims['admin_caller_02'] = { activeRole: 'admin' };
    mockFirestoreData['users/admin_caller_02'] = {
      uid: 'admin_caller_02',
      displayName: 'Secondary Admin',
      role: 'admin',
      activeRole: 'admin',
      isActive: true,
    };

    // Seed target user
    mockAuthUsers['target_user_01'] = { uid: 'target_user_01', email: 'commuter@example.com' };
    mockUserClaims['target_user_01'] = { activeRole: 'passenger' };
    mockFirestoreData['users/target_user_01'] = {
      uid: 'target_user_01',
      displayName: 'Jane Commuter',
      role: 'passenger',
      activeRole: 'passenger',
      isActive: true,
    };

    // Seed registered SACCO
    mockFirestoreData['saccos/2NK_SACCO'] = {
      id: '2NK_SACCO',
      name: '2NK Sacco Ltd',
      status: 'active',
    };
  });

  it('rejects unauthenticated caller with unauthenticated error code', async () => {
    const unauthenticatedReq = {
      data: { targetUid: 'target_user_01', newRole: 'sacco_manager', saccoId: '2NK_SACCO' },
      auth: null,
    } as any;

    await expect(assignUserRole.run(unauthenticatedReq)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects non-admin caller (passenger or sacco_manager) with permission-denied', async () => {
    const passengerReq = {
      data: { targetUid: 'target_user_01', newRole: 'sacco_manager', saccoId: '2NK_SACCO' },
      auth: {
        uid: 'passenger_caller_99',
        token: { activeRole: 'passenger' },
      },
    } as any;

    await expect(assignUserRole.run(passengerReq)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    const saccoManagerReq = {
      data: { targetUid: 'target_user_01', newRole: 'sacco_manager', saccoId: '2NK_SACCO' },
      auth: {
        uid: 'sacco_mgr_99',
        token: { activeRole: 'sacco_manager', saccoId: '2NK_SACCO' },
      },
    } as any;

    await expect(assignUserRole.run(saccoManagerReq)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects suspended admin caller with permission-denied', async () => {
    const suspendedAdminReq = {
      data: { targetUid: 'target_user_01', newRole: 'sacco_manager', saccoId: '2NK_SACCO' },
      auth: {
        uid: 'admin_suspended',
        token: { activeRole: 'admin', isSuspended: true, mfaVerifiedAt: Date.now() },
      },
    } as any;

    await expect(assignUserRole.run(suspendedAdminReq)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'Suspended accounts cannot perform administrative actions.',
    });
  });

  it('SEC-MFA: rejects admin caller without mfaVerifiedAt claim with failed-precondition', async () => {
    const unverifiedAdminReq = {
      data: { targetUid: 'target_user_01', newRole: 'sacco_manager', saccoId: '2NK_SACCO' },
      auth: {
        uid: 'admin_unverified',
        token: { activeRole: 'admin' },
      },
    } as any;

    await expect(assignUserRole.run(unverifiedAdminReq)).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'MFA re-verification required.',
    });
  });

  it('SEC-MFA: rejects admin caller whose mfaVerifiedAt is older than 12 hours', async () => {
    const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000;
    const expiredMfaReq = {
      data: { targetUid: 'target_user_01', newRole: 'sacco_manager', saccoId: '2NK_SACCO' },
      auth: {
        uid: 'admin_expired',
        token: { activeRole: 'admin', mfaVerifiedAt: thirteenHoursAgo },
      },
    } as any;

    await expect(assignUserRole.run(expiredMfaReq)).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'MFA re-verification required.',
    });
  });

  it('rejects missing or empty targetUid with invalid-argument', async () => {
    const missingTargetReq = {
      data: { newRole: 'admin' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    await expect(assignUserRole.run(missingTargetReq)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects invalid or unauthorized role strings with invalid-argument', async () => {
    const invalidRoleReq = {
      data: { targetUid: 'target_user_01', newRole: 'super_root_admin' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    await expect(assignUserRole.run(invalidRoleReq)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects sacco_manager role assignment when saccoId is missing or non-existent', async () => {
    const missingSaccoReq = {
      data: { targetUid: 'target_user_01', newRole: 'sacco_manager' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    await expect(assignUserRole.run(missingSaccoReq)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'saccoId is required when assigning the sacco_manager role.',
    });

    const nonExistentSaccoReq = {
      data: { targetUid: 'target_user_01', newRole: 'sacco_manager', saccoId: 'UNKNOWN_SACCO' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    await expect(assignUserRole.run(nonExistentSaccoReq)).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('rejects authority role when authorityScope is county but county is missing', async () => {
    const missingCountyReq = {
      data: { targetUid: 'target_user_01', newRole: 'authority', authorityScope: 'county' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    await expect(assignUserRole.run(missingCountyReq)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: "county is required when authorityScope is 'county'.",
    });
  });

  it('safeguard: blocks an admin from removing their own admin role if they are the sole admin', async () => {
    // Remove second admin so caller is the only admin
    delete mockFirestoreData['users/admin_caller_02'];

    const selfDemotionReq = {
      data: { targetUid: 'admin_caller_01', newRole: 'passenger' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    await expect(assignUserRole.run(selfDemotionReq)).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Cannot remove admin role from the sole active administrator account. Promote another admin first.',
    });
  });

  it('safeguard: allows self-demotion when another active admin exists', async () => {
    // admin_caller_02 exists in mockFirestoreData
    const selfDemotionReq = {
      data: { targetUid: 'admin_caller_01', newRole: 'passenger' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    const result = await assignUserRole.run(selfDemotionReq);
    expect(result.success).toBe(true);
    expect(result.newRole).toBe('passenger');
    expect(mockUserClaims['admin_caller_01'].activeRole).toBe('passenger');
  });

  it('throws not-found when targetUid does not exist in Firebase Auth', async () => {
    const ghostUserReq = {
      data: { targetUid: 'non_existent_uid_123', newRole: 'admin' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    await expect(assignUserRole.run(ghostUserReq)).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('successfully assigns sacco_manager role, merges claims, revokes tokens, updates Firestore, and logs audit', async () => {
    // Preserve existing isSuspended: false
    mockUserClaims['target_user_01'] = { isSuspended: false, otherFlag: 'test' };

    const validReq = {
      data: { targetUid: 'target_user_01', newRole: 'sacco_manager', saccoId: '2NK_SACCO' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', name: 'Super Admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    const result = await assignUserRole.run(validReq);

    expect(result.success).toBe(true);
    expect(result.targetUid).toBe('target_user_01');
    expect(result.previousRole).toBe('passenger');
    expect(result.newRole).toBe('sacco_manager');

    // 1. Verify Auth claims merged and not clobbered
    expect(mockUserClaims['target_user_01']).toEqual({
      isSuspended: false,
      otherFlag: 'test',
      activeRole: 'sacco_manager',
      saccoId: '2NK_SACCO',
    });

    // 2. Verify refresh tokens revoked
    expect(mockRevokedTokens).toContain('target_user_01');

    // 3. Verify Firestore users document updated
    const userDoc = mockFirestoreData['users/target_user_01'];
    expect(userDoc.role).toBe('sacco_manager');
    expect(userDoc.activeRole).toBe('sacco_manager');
    expect(userDoc.claimedActiveRole).toBe('sacco_manager');
    expect(userDoc.saccoId).toBe('2NK_SACCO');
    expect(userDoc.claimedSaccoId).toBe('2NK_SACCO');
    expect(userDoc.authorityScope).toBeNull();

    // 4. Verify audit log entry
    expect(mockAuditLogs.length).toBe(1);
    expect(mockAuditLogs[0].action).toBe('ASSIGN_USER_ROLE (sacco_manager)');
    expect(mockAuditLogs[0].actorRole).toBe('admin');
    expect(mockAuditLogs[0].target).toContain('target_user_01');
    expect(mockAuditLogs[0].saccoId).toBe('2NK_SACCO');
  });

  it('successfully assigns authority role with county scope, updating claims and Firestore', async () => {
    const validReq = {
      data: {
        targetUid: 'target_user_01',
        newRole: 'authority',
        authorityScope: 'county',
        county: 'Nairobi',
        badgeNumber: 'NTSA-8842',
      },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', name: 'Super Admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    const result = await assignUserRole.run(validReq);

    expect(result.success).toBe(true);
    expect(result.newRole).toBe('authority');
    expect(mockUserClaims['target_user_01'].activeRole).toBe('authority');
    expect(mockUserClaims['target_user_01'].authorityScope).toBe('county');
    expect(mockUserClaims['target_user_01'].county).toBe('Nairobi');
    expect(mockUserClaims['target_user_01'].saccoId).toBeUndefined();

    const userDoc = mockFirestoreData['users/target_user_01'];
    expect(userDoc.role).toBe('authority');
    expect(userDoc.authorityScope).toBe('county');
    expect(userDoc.county).toBe('Nairobi');
    expect(userDoc.badgeNumber).toBe('NTSA-8842');
    expect(userDoc.saccoId).toBeNull();
  });

  it('transitions team_users invite document from invited to active when teamUserId is supplied', async () => {
    // Seed team_users invite
    mockFirestoreData['team_users/invite_123'] = {
      id: 'invite_123',
      saccoId: '2NK_SACCO',
      name: 'Jane Commuter',
      email: 'commuter@example.com',
      role: 'sacco_manager',
      status: 'invited',
    };

    const validReq = {
      data: {
        targetUid: 'target_user_01',
        newRole: 'sacco_manager',
        saccoId: '2NK_SACCO',
        teamUserId: 'invite_123',
      },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    await assignUserRole.run(validReq);

    const teamUserDoc = mockFirestoreData['team_users/invite_123'];
    expect(teamUserDoc.status).toBe('active');
    expect(teamUserDoc.uid).toBe('target_user_01');
  });

  it('enforces rate limiting when caller exceeds 20 assignments in 1 hour', async () => {
    // Pre-populate rate limits with 20 recent timestamps
    const now = Date.now();
    const timestamps = Array.from({ length: 20 }, (_, i) => now - i * 1000);
    mockFirestoreData['rate_limits/admin_caller_01'] = {
      userId: 'admin_caller_01',
      roleAssignmentTimestamps: timestamps,
      updatedAt: new Date(now).toISOString(),
    };

    const validReq = {
      data: { targetUid: 'target_user_01', newRole: 'admin' },
      auth: {
        uid: 'admin_caller_01',
        token: { activeRole: 'admin', mfaVerifiedAt: Date.now() },
      },
    } as any;

    await expect(assignUserRole.run(validReq)).rejects.toMatchObject({
      code: 'resource-exhausted',
      message: expect.stringContaining('Maximum 20 role assignments permitted per hour'),
    });
  });
});
