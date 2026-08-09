import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore } from '../../store/useAuthStore';

export const SaccoNotificationsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const saccoId = user?.saccoId || 'sacco_metrolink';
  const saccoName = saccoId === 'sacco_greenline' ? 'GreenLine SACCO' : 'MetroLink SACCO';

  const [notifications, setNotifications] = useState([
    {
      id: 'n1',
      title: 'Overspeeding Alert Triggered',
      desc: saccoId === 'sacco_greenline' ? 'Vehicle KDC 202G recorded 89 km/h on Mombasa Road.' : 'Vehicle KCB 450Z recorded 94 km/h on Thika Road.',
      time: '10 mins ago',
      type: 'violation',
      read: false,
    },
    {
      id: 'n2',
      title: 'Black Spot Hazard Submitted',
      desc: 'New commuter hazard report for Unmarked Speed Bump on Thika Road.',
      time: '1 hour ago',
      type: 'blackspot',
      read: false,
    },
    {
      id: 'n3',
      title: 'NTSA Compliance Renewal Notice',
      desc: 'Inspection certificates for 3 vehicles expire within 30 days.',
      time: '1 day ago',
      type: 'system',
      read: true,
    },
  ]);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

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
        {notifications.map((n) => (
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
        ))}
      </div>
    </div>
  );
};
