import React, { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { auditLogRepository } from '../../repositories';
import { useAuthStore } from '../../store/useAuthStore';

export const AdminNotificationsScreen: React.FC = () => {
  const { user: currentAdmin } = useAuthStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const pastBroadcasts = [
    {
      id: 'bc-101',
      title: 'Heavy Rainfall Warning on A104 Waiyaki Way Corridor',
      audience: 'All Commuters (Nairobi County)',
      recipients: 18400,
      sentAt: '2026-08-07T16:00:00Z',
    },
    {
      id: 'bc-102',
      title: 'NTSA Speed Governor Calibration Notice',
      audience: 'SACCO Officials & Managers',
      recipients: 1420,
      sentAt: '2026-08-01T09:00:00Z',
    },
  ];

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !body) return;
    setIsSubmitting(true);

    try {
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: 'FCM_BROADCAST',
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: 'SEND_PUSH_BROADCAST',
        target: `Title: "${title}" (Audience: ${audience})`,
        timestamp: new Date().toISOString(),
      });

      setToastMsg(`Push notification broadcast dispatched to target audience (${audience}).`);
      setTitle('');
      setBody('');
    } catch (err) {
      console.error('Failed to send broadcast:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Platform Push Notification & Alert Dispatcher
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Compose and dispatch platform-wide push broadcasts or targeted role/county alerts.
          </p>
        </div>

        <Badge variant="info">FCM Messaging Active</Badge>
      </div>

      {toastMsg && (
        <div className="p-md rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-body-sm text-xs flex items-center justify-between">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-outline">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Compose Form */}
        <form
          onSubmit={handleSendBroadcast}
          className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg space-y-md shadow-sm"
        >
          <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-sm">
            <span className="material-symbols-outlined text-primary text-xl">campaign</span>
            Compose Broadcast Message
          </h3>

          <div className="space-y-md text-xs font-body-sm">
            <div>
              <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                Target Audience Scope
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-label-mono mt-1"
              >
                <option value="all">All Commuters & Staff (52k+ Users)</option>
                <option value="passengers">Passengers Only</option>
                <option value="sacco_officials">SACCO Officials & Managers</option>
                <option value="authorities">NTSA & County Inspectors</option>
              </select>
            </div>

            <div>
              <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                Notification Headline Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Flash Flooding Alert on Thika Superhighway"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface mt-1"
              />
            </div>

            <div>
              <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                Message Body
              </label>
              <textarea
                required
                rows={3}
                placeholder="Enter alert text..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface mt-1"
              />
            </div>

            <Button type="submit" variant="primary" className="w-full justify-center" disabled={isSubmitting}>
              {isSubmitting ? 'Dispatching Broadcast...' : 'Dispatch FCM Broadcast'}
            </Button>
          </div>
        </form>

        {/* History */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg space-y-md shadow-sm">
          <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface border-b border-outline-variant/20 pb-sm">
            Past Push Broadcasts
          </h3>

          <div className="space-y-sm text-xs font-body-sm">
            {pastBroadcasts.map((b) => (
              <div key={b.id} className="p-md rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface">{b.title}</span>
                  <span className="font-label-mono text-[10px] text-outline">
                    {new Date(b.sentAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between font-label-mono text-[10px] text-outline">
                  <span>Scope: {b.audience}</span>
                  <span className="text-primary font-bold">{b.recipients.toLocaleString()} Delivered</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
