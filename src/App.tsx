import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AppRoutes } from './routes';
import { authService } from './services/authService';
import { offlineSyncService } from './services/offlineSyncService';
import { MaintenanceGate } from './components/MaintenanceGate';
import { DpaConsentBanner } from './components/common/DpaConsentBanner';
import { ToastProvider } from './components/ui/Toast';
import { usePwaStore } from './store/usePwaStore';
import { UpdateAvailableScreen } from './features/common/UpdateAvailableScreen';
import { FirebaseConfigGuard } from './components/common/FirebaseConfigGuard';
import { firebaseConfigStatus } from './lib/firebase';
import './services/i18n';

export function App() {
  const isUpdateAvailable = usePwaStore((s) => s.isUpdateAvailable);

  useEffect(() => {
    if (!firebaseConfigStatus.isValid) return;

    const unsubscribeAuth = authService.initAuthListener();
    const unsubscribeSync = offlineSyncService.init();

    return () => {
      unsubscribeAuth();
      unsubscribeSync();
    };
  }, []);

  return (
    <FirebaseConfigGuard>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MaintenanceGate>
            <AppRoutes />
            <DpaConsentBanner />
            {isUpdateAvailable && <UpdateAvailableScreen />}
          </MaintenanceGate>
        </ToastProvider>
      </QueryClientProvider>
    </FirebaseConfigGuard>
  );
}

export default App;
