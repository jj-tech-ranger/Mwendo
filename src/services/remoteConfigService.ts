import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { remoteConfig } from '../lib/firebase';

export interface RemoteFeatureFlags {
  enableSOS: boolean;
  enableGuestMode: boolean;
  maintenance_mode: boolean;
  overspeedLimitDisplayed: number;
}

const DEFAULT_FLAGS: RemoteFeatureFlags = {
  enableSOS: true,
  enableGuestMode: true,
  maintenance_mode: false,
  overspeedLimitDisplayed: 80, // Default Matatu speed limit 80 km/h in Kenya
};

export const remoteConfigService = {
  /**
   * Fetch and activate remote configuration parameters
   */
  async initConfig(): Promise<RemoteFeatureFlags> {
    try {
      remoteConfig.settings = {
        minimumFetchIntervalMillis: 3600000, // 1 hour
        fetchTimeoutMillis: 10000,
      };
      remoteConfig.defaultConfig = DEFAULT_FLAGS as unknown as Record<string, string | number | boolean>;

      await fetchAndActivate(remoteConfig);

      return {
        enableSOS: getValue(remoteConfig, 'enableSOS').asBoolean(),
        enableGuestMode: getValue(remoteConfig, 'enableGuestMode').asBoolean(),
        maintenance_mode: getValue(remoteConfig, 'maintenance_mode').asBoolean(),
        overspeedLimitDisplayed: getValue(remoteConfig, 'overspeedLimitDisplayed').asNumber() || 80,
      };
    } catch (err) {
      console.warn('[RemoteConfig] Fetch failed, falling back to default flags:', err);
      return DEFAULT_FLAGS;
    }
  },

  getFlag<K extends keyof RemoteFeatureFlags>(key: K): RemoteFeatureFlags[K] {
    try {
      const val = getValue(remoteConfig, key as string);
      if (typeof DEFAULT_FLAGS[key] === 'boolean') {
        return val.asBoolean() as RemoteFeatureFlags[K];
      }
      if (typeof DEFAULT_FLAGS[key] === 'number') {
        return (val.asNumber() || DEFAULT_FLAGS[key]) as RemoteFeatureFlags[K];
      }
      return (val.asString() || DEFAULT_FLAGS[key]) as RemoteFeatureFlags[K];
    } catch {
      return DEFAULT_FLAGS[key];
    }
  },
};
