import React, { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { auditLogRepository } from '../../repositories';
import { useAuthStore } from '../../store/useAuthStore';

export const AdminSecurityScreen: React.FC = () => {
  const { user: currentAdmin } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'security' | 'backup'>('security');

  // Restore Backup Confirmation State
  const [selectedBackupToRestore, setSelectedBackupToRestore] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  async function handleConfirmRestore() {
    if (!selectedBackupToRestore) return;
    setIsSubmitting(true);

    try {
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: 'RESTORE_BACKUP',
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: `TRIGGER_FIRESTORE_RESTORE (${selectedBackupToRestore})`,
        target: `Database Snapshot: ${selectedBackupToRestore}`,
        timestamp: new Date().toISOString(),
      });

      setToastMsg(`Database restore process triggered for snapshot ${selectedBackupToRestore}. Audit log created.`);
      setSelectedBackupToRestore(null);
    } catch (err) {
      console.error('Failed to trigger restore:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Platform Security, Backup & Recovery Management
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            MFA policies, session timeouts, and automated Firestore point-in-time recovery.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-surface-container border border-outline-variant/30 rounded-xl p-1 font-label-mono text-xs">
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'security'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Security Policies
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'backup'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Backup & Recovery
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="p-md rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-body-sm text-xs flex items-center justify-between">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-outline">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Tab 1: Security Settings */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg space-y-md shadow-sm">
            <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface border-b border-outline-variant/20 pb-sm">
              MFA & Authentication Policies
            </h3>

            <div className="space-y-md text-xs font-body-sm">
              <div className="flex items-center justify-between p-md rounded-xl bg-surface-container-low">
                <div>
                  <p className="font-bold text-on-surface">Mandatory MFA for System Admins</p>
                  <p className="text-[11px] text-on-surface-variant">Requires TOTP or SMS verification for /admin access.</p>
                </div>
                <Badge variant="success">Enforced</Badge>
              </div>

              <div className="flex items-center justify-between p-md rounded-xl bg-surface-container-low">
                <div>
                  <p className="font-bold text-on-surface">Admin Session Idle Timeout</p>
                  <p className="text-[11px] text-on-surface-variant">Auto-logout after 30 minutes of inactivity.</p>
                </div>
                <span className="font-label-mono text-xs font-bold text-primary">30 Minutes</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg space-y-md shadow-sm">
            <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface border-b border-outline-variant/20 pb-sm">
              API Security & IP Allowlist
            </h3>

            <div className="space-y-md text-xs font-body-sm">
              <div className="p-md rounded-xl bg-surface-container-low space-y-1">
                <span className="font-label-mono text-[10px] text-outline font-bold uppercase">IP Range Restriction</span>
                <p className="font-label-mono text-xs text-on-surface">102.215.18.0/24 (NTSA HQ Gateway)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Backup & Recovery (Dark Ops Console) */}
      {activeTab === 'backup' && (
        <div className="bg-[#0A0F1D] text-slate-100 p-lg sm:p-xl rounded-2xl border border-slate-800 space-y-lg font-label-mono shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-md">
            <div>
              <h3 className="text-base font-bold text-emerald-400 uppercase tracking-widest">
                Firestore Point-in-Time Backup & Disaster Recovery
              </h3>
              <p className="text-xs text-slate-400 mt-1">SLO: RPO &lt; 15 mins • RTO &lt; 1 hour</p>
            </div>
            <Badge variant="success">Daily Snapshots Active</Badge>
          </div>

          {/* Backup History Table */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs font-label-mono">
              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-md">Snapshot ID</th>
                  <th className="p-md">Created Timestamp</th>
                  <th className="p-md">Snapshot Size</th>
                  <th className="p-md text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="p-md font-bold text-emerald-400">snap-2026-08-08-0000</td>
                  <td className="p-md text-slate-300">2026-08-08 00:00:00 UTC</td>
                  <td className="p-md text-slate-300">1.42 GB</td>
                  <td className="p-md text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-700/50 text-amber-400 hover:bg-amber-950/50"
                      onClick={() => setSelectedBackupToRestore('snap-2026-08-08-0000')}
                    >
                      Restore Snapshot
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td className="p-md font-bold text-emerald-400">snap-2026-08-07-0000</td>
                  <td className="p-md text-slate-300">2026-08-07 00:00:00 UTC</td>
                  <td className="p-md text-slate-300">1.38 GB</td>
                  <td className="p-md text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-700/50 text-amber-400 hover:bg-amber-950/50"
                      onClick={() => setSelectedBackupToRestore('snap-2026-08-07-0000')}
                    >
                      Restore Snapshot
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {selectedBackupToRestore && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-md">
          <div className="bg-[#121212] border border-amber-500/40 rounded-2xl p-lg max-w-md w-full space-y-md shadow-2xl text-xs font-label-mono">
            <div className="flex items-center gap-2 text-amber-500">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h3 className="text-base font-bold text-white">Confirm Database Restore</h3>
            </div>

            <p className="text-slate-300">
              Restoring snapshot <strong className="text-amber-400">{selectedBackupToRestore}</strong> will overwrite current live Firestore collections. This action is irreversible and requires explicit admin authorization.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="outline" onClick={() => setSelectedBackupToRestore(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-amber-600 hover:bg-amber-700 text-white border-none"
                onClick={handleConfirmRestore}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Triggering Restore...' : 'Confirm & Audit Log'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
