import { describe, it, expect, beforeEach } from 'vitest';
import { syncPublicPins, processSyncPublicPinsLogic } from '../pins/syncPublicPins';

describe('Cloud Functions — syncPublicPins (CF-005 & TEST-002)', () => {
  let mockDbData: Record<string, any>;

  function createMockDb() {
    return {
      collection: (colName: string) => ({
        doc: (docId: string) => ({
          id: docId,
          path: `${colName}/${docId}`,
          get: async () => {
            const data = mockDbData[`${colName}/${docId}`];
            return {
              id: docId,
              exists: !!data,
              data: () => data || {},
            };
          },
        }),
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
          return { docs, size: docs.length };
        },
      }),
      batch: () => {
        const operations: Array<() => void> = [];
        return {
          set: (docRef: any, data: any, options?: { merge: boolean }) => {
            operations.push(() => {
              const docId = docRef.id || 'unknown';
              const key = `public_pins/${docId}`;
              if (options?.merge && mockDbData[key]) {
                mockDbData[key] = { ...mockDbData[key], ...data };
              } else {
                mockDbData[key] = data;
              }
            });
          },
          delete: (docRef: any) => {
            operations.push(() => {
              const key = docRef.path || `public_pins/${docRef.id}`;
              delete mockDbData[key];
            });
          },
          commit: async () => {
            operations.forEach((op) => op());
          },
        };
      },
    };
  }

  beforeEach(() => {
    mockDbData = {};
  });

  it('rejects unauthenticated caller with unauthenticated error', async () => {
    const unauthRequest = {
      data: {},
      auth: null,
    } as any;

    await expect(syncPublicPins.run(unauthRequest)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects unauthorized caller (passenger or sacco_manager) with permission-denied', async () => {
    const passengerRequest = {
      data: {},
      auth: {
        uid: 'p1',
        token: { activeRole: 'passenger' },
      },
    } as any;

    await expect(syncPublicPins.run(passengerRequest)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    const saccoManagerRequest = {
      data: {},
      auth: {
        uid: 'sm1',
        token: { activeRole: 'sacco_manager', saccoId: 'sacco_1' },
      },
    } as any;

    await expect(syncPublicPins.run(saccoManagerRequest)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('synchronizes published black spots into public_pins and purges orphaned/unverified pins (CF-005)', async () => {
    const mockDb = createMockDb() as any;

    // Seed black spots: 1 verified, 1 published, 1 unverified draft
    mockDbData['black_spots/spot_salgaa'] = {
      id: 'spot_salgaa',
      name: 'Salgaa Black Spot',
      routeName: 'Nakuru-Eldoret Highway',
      latitude: -0.219,
      longitude: 35.848,
      severity: 'critical',
      status: 'published',
      verifiedByAuthority: true,
    };

    mockDbData['black_spots/spot_kinungi'] = {
      id: 'spot_kinungi',
      name: 'Kinungi Stretch',
      routeName: 'Nairobi-Nakuru Highway',
      latitude: -0.724,
      longitude: 36.432,
      severity: 'high',
      status: 'published',
    };

    mockDbData['black_spots/spot_unverified_draft'] = {
      id: 'spot_unverified_draft',
      name: 'Pending Citizen Report',
      status: 'pending_review',
      verifiedByAuthority: false,
    };

    // Seed existing public pins: includes a stale/retracted pin
    mockDbData['public_pins/spot_stale_retracted'] = {
      id: 'spot_stale_retracted',
      title: 'Old Hazard No Longer Valid',
    };

    const result = await processSyncPublicPinsLogic(mockDb);

    expect(result.syncedCount).toBe(2);
    expect(result.deletedCount).toBe(1);

    // Verify published spots exist in public_pins
    expect(mockDbData['public_pins/spot_salgaa']).toBeDefined();
    expect(mockDbData['public_pins/spot_salgaa'].title).toBe('Salgaa Black Spot');
    expect(mockDbData['public_pins/spot_kinungi']).toBeDefined();

    // Verify unverified spot was NOT synced
    expect(mockDbData['public_pins/spot_unverified_draft']).toBeUndefined();

    // Verify stale retracted spot was deleted
    expect(mockDbData['public_pins/spot_stale_retracted']).toBeUndefined();
  });

  it('is idempotent when run repeatedly without changes to source black_spots', async () => {
    const mockDb = createMockDb() as any;

    mockDbData['black_spots/spot_1'] = {
      id: 'spot_1',
      name: 'Spot 1',
      status: 'published',
      latitude: -1.28,
      longitude: 36.82,
    };

    const firstRun = await processSyncPublicPinsLogic(mockDb);
    expect(firstRun.syncedCount).toBe(1);
    expect(firstRun.deletedCount).toBe(0);

    const secondRun = await processSyncPublicPinsLogic(mockDb);
    expect(secondRun.syncedCount).toBe(1);
    expect(secondRun.deletedCount).toBe(0);
    expect(mockDbData['public_pins/spot_1'].title).toBe('Spot 1');
  });
});
