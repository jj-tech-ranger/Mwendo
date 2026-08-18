import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/useAuthStore';
import { getSaccoName, getEffectiveSaccoId } from '../../lib/saccoUtils';

export const SaccoNotificationsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const saccoId = getEffectiveSaccoId(user?.saccoId);

  const [notifications, setNotifications] = useState<any[]>([]);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (!saccoId) {
    return (
      <EmptyState
        icon="error"
        title="Account Not Fully Provisioned"
        description="Your account is missing a SACCO assignment. Contact your administrator."
      />
    );
  }

  const saccoName = getSaccoName(saccoId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="text-lg font-black text-on-surface">Notifications Center — {saccoName}</h1>
          <p className="text-xs text-on-surface-variant">Real-time alerts, safety notifications, and NTSA system communications</p>
        </div>

        <button onClick={handleMarkAllRead} className="text-xs font-bold text-primary hover:underline">
          Mark All As Read
        </button>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <EmptyState
            icon="notifications"
            title="No Notifications"
            description="You don't have any notifications yet."
          />
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              className={`p-4 flex items-start gap-4 transition-all border-l-4 ${
                !n.read ? 'bg-primary/5 border-l-primary' : 'border-l-outline-variant/30'
              }`}
            >
              <span className="material-symbols-outlined text-xl text-primary mt-0.5">
                {n.type === 'violation' ? 'speed' : n.type === 'blackspot' ? 'warning' : 'notifications'}
              </span>

              <div className="space-y-1 flex-1">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xs text-on-surface">{n.title}</h3>
                  <span className="text-[10px] font-mono text-on-surface-variant">{n.time}</span>
                </div>
                <p className="text-xs text-on-surface-variant">{n.desc}</p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
