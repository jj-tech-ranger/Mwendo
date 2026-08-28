import { GPSSample } from '../lib/engine';
import { offlineStorage } from './offlineStorage';

const KEY_PREFIX = 'active_trip_telemetry_';
const MAX_SAMPLES = 7200;

const keyForTrip = (tripId: string) => `${KEY_PREFIX}${tripId}`;

export const telemetryPersistenceService = {
  async appendSample(tripId: string, sample: GPSSample): Promise<void> {
    const key = keyForTrip(tripId);
    const existing = (await offlineStorage.getItem<GPSSample[]>(key)) ?? [];
    const next = [...existing, sample];
    await offlineStorage.setItem(key, next.slice(-MAX_SAMPLES));
  },

  async getSamples(tripId: string): Promise<GPSSample[]> {
    return (await offlineStorage.getItem<GPSSample[]>(keyForTrip(tripId))) ?? [];
  },

  async clear(tripId: string): Promise<void> {
    await offlineStorage.removeItem(keyForTrip(tripId));
  },
};
