import React, { useEffect, useState } from 'react';
import { useOfflineStore } from '../../store/useOfflineStore';
import { offlineSyncService } from '../../services/offlineSyncService';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const setIsOnline = useOfflineStore((s) => s.setIsOnline);
  const queuedActionsCount = useOfflineStore((s) => s.queuedActionsCount);
  const failedActionsCount = useOfflineStore((s) => s.failedActionsCount);
  const [isRetrying, setIsRetrying] = useState(false);

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

  const handleRetryAll = async () => {
    setIsRetrying(true);
    try {
      await offlineSyncService.retryAllFailed();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDiscardAll = async () => {
    await offlineSyncService.discardAllFailed();
  };

  // If online and no failed items, no banner is needed
  if (isOnline && failedActionsCount === 0) return null;

  return (
    <div className="flex flex-col z-50 sticky top-0 shadow-sm border-b animate-in slide-in-from-top duration-300">
      {/* Offline Status Bar */}
      {!isOnline && (
        <div className="bg-error-container text-on-error-container px-md py-2 text-xs font-label-bold flex items-center justify-between border-b border-error/20">
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
      )}

      {/* Dead-letter Failed Actions Alert */}
      {failedActionsCount > 0 && (
        <div className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 px-md py-1.5 text-xs font-medium flex items-center justify-between border-b border-amber-300 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 text-sm">warning</span>
            <span>
              {failedActionsCount} offline item{failedActionsCount > 1 ? 's' : ''} failed to sync after multiple attempts.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetryAll}
              disabled={isRetrying}
              className="px-2 py-0.5 bg-amber-600 text-white rounded text-[11px] font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
            <button
              onClick={handleDiscardAll}
              className="px-2 py-0.5 bg-transparent text-amber-800 dark:text-amber-300 border border-amber-400 dark:border-amber-700 rounded text-[11px] hover:bg-amber-200/50 transition-colors cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
