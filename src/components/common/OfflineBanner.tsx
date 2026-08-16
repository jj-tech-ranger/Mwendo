import React, { useEffect } from 'react';
import { useOfflineStore } from '../../store/useOfflineStore';
import { offlineSyncService } from '../../services/offlineSyncService';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const setIsOnline = useOfflineStore((s) => s.setIsOnline);
  const queuedActionsCount = useOfflineStore((s) => s.queuedActionsCount);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      offlineSyncService.drainQueue().catch((err) =>
        console.warn('Drain queue error on reconnect:', err)
      );
    };
    const handleOffline = () => {
      setIsOnline(false);
      offlineSyncService.updatePendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Synchronize pending count on mount
    offlineSyncService.updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setIsOnline]);

  if (isOnline) return null;

  return (
    <div className="bg-error-container text-on-error-container px-md py-2 text-xs font-label-bold flex items-center justify-between z-50 sticky top-0 shadow-sm border-b border-error/20 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-error animate-ping" />
        <span>You are currently offline. Trip tracking telemetry will be saved locally.</span>
      </div>
      {queuedActionsCount > 0 && (
        <span className="font-label-mono bg-error text-on-error px-2 py-0.5 rounded-full text-[10px]">
          {queuedActionsCount} Queued
        </span>
      )}
    </div>
  );
};
