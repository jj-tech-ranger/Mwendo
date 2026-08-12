import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { MaintenanceModeScreen } from '../features/common/MaintenanceModeScreen';

interface MaintenanceConfig {
  active: boolean;
  message?: string;
}

export const MaintenanceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [maintenance, setMaintenance] = useState<MaintenanceConfig | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'system_config', 'maintenance'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setMaintenance({
            active: !!data.active,
            message: data.message || '',
          });
        } else {
          setMaintenance({ active: false });
        }
      },
      (error) => {
        console.warn('[MaintenanceGate] Error reading maintenance status:', error);
        setMaintenance({ active: false });
      }
    );

    return () => unsub();
  }, []);

  const isAdmin = user?.role === 'admin';

  if (maintenance?.active && !isAdmin) {
    return <MaintenanceModeScreen message={maintenance.message} />;
  }

  return <>{children}</>;
};
