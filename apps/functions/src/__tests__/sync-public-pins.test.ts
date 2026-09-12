import { describe, it, expect, beforeEach } from 'vitest';
import { syncPublicPins, processSyncPublicPinsLogic } from '../pins/syncPublicPins';

describe('Cloud Functions — syncPublicPins (CF-005 & TEST-002)', () => {
  let mockDbData: Record<string, any>;

  function matchesFilter(actual: any, op: string, target: any) {
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
        const createQuery = (filters: Array<{ field: string; op: string; val: any }>) => ({
          where: (f: string, op: string, val: any) =>
            createQuery([...filters, { field: f, op, val }]),
          doc: (docId: string) => ({
            id: docId,
            path: `${colName}/${docId}`,
            get: async () => {
              const data = mockDbData[`${colName}/${docId}`];
              return {
                id: docId,
                path: `${colName}/${docId}`,
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
          get: async () => {
            const matches = Object.entries(mockDbData).filter(([k, d]) => {
              if (!k.startsWith(`${colName}/`)) return false;
              return filters.every((filter) =>
                matchesFilter(d[filter.field], filter.op, filter.val)
              );
            });
            const docs = matches.map(([k, d]) => {
              const docId = k.slice(`${colName}/`.length);
              return {
                id: docId,
                ref: { id: docId, path: k },
                data: () => d,
              };
            });
            return { docs, size: docs.length, empty: docs.length === 0 };
          },
        });
        return createQuery([]);
      },
      batch: () => {
        const operations: Array<() => void> = [];
        return {
          set: (docRef: any, data: any, options?: { merge: boolean }) => {
            operations.push(() => {
              const key = docRef.path || (docRef.id ? `public_pins/${docRef.id}` : 'unknown');
              if (options?.merge && mockDbData[key]) {
                mockDbData[key] = { ...mockDbData[key], ...data };
              } else {
                mockDbData[key] = data;
              }
            });
          },
          delete: (docRef: any) => {
            operations.push(() => {
              const key = docRef.path || (docRef.id ? `public_pins/${docRef.id}` : 'unknown');
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

  it('uses cursor to prevent re-scanning or re-syncing unchanged records on subsequent runs', async () => {
    const mockDb = createMockDb() as any;

    mockDbData['black_spots/spot_1'] = {
      id: 'spot_1',
      name: 'Spot 1',
      status: 'published',
      latitude: -1.28,
      longitude: 36.82,
      updatedAt: '2026-09-12T00:00:00.000Z',
    };

    // First run establishes the cursor and syncs spot_1
    const firstRun = await processSyncPublicPinsLogic(mockDb);
    expect(firstRun.syncedCount).toBe(1);
    expect(firstRun.deletedCount).toBe(0);
    expect(mockDbData['public_pins/spot_1'].title).toBe('Spot 1');
    expect(mockDbData['system_config/public_pins_sync']?.lastSyncedAt).toBeDefined();

    // Second run has no updated records: cursor ensures 0 records are re-synced!
    const secondRun = await processSyncPublicPinsLogic(mockDb);
    expect(secondRun.syncedCount).toBe(0);
    expect(secondRun.deletedCount).toBe(0);
    expect(mockDbData['public_pins/spot_1'].title).toBe('Spot 1');

    // Add a new spot with updatedAt > cursor
    mockDbData['black_spots/spot_2'] = {
      id: 'spot_2',
      name: 'Spot 2',
      status: 'published',
      latitude: -1.30,
      longitude: 36.85,
      updatedAt: new Date(Date.now() + 60000).toISOString(),
    };

    // Third run: only spot_2 is processed and synced, spot_1 is NOT re-synced
    const thirdRun = await processSyncPublicPinsLogic(mockDb);
    expect(thirdRun.syncedCount).toBe(1);
    expect(mockDbData['public_pins/spot_2'].title).toBe('Spot 2');
    expect(mockDbData['public_pins/spot_1'].title).toBe('Spot 1');
  });

  it('purges unverified or rejected spots during incremental cursor sync', async () => {
    const mockDb = createMockDb() as any;

    // Initially published spot
    mockDbData['black_spots/spot_to_reject'] = {
      id: 'spot_to_reject',
      name: 'Under Review Hazard',
      status: 'published',
      verifiedByAuthority: true,
      latitude: -1.25,
      longitude: 36.80,
      updatedAt: '2026-09-12T00:00:00.000Z',
    };

    const firstRun = await processSyncPublicPinsLogic(mockDb);
    expect(firstRun.syncedCount).toBe(1);
    expect(mockDbData['public_pins/spot_to_reject']).toBeDefined();

    // Inspector rejects or unpublishes the hazard, bumping updatedAt
    mockDbData['black_spots/spot_to_reject'] = {
      ...mockDbData['black_spots/spot_to_reject'],
      status: 'rejected',
      verifiedByAuthority: false,
      updatedAt: new Date(Date.now() + 60000).toISOString(),
    };

    const secondRun = await processSyncPublicPinsLogic(mockDb);
    expect(secondRun.deletedCount).toBe(1);
    expect(mockDbData['public_pins/spot_to_reject']).toBeUndefined();
  });

  it('supports forceFullScan: true to re-scan and sync all records on demand', async () => {
    const mockDb = createMockDb() as any;

    mockDbData['black_spots/spot_alpha'] = {
      id: 'spot_alpha',
      name: 'Alpha Hazard',
      status: 'published',
      latitude: -1.28,
      longitude: 36.82,
      updatedAt: '2026-09-12T00:00:00.000Z',
    };

    const firstRun = await processSyncPublicPinsLogic(mockDb);
    expect(firstRun.syncedCount).toBe(1);

    // With forceFullScan, it bypasses the cursor and rescans the collection
    const forceRun = await processSyncPublicPinsLogic(mockDb, { forceFullScan: true });
    expect(forceRun.syncedCount).toBe(1);
    expect(mockDbData['public_pins/spot_alpha'].title).toBe('Alpha Hazard');
  });

  it('verifying a black spot (authority verification action) triggers incremental sync to public_pins without re-scanning older spots', async () => {
    const mockDb = createMockDb() as any;

    // Pre-existing spot already synced
    mockDbData['black_spots/existing_spot'] = {
      id: 'existing_spot',
      name: 'Existing Spot',
      status: 'published',
      verifiedByAuthority: true,
      latitude: -1.20,
      longitude: 36.80,
      updatedAt: '2026-09-10T10:00:00.000Z',
    };

    // Pre-existing pending spot not yet verified
    mockDbData['black_spots/spot_pending_review'] = {
      id: 'spot_pending_review',
      name: 'Dangerous Overpass Dip',
      status: 'pending',
      verifiedByAuthority: false,
      latitude: -1.29,
      longitude: 36.83,
      updatedAt: '2026-09-10T11:00:00.000Z',
    };

    // Initial sync
    const initialSync = await processSyncPublicPinsLogic(mockDb);
    expect(initialSync.syncedCount).toBe(1);
    expect(mockDbData['public_pins/existing_spot']).toBeDefined();
    expect(mockDbData['public_pins/spot_pending_review']).toBeUndefined();

    // Inspector verifies and publishes spot_pending_review (simulating AuthorityBlackSpotsScreen.tsx)
    const verificationTime = '2026-09-12T12:00:00.000Z';
    mockDbData['black_spots/spot_pending_review'] = {
      ...mockDbData['black_spots/spot_pending_review'],
      status: 'published',
      verifiedByAuthority: true,
      updatedAt: verificationTime,
    };

    // Incremental sync runs immediately after verification
    const afterVerifySync = await processSyncPublicPinsLogic(mockDb);

    // Only 1 spot was synced (spot_pending_review), existing_spot was skipped due to cursor
    expect(afterVerifySync.syncedCount).toBe(1);
    expect(afterVerifySync.deletedCount).toBe(0);

    // Both spots are now in public_pins
    expect(mockDbData['public_pins/existing_spot']).toBeDefined();
    expect(mockDbData['public_pins/spot_pending_review']).toBeDefined();
    expect(mockDbData['public_pins/spot_pending_review'].title).toBe('Dangerous Overpass Dip');
  });
});
