import { GPSSample } from '../lib/engine';
import { ACTIVE_TRIP_STORAGE_KEY } from '../store/useTripStore';
import { offlineStorage } from './offlineStorage';

const KEY_PREFIX = 'active_trip_telemetry_';
const MAX_SAMPLES = 7200;

const keyForTrip = (tripId: string) => `${KEY_PREFIX}${tripId}`;

let writeQueue: Promise<void> = Promise.resolve();

export const telemetryPersistenceService = {
  appendSample(tripId: string, sample: GPSSample): Promise<void> {
    writeQueue = writeQueue.then(async () => {
      const key = keyForTrip(tripId);
      const existing = (await offlineStorage.getItem<GPSSample[]>(key)) ?? [];
      const next = [...existing, sample].slice(-MAX_SAMPLES);
      await offlineStorage.setItem(key, next);
    });

    return writeQueue;
  },

  async getSamples(tripId: string): Promise<GPSSample[]> {
    await writeQueue;
    return (await offlineStorage.getItem<GPSSample[]>(keyForTrip(tripId))) ?? [];
  },

  async clear(tripId: string): Promise<void> {
    writeQueue = writeQueue.then(async () => {
      await offlineStorage.removeItem(keyForTrip(tripId));

      // The completed-trip save is performed before this method is called.
      // Clearing both recovery records together prevents a finished trip from
      // being resurrected after a reload while preserving crash recovery until
      // the trip is safely queued.
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
        } catch {
          // Ignore localStorage failures; the completed trip is already saved.
        }
      }
    });

    await writeQueue;
  },
};
