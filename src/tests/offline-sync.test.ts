// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { offlineStorage } from '../services/offlineStorage';
import { offlineSyncService, OfflineSyncService } from '../services/offlineSyncService';
import { useOfflineStore } from '../store/useOfflineStore';
import { tripRepository, blackSpotRepository } from '../repositories';

describe('VT-004: Offline Storage Queue & Reconnect Drain Synchronization', () => {
  const store: Record<string, any> = {};

  beforeEach(() => {
    // Reset local memory store
    Object.keys(store).forEach((k) => delete store[k]);

    // Mock offlineStorage methods using in-memory store
    vi.spyOn(offlineStorage, 'getItem').mockImplementation(async (key: string) => {
      return store[key] !== undefined ? store[key] : null;
    });
    vi.spyOn(offlineStorage, 'setItem').mockImplementation(async (key: string, value: any) => {
      store[key] = value;
      return value;
    });
    vi.spyOn(offlineStorage, 'removeItem').mockImplementation(async (key: string) => {
      delete store[key];
    });
    vi.spyOn(offlineStorage, 'keys').mockImplementation(async () => {
      return Object.keys(store);
    });
    vi.spyOn(offlineStorage, 'clear').mockImplementation(async () => {
      Object.keys(store).forEach((k) => delete store[k]);
    });

    useOfflineStore.setState({
      isOnline: true,
      queuedActionsCount: 0,
      lastSyncedAt: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates queued actions count when items are saved offline and read back', async () => {
    const mockTrip = {
      id: 'trip_offline_123',
      userId: 'user_p1',
      plateNumber: 'KDA 123A',
      maxSpeedKmH: 75,
      status: 'completed',
    };

    const mockReport = {
      id: 'bs_offline_456',
      title: 'Dangerous Pothole on Waiyaki Way',
      severity: 'high',
      status: 'pending',
    };

    // Save offline items
    await offlineStorage.setItem(`offline_trip_${mockTrip.id}`, mockTrip);
    const countAfter1 = await offlineSyncService.updatePendingCount();
    expect(countAfter1).toBe(1);
    expect(useOfflineStore.getState().queuedActionsCount).toBe(1);

    await offlineStorage.setItem(`offline_report_${mockReport.id}`, mockReport);
    const countAfter2 = await offlineSyncService.updatePendingCount();
    expect(countAfter2).toBe(2);
    expect(useOfflineStore.getState().queuedActionsCount).toBe(2);
  });

  it('drains queued trips and reports to Firestore repositories on reconnect using the same embedded IDs', async () => {
    const savedTrips: any[] = [];
    const savedReports: any[] = [];

    vi.spyOn(tripRepository, 'save').mockImplementation(async (trip: any) => {
      savedTrips.push(trip);
    });

    vi.spyOn(blackSpotRepository, 'save').mockImplementation(async (report: any) => {
      savedReports.push(report);
    });

    const mockTrip1 = {
      id: 'trip_offline_uuid_101',
      userId: 'user_p1',
      plateNumber: 'KDA 111A',
      routeName: 'Nairobi - Nakuru',
      status: 'completed',
    };

    const mockReport1 = {
      id: 'bs_offline_uuid_202',
      title: 'Oil Spill on Expressway',
      severity: 'high',
      status: 'pending',
    };

    // Queue items while simulated offline
    await offlineStorage.setItem(`offline_trip_${mockTrip1.id}`, mockTrip1);
    await offlineStorage.setItem(`offline_report_${mockReport1.id}`, mockReport1);
    await offlineSyncService.updatePendingCount();

    expect(useOfflineStore.getState().queuedActionsCount).toBe(2);
    expect(Object.keys(store).length).toBe(2);

    // Drain queue
    const drainResult = await offlineSyncService.drainQueue();

    // Verify drain result
    expect(drainResult.syncedTrips).toBe(1);
    expect(drainResult.syncedReports).toBe(1);
    expect(drainResult.failedTrips).toBe(0);
    expect(drainResult.failedReports).toBe(0);
    expect(drainResult.remainingCount).toBe(0);

    // Verify repository saves used the exact client-generated IDs
    expect(savedTrips.length).toBe(1);
    expect(savedTrips[0].id).toBe('trip_offline_uuid_101');
    expect(savedReports.length).toBe(1);
    expect(savedReports[0].id).toBe('bs_offline_uuid_202');

    // Verify items were removed from offline storage
    expect(store[`offline_trip_${mockTrip1.id}`]).toBeUndefined();
    expect(store[`offline_report_${mockReport1.id}`]).toBeUndefined();

    // Verify store state updated
    expect(useOfflineStore.getState().queuedActionsCount).toBe(0);
    expect(useOfflineStore.getState().lastSyncedAt).not.toBeNull();
  });

  it('preserves failed items in queue if repository save throws an error during drain', async () => {
    vi.spyOn(tripRepository, 'save').mockRejectedValue(new Error('Network Firestore Error'));

    const mockTrip = {
      id: 'trip_offline_fail_1',
      userId: 'user_p1',
      plateNumber: 'KDA 999Z',
      status: 'completed',
    };

    await offlineStorage.setItem(`offline_trip_${mockTrip.id}`, mockTrip);
    await offlineSyncService.updatePendingCount();

    const drainResult = await offlineSyncService.drainQueue();

    expect(drainResult.syncedTrips).toBe(0);
    expect(drainResult.failedTrips).toBe(1);
    expect(drainResult.remainingCount).toBe(1);

    // Item must still remain in active storage with incremented retryCount
    expect(store[`offline_trip_${mockTrip.id}`]).toEqual({ ...mockTrip, retryCount: 1 });
    expect(useOfflineStore.getState().queuedActionsCount).toBe(1);
  });

  it('moves items to dead-letter queue (offline_failed_*) after exceeding MAX_RETRIES and allows user retry/discard', async () => {
    vi.spyOn(tripRepository, 'save').mockRejectedValue(new Error('Persistent Firestore Permission Error'));

    const mockTrip = {
      id: 'trip_offline_deadletter_1',
      userId: 'user_p1',
      plateNumber: 'KDA 777Q',
      status: 'completed',
    };

    const key = `offline_trip_${mockTrip.id}`;
    await offlineStorage.setItem(key, mockTrip);
    await offlineSyncService.updatePendingCount();

    // Drain 5 times (MAX_RETRIES)
    for (let i = 0; i < 5; i++) {
      await offlineSyncService.drainQueue();
    }

    // Active key must be deleted and dead-letter key populated with retryCount = 5
    expect(store[key]).toBeUndefined();
    expect(store[`offline_failed_${key}`]).toEqual({ ...mockTrip, retryCount: 5 });

    // Store state: queued is 0, failed is 1
    expect(useOfflineStore.getState().queuedActionsCount).toBe(0);
    expect(useOfflineStore.getState().failedActionsCount).toBe(1);

    // Test retry: restore network and retry all failed
    vi.spyOn(tripRepository, 'save').mockResolvedValue(undefined as any);
    const retryResult = await offlineSyncService.retryAllFailed();

    expect(retryResult.syncedTrips).toBe(1);
    expect(store[`offline_failed_${key}`]).toBeUndefined();
    expect(store[key]).toBeUndefined(); // Successfully synced and removed
    expect(useOfflineStore.getState().failedActionsCount).toBe(0);
    expect(useOfflineStore.getState().queuedActionsCount).toBe(0);
  });

  it('BUG-004 verification: retry count is durable across app restarts (3 fails -> restart -> 2 fails -> dead-letter)', async () => {
    vi.spyOn(tripRepository, 'save').mockRejectedValue(new Error('Persistent Network Partition Error'));

    const mockTrip = {
      id: 'trip_offline_durable_bug004',
      userId: 'user_p1',
      plateNumber: 'KDA 333R',
      status: 'completed',
      retryCount: 0,
    };

    const key = `offline_trip_${mockTrip.id}`;
    await offlineStorage.setItem(key, mockTrip);
    await offlineSyncService.updatePendingCount();

    // Session 1: Fail 3 times
    for (let i = 0; i < 3; i++) {
      await offlineSyncService.drainQueue();
    }

    // Persisted item in storage must reflect retryCount: 3
    expect(store[key]).toBeDefined();
    expect(store[key].retryCount).toBe(3);
    expect(store[`offline_failed_${key}`]).toBeUndefined();

    // Simulate app restart / page reload:
    // A new service instance is created without previous in-memory state
    const restartedService = new OfflineSyncService();

    // Session 2: 4th attempt fails
    const drain4 = await restartedService.drainQueue();
    expect(drain4.failedTrips).toBe(1);
    expect(store[key]?.retryCount).toBe(4);
    expect(store[`offline_failed_${key}`]).toBeUndefined();

    // Session 2: 5th attempt fails -> reaches MAX_RETRIES (5) -> moves to dead-letter queue
    const drain5 = await restartedService.drainQueue();
    expect(drain5.failedTrips).toBe(1);

    // Active key must be deleted, dead-letter key populated with retryCount = 5
    expect(store[key]).toBeUndefined();
    expect(store[`offline_failed_${key}`]).toBeDefined();
    expect(store[`offline_failed_${key}`].retryCount).toBe(5);
    expect(store[`offline_failed_${key}`].id).toBe(mockTrip.id);

    // Further drain attempts must NOT retry dead-lettered items indefinitely
    const drain6 = await restartedService.drainQueue();
    expect(drain6.syncedTrips).toBe(0);
    expect(drain6.failedTrips).toBe(0);
    expect(drain6.remainingCount).toBe(0);
    expect(useOfflineStore.getState().queuedActionsCount).toBe(0);
    expect(useOfflineStore.getState().failedActionsCount).toBe(1);
  });

  it('durable retry count across app restarts for offline hazard reports', async () => {
    vi.spyOn(blackSpotRepository, 'save').mockRejectedValue(new Error('Firestore Error'));

    const mockReport = {
      id: 'bs_offline_durable_restart',
      name: 'Dangerous Bump',
      routeName: 'Thika Road',
      severity: 'high' as const,
      hazardDescription: 'Unmarked speed bump',
      reportedByUid: 'user_p1',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    const key = `offline_report_${mockReport.id}`;
    await offlineStorage.setItem(key, mockReport);
    await offlineSyncService.updatePendingCount();

    // Session 1: Fail 3 times
    for (let i = 0; i < 3; i++) {
      await offlineSyncService.drainQueue();
    }
    expect(store[key]?.retryCount).toBe(3);

    // Simulate app restart
    const restartedService = new OfflineSyncService();

    // Session 2: Fail 2 more times (total 5)
    await restartedService.drainQueue(); // 4
    expect(store[key]?.retryCount).toBe(4);

    await restartedService.drainQueue(); // 5 -> moves to dead-letter
    expect(store[key]).toBeUndefined();
    expect(store[`offline_failed_${key}`]).toBeDefined();
    expect(store[`offline_failed_${key}`].retryCount).toBe(5);
  });

  it('triggers drainQueue automatically on window "online" event', async () => {
    const drainSpy = vi.spyOn(offlineSyncService, 'drainQueue').mockResolvedValue({
      syncedTrips: 1,
      syncedReports: 0,
      failedTrips: 0,
      failedReports: 0,
      remainingCount: 0,
    });

    const cleanup = offlineSyncService.init();

    // Set offline
    window.dispatchEvent(new Event('offline'));
    expect(useOfflineStore.getState().isOnline).toBe(false);

    // Reconnect -> online event
    window.dispatchEvent(new Event('online'));
    expect(useOfflineStore.getState().isOnline).toBe(true);
    expect(drainSpy).toHaveBeenCalled();

    cleanup();
  });
});
