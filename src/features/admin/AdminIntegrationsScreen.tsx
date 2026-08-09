import React, { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const AdminIntegrationsScreen: React.FC = () => {
  const [activeConfigModal, setActiveConfigModal] = useState<string | null>(null);

  const integrations = [
    {
      id: 'firebase_db',
      name: 'Firebase Firestore Database',
      description: 'Primary real-time document store for users, trips, SACCOs, and blackspot reports.',
      status: 'Connected',
      type: 'Database',
      icon: 'database',
    },
    {
      id: 'fcm',
      name: 'Firebase Cloud Messaging (FCM)',
      description: 'Cross-platform mobile push notification pipeline for emergency alerts.',
      status: 'Connected',
      type: 'Messaging',
      icon: 'notifications_active',
    },
    {
      id: 'storage',
      name: 'Cloud Storage Bucket',
      description: 'Persistent file store for inspection certificates and blackspot evidence photos.',
      status: 'Connected',
      type: 'Storage',
      icon: 'cloud',
    },
    {
      id: 'bigquery',
      name: 'Google BigQuery Warehouse',
      description: 'Long-term raw GPS telemetry sink for machine learning hazard detection.',
      status: 'Configured',
      type: 'Analytics',
      icon: 'analytics',
    },
    {
      id: 'sentry',
      name: 'Sentry Performance & Error Tracker',
      description: 'Real-time crash reporting and JavaScript stack trace aggregation.',
      status: 'Connected',
      type: 'Monitoring',
      icon: 'bug_report',
    },
    {
      id: 'twilio',
      name: 'Twilio SMS Gateway',
      description: 'Fallback SMS channel for non-smartphone emergency SOS dispatch.',
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
            External Integrations & API Services
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Connectors and status monitors for GCP, Firebase, Sentry, and Twilio.
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
