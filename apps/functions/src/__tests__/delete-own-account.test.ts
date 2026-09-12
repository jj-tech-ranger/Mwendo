import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteOwnAccount, processDeleteOwnAccountLogic } from '../auth/deleteOwnAccount';

const mockFirestoreData: Record<string, any> = {};
const mockAuditLogs: any[] = [];
const mockAuthUsers: Set<string> = new Set();
const mockBatches: any[] = [];

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
          delete: async () => {
            delete mockFirestoreData[`${colName}/${docId}`];
          },
        }),
        where: (field: string, op: string, value: any) => ({
          get: async () => {
            const docs = Object.entries(mockFirestoreData)
              .filter(([k, v]) => k.startsWith(`${colName}/`) && v && v[field] === value)
              .map(([k, v]) => ({
                id: k.split('/')[1],
                ref: {
                  update: async (patch: any) => {
                    mockFirestoreData[k] = { ...mockFirestoreData[k], ...patch };
                  },
                },
                data: () => v,
              }));
            return {
              empty: docs.length === 0,
              docs,
            };
          },
        }),
        add: async (data: any) => {
          mockAuditLogs.push(data);
          return { id: `audit_${Date.now()}` };
        },
      }),
      batch: () => {
        const batchOps: Array<() => Promise<void>> = [];
        return {
          update: (docRef: any, patch: any) => {
            batchOps.push(async () => {
              await docRef.update(patch);
            });
          },
          commit: async () => {
            for (const op of batchOps) {
              await op();
            }
          },
        };
      },
    }),
  };
});

vi.mock('firebase-admin/auth', () => {
  return {
    getAuth: () => ({
      deleteUser: async (uid: string) => {
        if (!mockAuthUsers.has(uid)) {
          const err: any = new Error('User not found');
          err.code = 'auth/user-not-found';
          throw err;
        }
        mockAuthUsers.delete(uid);
      },
    }),
  };
});

