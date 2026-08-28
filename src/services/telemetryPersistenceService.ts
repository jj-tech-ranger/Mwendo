import { GPSSample } from '../lib/engine';
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
    writeQueue = writeQueue.then(() => offlineStorage.removeItem(keyForTrip(tripId)));
    await writeQueue;
  },
};
