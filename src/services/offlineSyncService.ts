import { offlineStorage } from './offlineStorage';
import { tripRepository, blackSpotRepository } from '../repositories';
import { useOfflineStore } from '../store/useOfflineStore';
import { Trip, BlackSpot } from '../types';

export interface DrainResult {
  syncedTrips: number;
  syncedReports: number;
  failedTrips: number;
  failedReports: number;
  remainingCount: number;
}

class OfflineSyncService {
  private isDraining = false;
  private retryCounts: Map<string, number> = new Map();

  /**
   * Scans offlineStorage for queued trips and black spot reports and returns the lists of keys.
   */
  async getQueuedKeys(): Promise<{ tripKeys: string[]; reportKeys: string[] }> {
    try {
      const allKeys = await offlineStorage.keys();
      const tripKeys = allKeys.filter((k) => k.startsWith('offline_trip_'));
      const reportKeys = allKeys.filter((k) => k.startsWith('offline_report_'));
      return { tripKeys, reportKeys };
    } catch (err) {
      console.error('[OfflineSyncService] Failed to retrieve queued keys:', err);
      return { tripKeys: [], reportKeys: [] };
    }
  }

  /**
   * Updates the Zustand offline store with the real pending queued count.
   */
  async updatePendingCount(): Promise<number> {
    const { tripKeys, reportKeys } = await this.getQueuedKeys();
    const totalCount = tripKeys.length + reportKeys.length;
    useOfflineStore.getState().setQueuedActionsCount(totalCount);
    return totalCount;
  }

  /**
   * Drains all offline-queued trips and reports, uploading them to Firestore.
   * On success, removes the item from offline storage and decrements the pending count.
   * On failure, retains the item for subsequent retry cycles.
   */
  async drainQueue(): Promise<DrainResult> {
    if (this.isDraining) {
      console.debug('[OfflineSyncService] Drain already in progress. Skipping duplicate run.');
      const { tripKeys, reportKeys } = await this.getQueuedKeys();
      return {
        syncedTrips: 0,
        syncedReports: 0,
        failedTrips: 0,
        failedReports: 0,
        remainingCount: tripKeys.length + reportKeys.length,
      };
    }

    this.isDraining = true;
    let syncedTrips = 0;
    let syncedReports = 0;
    let failedTrips = 0;
    let failedReports = 0;

    try {
      const { tripKeys, reportKeys } = await this.getQueuedKeys();
      useOfflineStore.getState().setQueuedActionsCount(tripKeys.length + reportKeys.length);

      // 1. Process queued trips
      for (const key of tripKeys) {
        try {
          const trip = await offlineStorage.getItem<Trip>(key);
          if (!trip || !trip.id) {
            // Corrupt or empty item - clean up
            await offlineStorage.removeItem(key);
            this.retryCounts.delete(key);
            continue;
          }

          // Use the SAME client-generated ID already embedded in the stored object
          await tripRepository.save(trip);
          await offlineStorage.removeItem(key);
          this.retryCounts.delete(key);
          syncedTrips++;
        } catch (err) {
          console.warn(`[OfflineSyncService] Failed to sync offline trip ${key}:`, err);
          failedTrips++;
          const retries = (this.retryCounts.get(key) || 0) + 1;
          this.retryCounts.set(key, retries);
        }
      }

      // 2. Process queued black spot reports
      for (const key of reportKeys) {
        try {
          const report = await offlineStorage.getItem<BlackSpot>(key);
          if (!report || !report.id) {
            // Corrupt or empty item - clean up
            await offlineStorage.removeItem(key);
            this.retryCounts.delete(key);
            continue;
          }

          // Use the SAME client-generated ID already embedded in the stored object
          await blackSpotRepository.save(report);
          await offlineStorage.removeItem(key);
          this.retryCounts.delete(key);
          syncedReports++;
        } catch (err) {
          console.warn(`[OfflineSyncService] Failed to sync offline report ${key}:`, err);
          failedReports++;
          const retries = (this.retryCounts.get(key) || 0) + 1;
          this.retryCounts.set(key, retries);
        }
      }

      const remaining = await this.updatePendingCount();
      if (syncedTrips > 0 || syncedReports > 0) {
        useOfflineStore.getState().setLastSyncedAt(new Date().toISOString());
      }

      return {
        syncedTrips,
        syncedReports,
        failedTrips,
        failedReports,
        remainingCount: remaining,
      };
    } finally {
      this.isDraining = false;
    }
  }

  /**
   * Initializes listeners for online/offline window events and runs startup drain.
   */
  init(): () => void {
    const handleOnline = async () => {
      useOfflineStore.getState().setIsOnline(true);
      await this.drainQueue();
    };

    const handleOffline = async () => {
      useOfflineStore.getState().setIsOnline(false);
      await this.updatePendingCount();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // App startup sweep: set online status, count pending items, and drain if online
      useOfflineStore.getState().setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
      this.updatePendingCount().then(() => {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          this.drainQueue().catch((err) =>
            console.warn('[OfflineSyncService] Startup drain failed:', err)
          );
        }
      });

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {};
  }
}

export const offlineSyncService = new OfflineSyncService();
