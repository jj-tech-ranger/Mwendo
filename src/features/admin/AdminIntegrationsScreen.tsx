import React, { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const AdminIntegrationsScreen: React.FC = () => {
  const [activeConfigModal, setActiveConfigModal] = useState<string | null>(null);

  const integrations = [
    {
      id: 'core_db',
      name: 'Primary Database Connector',
      description: 'Real-time synchronization store for users, trips, SACCOs, and blackspot reports.',
      status: 'Connected',
      type: 'Database',
      icon: 'database',
    },
    {
      id: 'fcm',
      name: 'Push Notification Dispatcher',
      description: 'Cross-platform mobile notification pipeline for emergency alerts and broadcast updates.',
      status: 'Connected',
      type: 'Messaging',
      icon: 'notifications_active',
    },
    {
      id: 'storage',
      name: 'Secure Document & Evidence Vault',
      description: 'Encrypted storage for inspection certificates and blackspot evidence imagery.',
      status: 'Connected',
      type: 'Storage',
      icon: 'cloud',
    },
    {
      id: 'analytics_engine',
      name: 'Safety Analytics & Aggregation Engine',
      description: 'Aggregates long-term speed metrics and hazard clustering data.',
      status: 'Connected',
      type: 'Analytics',
      icon: 'analytics',
    },
    {
      id: 'audit_monitor',
      name: 'Audit & Activity Monitor',
      description: 'Real-time diagnostic auditing, logging, and operational tracking.',
      status: 'Connected',
      type: 'Monitoring',
      icon: 'bug_report',
    },
    {
      id: 'sms_gateway',
      name: 'National SMS Dispatch Gateway',
      description: 'Direct SMS channel for non-smartphone emergency SOS dispatch and driver alerts.',
      status: 'Connected',
      type: 'Telephony',
      icon: 'sms',
    },
  ];

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            External Integrations & System Services
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Connectors and status monitors for national transport safety infrastructure.
          </p>
        </div>

        <Badge variant="info">6 Connectors Configured</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
        {integrations.map((item) => (
          <div
            key={item.id}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg shadow-sm space-y-md flex flex-col justify-between"
          >
            <div className="space-y-sm">
              <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-3xl text-primary">{item.icon}</span>
                <Badge variant="success">{item.status}</Badge>
              </div>
              <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">{item.name}</h3>
              <p className="font-body-sm text-xs text-on-surface-variant">{item.description}</p>
            </div>

            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={() => setActiveConfigModal(item.name)}
            >
              Configure Settings
            </Button>
          </div>
        ))}
      </div>

      {activeConfigModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg max-w-md w-full space-y-md shadow-2xl text-xs">
            <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">
              Configure {activeConfigModal}
            </h3>
            <p className="text-on-surface-variant">
              API credentials and secrets are managed via platform environment settings.
            </p>
            <div className="flex justify-end pt-2 border-t border-outline-variant/20">
              <Button variant="primary" onClick={() => setActiveConfigModal(null)}>
                Close Window
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
