import localforage from 'localforage';

// Configure localforage instance for telemetry and offline trip queueing
localforage.config({
  name: 'MwendoSalamaDB',
  storeName: 'telemetry_and_trips',
  description: 'Offline storage for Mwendo Salama GPS telemetry, speed logs, and queued safety reports',
});

export const offlineStorage = {
  async getItem<T>(key: string): Promise<T | null> {
    try {
      return await localforage.getItem<T>(key);
    } catch (err) {
      console.error(`Error reading key ${key} from localforage:`, err);
      return null;
    }
  },

  async setItem<T>(key: string, value: T): Promise<T | null> {
    try {
      return await localforage.setItem<T>(key, value);
    } catch (err) {
      console.error(`Error setting key ${key} in localforage:`, err);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await localforage.removeItem(key);
    } catch (err) {
      console.error(`Error removing key ${key} from localforage:`, err);
    }
  },

  async keys(): Promise<string[]> {
    try {
      return await localforage.keys();
    } catch (err) {
      console.error('Error getting keys from localforage:', err);
      return [];
    }
  },

  async clear(): Promise<void> {
    try {
      await localforage.clear();
    } catch (err) {
      console.error('Error clearing localforage:', err);
    }
  },
};
