import { offlineStorage } from './offlineStorage';
import { tripRepository, blackSpotRepository } from '../repositories';
import { useOfflineStore } from '../store/useOfflineStore';
import { Trip, BlackSpot } from '../types';

export const MAX_RETRIES = 5;

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
   * Scans offlineStorage for dead-letter failed items that exceeded MAX_RETRIES.
   */
  async getFailedKeys(): Promise<{ failedTripKeys: string[]; failedReportKeys: string[] }> {
    try {
      const allKeys = await offlineStorage.keys();
      const failedKeys = allKeys.filter((k) => k.startsWith('offline_failed_'));
      const failedTripKeys = failedKeys.filter((k) => k.includes('trip'));
      const failedReportKeys = failedKeys.filter(
        (k) => k.includes('report') || k.includes('blackspot') || k.includes('bs_')
      );
      return { failedTripKeys, failedReportKeys };
    } catch (err) {
      console.error('[OfflineSyncService] Failed to retrieve failed keys:', err);
      return { failedTripKeys: [], failedReportKeys: [] };
    }
  }

  /**
   * Updates the Zustand offline store with the real pending queued count and failed count.
   */
  async updatePendingCount(): Promise<number> {
    const { tripKeys, reportKeys } = await this.getQueuedKeys();
    const { failedTripKeys, failedReportKeys } = await this.getFailedKeys();
    const totalCount = tripKeys.length + reportKeys.length;
    const totalFailed = failedTripKeys.length + failedReportKeys.length;

    useOfflineStore.getState().setQueuedActionsCount(totalCount);
    useOfflineStore.getState().setFailedActionsCount(totalFailed);
    return totalCount;
  }

  /**
   * Drains all offline-queued trips and reports, uploading them to Firestore.
   * On success, removes the item from offline storage and decrements the pending count.
   * On failure, increments retry count; if retries >= MAX_RETRIES, moves to dead-letter storage.
   */
  async drainQueue(): Promise<DrainResult> {
    if (this.isDraining) {
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
      await this.updatePendingCount();

      // 1. Process queued trips
      for (const key of tripKeys) {
        let currentTrip: Trip | null = null;
        try {
          currentTrip = await offlineStorage.getItem<Trip>(key);
          if (!currentTrip || !currentTrip.id) {
            // Corrupt or empty item - clean up
            await offlineStorage.removeItem(key);
            this.retryCounts.delete(key);
            continue;
          }

          // Use the SAME client-generated ID already embedded in the stored object
          await tripRepository.save(currentTrip);
          await offlineStorage.removeItem(key);
          this.retryCounts.delete(key);
          syncedTrips++;
        } catch (err) {
          console.warn(`[OfflineSyncService] Failed to sync offline trip ${key}:`, err);
          failedTrips++;
          const retries = (this.retryCounts.get(key) || 0) + 1;
          if (retries >= MAX_RETRIES) {
            if (currentTrip) {
              await offlineStorage.setItem(`offline_failed_${key}`, currentTrip);
            }
            await offlineStorage.removeItem(key);
            this.retryCounts.delete(key);
          } else {
            this.retryCounts.set(key, retries);
          }
        }
      }

      // 2. Process queued black spot reports
      for (const key of reportKeys) {
        let currentReport: BlackSpot | null = null;
        try {
          currentReport = await offlineStorage.getItem<BlackSpot>(key);
          if (!currentReport || !currentReport.id) {
            // Corrupt or empty item - clean up
            await offlineStorage.removeItem(key);
            this.retryCounts.delete(key);
            continue;
          }

          // Use the SAME client-generated ID already embedded in the stored object
          await blackSpotRepository.save(currentReport);
          await offlineStorage.removeItem(key);
          this.retryCounts.delete(key);
          syncedReports++;
        } catch (err) {
          console.warn(`[OfflineSyncService] Failed to sync offline report ${key}:`, err);
          failedReports++;
          const retries = (this.retryCounts.get(key) || 0) + 1;
          if (retries >= MAX_RETRIES) {
            if (currentReport) {
              await offlineStorage.setItem(`offline_failed_${key}`, currentReport);
            }
            await offlineStorage.removeItem(key);
            this.retryCounts.delete(key);
          } else {
            this.retryCounts.set(key, retries);
          }
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
   * Retries all dead-letter failed items by restoring them to the active queue.
   */
  async retryAllFailed(): Promise<DrainResult> {
    const allKeys = await offlineStorage.keys();
    const failedKeys = allKeys.filter((k) => k.startsWith('offline_failed_'));
    for (const fKey of failedKeys) {
      const item = await offlineStorage.getItem(fKey);
      const originalKey = fKey.replace(/^offline_failed_/, '');
      if (item) {
        await offlineStorage.setItem(originalKey, item);
      }
      await offlineStorage.removeItem(fKey);
      this.retryCounts.delete(originalKey);
    }
    await this.updatePendingCount();
    return await this.drainQueue();
  }

  /**
   * Retries a single dead-letter failed item.
   */
  async retryFailedItem(failedKey: string): Promise<DrainResult> {
    const item = await offlineStorage.getItem(failedKey);
    const originalKey = failedKey.replace(/^offline_failed_/, '');
    if (item) {
      await offlineStorage.setItem(originalKey, item);
    }
    await offlineStorage.removeItem(failedKey);
    this.retryCounts.delete(originalKey);
    await this.updatePendingCount();
    return await this.drainQueue();
  }

  /**
   * Permanently discards all dead-letter failed items upon user confirmation.
   */
  async discardAllFailed(): Promise<void> {
    const allKeys = await offlineStorage.keys();
    const failedKeys = allKeys.filter((k) => k.startsWith('offline_failed_'));
    for (const fKey of failedKeys) {
      await offlineStorage.removeItem(fKey);
    }
    await this.updatePendingCount();
  }

  /**
   * Permanently discards a specific dead-letter failed item.
   */
  async discardFailedItem(failedKey: string): Promise<void> {
    await offlineStorage.removeItem(failedKey);
    await this.updatePendingCount();
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
