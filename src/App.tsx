import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AppRoutes } from './routes';
import { authService } from './services/authService';
import { MaintenanceGate } from './components/MaintenanceGate';
import { ToastProvider } from './components/ui/Toast';
import './services/i18n';

export function App() {
  useEffect(() => {
    const unsubscribe = authService.initAuthListener();
    return () => unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MaintenanceGate>
          <AppRoutes />
        </MaintenanceGate>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
