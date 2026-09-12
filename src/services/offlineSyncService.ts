import { offlineStorage } from './offlineStorage';
import { tripRepository, blackSpotRepository } from '../repositories';
import { useOfflineStore } from '../store/useOfflineStore';
import { Trip, BlackSpot } from '../types';
import { functionsService } from './functionsService';

export const MAX_RETRIES = 5;

export interface QueuedTrip extends Trip {
  retryCount: number;
}

export interface QueuedBlackSpot extends BlackSpot {
  retryCount: number;
}

export interface QueuedSosAlert {
  alertId: string;
  tripId?: string;
  userId?: string;
  vehicleRegNumber?: string;
  saccoId?: string;
  location?: { lat: number; lng: number };
  speedKmH?: number;
  message?: string;
  timestamp: string;
  type: 'sos';
  status: 'queued';
  retryCount?: number;
}

export interface DrainResult {
  syncedTrips: number;
  syncedReports: number;
  syncedSos?: number;
  failedTrips: number;
  failedReports: number;
  failedSos?: number;
  remainingCount: number;
}

export class OfflineSyncService {
  private isDraining = false;

  /**
   * Scans offlineStorage for queued trips, black spot reports, and emergency SOS alerts.
   */
  async getQueuedKeys(): Promise<{ tripKeys: string[]; reportKeys: string[]; sosKeys: string[] }> {
    try {
      const allKeys = await offlineStorage.keys();
      const tripKeys = allKeys.filter((k) => k.startsWith('offline_trip_'));
      const sosKeys = allKeys.filter(
        (k) => k.startsWith('offline_sos_') || k.startsWith('offline_report_sos_')
      );
      const reportKeys = allKeys.filter(
        (k) => k.startsWith('offline_report_') && !k.startsWith('offline_report_sos_')
      );
      return { tripKeys, reportKeys, sosKeys };
    } catch (err) {
      console.error('[OfflineSyncService] Failed to retrieve queued keys:', err);
      return { tripKeys: [], reportKeys: [], sosKeys: [] };
    }
  }

  /**
   * Scans offlineStorage for dead-letter failed items that exceeded MAX_RETRIES.
   */
  async getFailedKeys(): Promise<{
    failedTripKeys: string[];
    failedReportKeys: string[];
    failedSosKeys: string[];
  }> {
    try {
      const allKeys = await offlineStorage.keys();
      const failedKeys = allKeys.filter((k) => k.startsWith('offline_failed_'));
      const failedTripKeys = failedKeys.filter((k) => k.includes('trip'));
      const failedSosKeys = failedKeys.filter((k) => k.includes('sos'));
      const failedReportKeys = failedKeys.filter(
        (k) =>
          (k.includes('report') || k.includes('blackspot') || k.includes('bs_')) &&
          !k.includes('sos')
      );
      return { failedTripKeys, failedReportKeys, failedSosKeys };
    } catch (err) {
      console.error('[OfflineSyncService] Failed to retrieve failed keys:', err);
      return { failedTripKeys: [], failedReportKeys: [], failedSosKeys: [] };
    }
  }

  /**
   * Updates the Zustand offline store with the real pending queued count and failed count.
   */
  async updatePendingCount(): Promise<number> {
    const { tripKeys, reportKeys, sosKeys } = await this.getQueuedKeys();
    const { failedTripKeys, failedReportKeys, failedSosKeys } = await this.getFailedKeys();
    const totalCount = tripKeys.length + reportKeys.length + sosKeys.length;
    const totalFailed = failedTripKeys.length + failedReportKeys.length + failedSosKeys.length;

    useOfflineStore.getState().setQueuedActionsCount(totalCount);
    useOfflineStore.getState().setFailedActionsCount(totalFailed);
    return totalCount;
  }

