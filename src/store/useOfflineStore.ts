import { create } from 'zustand';

interface OfflineState {
  isOnline: boolean;
  queuedActionsCount: number;
  lastSyncedAt: string | null;
  setIsOnline: (online: boolean) => void;
  setQueuedActionsCount: (count: number) => void;
  setLastSyncedAt: (timestamp: string) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  queuedActionsCount: 0,
  lastSyncedAt: new Date().toISOString(),
  setIsOnline: (isOnline) => set({ isOnline }),
  setQueuedActionsCount: (queuedActionsCount) => set({ queuedActionsCount }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
}));