describe('Cloud Functions — deleteOwnAccount (SEC-004 & DPA-2019 Right to Erasure)', () => {
  const passengerUid = 'passenger_user_123';
  const victimUid = 'victim_user_456';

  beforeEach(() => {
    for (const key of Object.keys(mockFirestoreData)) {
      delete mockFirestoreData[key];
    }
    mockAuditLogs.length = 0;
    mockAuthUsers.clear();
    mockBatches.length = 0;

    // Seed passenger profile
    mockFirestoreData[`users/${passengerUid}`] = {
      id: passengerUid,
      uid: passengerUid,
      displayName: 'Alice Commuter',
      email: 'alice@example.com',
      phoneNumber: '+254712345678',
      role: 'passenger',
      activeRole: 'passenger',
      isActive: true,
      trustScore: 85,
      fcmTokens: ['token_abc'],
    };

    // Seed victim profile (to test cross-account tampering prevention)
    mockFirestoreData[`users/${victimUid}`] = {
      id: victimUid,
      uid: victimUid,
      displayName: 'Bob Driver',
      email: 'bob@example.com',
      phoneNumber: '+254799999999',
      role: 'driver',
      activeRole: 'driver',
      isActive: true,
    };

    // Seed rate limits
    mockFirestoreData[`rate_limits/${passengerUid}`] = {
      id: passengerUid,
      userId: passengerUid,
      blackSpotTimestamps: [Date.now()],
    };

    // Seed complaint filed by passenger
    mockFirestoreData['complaints/complaint_01'] = {
      id: 'complaint_01',
      reportedByUid: passengerUid,
      passengerName: 'Alice Commuter',
      title: 'Overcharging on Thika Superhighway',
      description: 'Conductor charged 150 instead of 100.',
      saccoId: 'sacco_44',
      status: 'open',
    };

    // Seed black spot reported by passenger
    mockFirestoreData['black_spots/spot_01'] = {
      id: 'spot_01',
      spotId: 'spot_01',
      reportedByUid: passengerUid,
      reportedByDisplayName: 'Alice Commuter',
      title: 'Deep Pothole',
      hazardType: 'road_damage',
      severity: 'high',
    };

    // Seed Firebase Auth users
    mockAuthUsers.add(passengerUid);
    mockAuthUsers.add(victimUid);
  });

  it('rejects unauthenticated caller with unauthenticated error code', async () => {
    const unauthenticatedRequest = {
      data: {},
      auth: null,
    } as any;

    await expect(deleteOwnAccount.run(unauthenticatedRequest)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('strictly acts on request.auth.uid and ignores any client-supplied target ID', async () => {
    // Malicious request trying to target victimUid
    const maliciousRequest = {
      data: { targetUid: victimUid, userId: victimUid },
      auth: {
        uid: passengerUid,
        token: { activeRole: 'passenger' },
      },
    } as any;

    const result = await deleteOwnAccount.run(maliciousRequest);

    expect(result.success).toBe(true);
    expect(result.userId).toBe(passengerUid);

    // Victim profile MUST NOT be altered
    expect(mockFirestoreData[`users/${victimUid}`].displayName).toBe('Bob Driver');
    expect(mockFirestoreData[`users/${victimUid}`].isActive).toBe(true);
    expect(mockAuthUsers.has(victimUid)).toBe(true);

    // Caller profile MUST be anonymized
    expect(mockFirestoreData[`users/${passengerUid}`].displayName).toBe('De-identified User');
    expect(mockFirestoreData[`users/${passengerUid}`].email).toBe('');
    expect(mockFirestoreData[`users/${passengerUid}`].phoneNumber).toBe('');
    expect(mockFirestoreData[`users/${passengerUid}`].isDeleted).toBe(true);
    expect(mockFirestoreData[`users/${passengerUid}`].isActive).toBe(false);
    expect(mockAuthUsers.has(passengerUid)).toBe(false);
  });

  it('strips PII from user profile document and marks account deleted', async () => {
    const request = {
      data: {},
      auth: {
        uid: passengerUid,
        token: { activeRole: 'passenger' },
      },
    } as any;

    await deleteOwnAccount.run(request);

    const userDoc = mockFirestoreData[`users/${passengerUid}`];
    expect(userDoc.displayName).toBe('De-identified User');
    expect(userDoc.email).toBe('');
    expect(userDoc.phoneNumber).toBe('');
    expect(userDoc.photoUrl).toBeNull();
    expect(userDoc.fcmTokens).toEqual([]);
    expect(userDoc.isDeleted).toBe(true);
    expect(userDoc.isActive).toBe(false);
    expect(userDoc.anonymizedAt).toBeDefined();
    expect(userDoc.deletedAt).toBeDefined();
  });

  it('removes rate limits document for the user', async () => {
    expect(mockFirestoreData[`rate_limits/${passengerUid}`]).toBeDefined();

    const request = {
      data: {},
      auth: {
        uid: passengerUid,
        token: { activeRole: 'passenger' },
      },
    } as any;

    await deleteOwnAccount.run(request);

    expect(mockFirestoreData[`rate_limits/${passengerUid}`]).toBeUndefined();
  });

  it('anonymizes associated safety complaint records without deleting safety history', async () => {
    const request = {
      data: {},
      auth: {
        uid: passengerUid,
        token: { activeRole: 'passenger' },
      },
    } as any;

    await deleteOwnAccount.run(request);

    const complaint = mockFirestoreData['complaints/complaint_01'];
    expect(complaint).toBeDefined(); // Retained for safety accountability
    expect(complaint.passengerName).toBe('De-identified Passenger'); // PII stripped
    expect(complaint.title).toBe('Overcharging on Thika Superhighway'); // Context preserved
  });

  it('anonymizes black spot report author display name while preserving hazard data', async () => {
    const request = {
      data: {},
      auth: {
        uid: passengerUid,
        token: { activeRole: 'passenger' },
      },
    } as any;

    await deleteOwnAccount.run(request);

    const spot = mockFirestoreData['black_spots/spot_01'];
    expect(spot).toBeDefined();
    expect(spot.reportedByDisplayName).toBe('De-identified Commuter');
    expect(spot.title).toBe('Deep Pothole');
  });

  it('records an audit log entry for compliance tracking', async () => {
    const request = {
      data: {},
      auth: {
        uid: passengerUid,
        token: { activeRole: 'passenger' },
      },
    } as any;

    await deleteOwnAccount.run(request);

    const auditEntry = mockAuditLogs.find((l) => l.action === 'DELETE_OWN_ACCOUNT');
    expect(auditEntry).toBeDefined();
    expect(auditEntry.actorUid).toBe(passengerUid);
    expect(auditEntry.details.retentionPolicy).toBe('anonymize-and-retain');
  });

  it('is idempotent when caller is already deleted in Auth or profile already anonymized', async () => {
    // Delete auth user first to simulate duplicate invocation
    mockAuthUsers.delete(passengerUid);

    const request = {
      data: {},
      auth: {
        uid: passengerUid,
        token: { activeRole: 'passenger' },
      },
    } as any;

    // Must not throw auth/user-not-found
    const result = await deleteOwnAccount.run(request);
    expect(result.success).toBe(true);
    expect(result.userId).toBe(passengerUid);
  });
});