  /**
   * Drains all offline-queued trips and reports, uploading them to Firestore.
   * On success, removes the item from offline storage and decrements the pending count.
   * On failure, increments retry count on the persisted item itself; if retries >= MAX_RETRIES,
   * moves to dead-letter storage (offline_failed_*).
   * Because retryCount is stored on the item record, retry durability survives app restarts.
   */
  async drainQueue(): Promise<DrainResult> {
    if (this.isDraining) {
      const { tripKeys, reportKeys, sosKeys } = await this.getQueuedKeys();
      return {
        syncedTrips: 0,
        syncedReports: 0,
        syncedSos: 0,
        failedTrips: 0,
        failedReports: 0,
        failedSos: 0,
        remainingCount: tripKeys.length + reportKeys.length + sosKeys.length,
      };
    }

    this.isDraining = true;
    let syncedTrips = 0;
    let syncedReports = 0;
    let syncedSos = 0;
    let failedTrips = 0;
    let failedReports = 0;
    let failedSos = 0;

    try {
      const { tripKeys, reportKeys, sosKeys } = await this.getQueuedKeys();
      await this.updatePendingCount();

      // 1. Process queued trips
      for (const key of tripKeys) {
        let currentTrip: QueuedTrip | null = null;
        try {
          currentTrip = await offlineStorage.getItem<QueuedTrip>(key);
          if (!currentTrip || !currentTrip.id) {
            // Corrupt or empty item - clean up
            await offlineStorage.removeItem(key);
            continue;
          }

          // Strip retryCount so queue telemetry does not pollute Firestore document data
          const { retryCount: _retryCount, ...tripToSave } = currentTrip;
          // Use the SAME client-generated ID already embedded in the stored object
          await tripRepository.save(tripToSave as Trip);
          await offlineStorage.removeItem(key);
          syncedTrips++;
        } catch (err) {
          console.warn(`[OfflineSyncService] Failed to sync offline trip ${key}:`, err);
          failedTrips++;
          const currentRetries = currentTrip?.retryCount ?? 0;
          const retries = currentRetries + 1;
          if (retries >= MAX_RETRIES) {
            if (currentTrip) {
              await offlineStorage.setItem(`offline_failed_${key}`, {
                ...currentTrip,
                retryCount: retries,
              });
            }
            await offlineStorage.removeItem(key);
          } else {
            if (currentTrip) {
              await offlineStorage.setItem(key, {
                ...currentTrip,
                retryCount: retries,
              });
            }
          }
        }
      }

      // 2. Process queued black spot reports
      for (const key of reportKeys) {
        let currentReport: QueuedBlackSpot | null = null;
        try {
          currentReport = await offlineStorage.getItem<QueuedBlackSpot>(key);
          const reportId = currentReport?.id || (currentReport as { alertId?: string } | null)?.alertId;
          if (!currentReport || !reportId) {
            // Corrupt or empty item - clean up
            await offlineStorage.removeItem(key);
            continue;
          }

          // Strip retryCount so queue telemetry does not pollute Firestore document data
          const { retryCount: _retryCount, ...reportToSave } = currentReport;
          // Use the SAME client-generated ID already embedded in the stored object
          await blackSpotRepository.save(reportToSave as BlackSpot);
          await offlineStorage.removeItem(key);
          syncedReports++;
        } catch (err) {
          console.warn(`[OfflineSyncService] Failed to sync offline report ${key}:`, err);
          failedReports++;
          const currentRetries = currentReport?.retryCount ?? 0;
          const retries = currentRetries + 1;
          if (retries >= MAX_RETRIES) {
            if (currentReport) {
              await offlineStorage.setItem(`offline_failed_${key}`, {
                ...currentReport,
                retryCount: retries,
              });
            }
            await offlineStorage.removeItem(key);
          } else {
            if (currentReport) {
              await offlineStorage.setItem(key, {
                ...currentReport,
                retryCount: retries,
              });
            }
          }
        }
      }

      // 3. Process queued emergency SOS alerts via functionsService.sendSOS
      for (const key of sosKeys) {
        let currentSos: (QueuedSosAlert & { retryCount?: number }) | null = null;
        try {
          currentSos = await offlineStorage.getItem<QueuedSosAlert>(key);
          if (!currentSos || !currentSos.alertId) {
            await offlineStorage.removeItem(key);
            continue;
          }

          const res = await functionsService.sendSOS({
            alertId: currentSos.alertId,
            tripId: currentSos.tripId,
            userId: currentSos.userId,
            vehicleRegNumber: currentSos.vehicleRegNumber,
            saccoId: currentSos.saccoId,
            location: currentSos.location,
            speedKmH: currentSos.speedKmH,
            message: currentSos.message || 'EMERGENCY SOS: Auto-synced offline alert from passenger',
          });

          if (res && res.success) {
            await offlineStorage.removeItem(key);
            syncedSos++;
          } else {
            throw new Error('sendSOS returned unsuccessful response');
          }
        } catch (err) {
          console.warn(`[OfflineSyncService] Failed to sync offline SOS alert ${key}:`, err);
          failedSos++;
          const currentRetries = currentSos?.retryCount ?? 0;
          const retries = currentRetries + 1;
          if (retries >= MAX_RETRIES) {
            if (currentSos) {
              await offlineStorage.setItem(`offline_failed_${key}`, {
                ...currentSos,
                retryCount: retries,
              });
            }
            await offlineStorage.removeItem(key);
          } else {
            if (currentSos) {
              await offlineStorage.setItem(key, {
                ...currentSos,
                retryCount: retries,
              });
            }
          }
        }
      }

      const remaining = await this.updatePendingCount();
      if (syncedTrips > 0 || syncedReports > 0 || syncedSos > 0) {
        useOfflineStore.getState().setLastSyncedAt(new Date().toISOString());
      }

      return {
        syncedTrips,
        syncedReports,
        syncedSos,
        failedTrips,
        failedReports,
        failedSos,
        remainingCount: remaining,
      };
    } finally {
      this.isDraining = false;
    }
  }

  /**
   * Retries all dead-letter failed items by restoring them to the active queue with reset retryCount.
   */
  async retryAllFailed(): Promise<DrainResult> {
    const allKeys = await offlineStorage.keys();
    const failedKeys = allKeys.filter((k) => k.startsWith('offline_failed_'));
    for (const fKey of failedKeys) {
      const item = await offlineStorage.getItem<Record<string, unknown>>(fKey);
      const originalKey = fKey.replace(/^offline_failed_/, '');
      if (item) {
        await offlineStorage.setItem(originalKey, {
          ...item,
          retryCount: 0,
        });
      }
      await offlineStorage.removeItem(fKey);
    }
    await this.updatePendingCount();
    return await this.drainQueue();
  }

  /**
   * Retries a single dead-letter failed item with reset retryCount.
   */
  async retryFailedItem(failedKey: string): Promise<DrainResult> {
    const item = await offlineStorage.getItem<Record<string, unknown>>(failedKey);
    const originalKey = failedKey.replace(/^offline_failed_/, '');
    if (item) {
      await offlineStorage.setItem(originalKey, {
        ...item,
        retryCount: 0,
      });
    }
    await offlineStorage.removeItem(failedKey);
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
