import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { auditLogRepository } from '../../repositories';
import { AuditLog } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

export const AuthoritySettingsScreen: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || 'Inspector Omondi');
  const [badgeNumber, setBadgeNumber] = useState(user?.badgeNumber || 'NTSA-882');
  const [authorityScope, setAuthorityScope] = useState<'national' | 'county'>(user?.authorityScope || 'national');
  const [county, setCounty] = useState(user?.county || 'Nairobi');
  const [station, setStation] = useState('NTSA Headquarters - Upper Hill');

  // Notifications
  const [sosNotifications, setSosNotifications] = useState(true);
  const [speedNotifications, setSpeedNotifications] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(true);

  // Audit logs
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [isErrorLogs, setIsErrorLogs] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    setIsErrorLogs(false);
    setErrorMessage(null);
    try {
      const fetchedLogs = await auditLogRepository.getAll();
      setLogs(fetchedLogs);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setIsErrorLogs(true);
      setErrorMessage(err?.message || 'Failed to retrieve inspector audit trail.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      setUser({
        ...user,
        displayName,
        badgeNumber,
        authorityScope,
        county,
      });
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface">
            Inspector Profile & Authority Settings
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Official NTSA Inspector credentials, jurisdiction scope claims, and security audit logs
          </p>
        </div>

        <Badge variant={authorityScope === 'national' ? 'info' : 'warning'}>
          {authorityScope === 'national' ? 'National Scope' : `County: ${county}`}
        </Badge>
      </div>

      {savedSuccess && (
        <div className="p-md rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-label-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span>Inspector Profile & Jurisdiction Scope updated successfully!</span>
          </div>
          <button onClick={() => setSavedSuccess(false)}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Inspector Credentials Form */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm space-y-md"
        >
          <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-sm">
            <span className="material-symbols-outlined text-primary text-xl">shield_person</span>
            <h3 className="font-headline-lg-mobile text-sm text-on-surface">
              Inspector Credentials & Station
            </h3>
          </div>

          <div className="space-y-sm text-xs font-body-sm">
            <div>
              <label className="font-label-bold text-on-surface">Full Name & Rank</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div>
                <label className="font-label-bold text-on-surface">Inspector Badge ID</label>
                <input
                  type="text"
                  value={badgeNumber}
                  onChange={(e) => setBadgeNumber(e.target.value)}
                  required
                  className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface font-label-mono focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                />
              </div>

              <div>
                <label className="font-label-bold text-on-surface">Assigned Station / Depot</label>
                <input
                  type="text"
                  value={station}
                  onChange={(e) => setStation(e.target.value)}
                  required
                  className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div>
                <label className="font-label-bold text-on-surface">Authority Scope</label>
                <select
                  value={authorityScope}
                  onChange={(e) => setAuthorityScope(e.target.value as any)}
                  className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface font-label-mono focus:outline-none"
                >
                  <option value="national">National (All Kenya)</option>
                  <option value="county">County Jurisdiction</option>
                </select>
              </div>

              <div>
                <label className="font-label-bold text-on-surface">Assigned County</label>
                <select
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  disabled={authorityScope === 'national'}
                  className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface font-label-mono focus:outline-none disabled:opacity-50"
                >
                  <option value="Nairobi">Nairobi</option>
                  <option value="Kiambu">Kiambu</option>
                  <option value="Machakos">Machakos</option>
                  <option value="Nakuru">Nakuru</option>
                  <option value="Mombasa">Mombasa</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-sm border-t border-outline-variant/20 flex justify-end">
            <Button type="submit" variant="primary">
              Save Profile Changes
            </Button>
          </div>
        </form>

        {/* Notification & Threshold Preferences */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm space-y-md">
          <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-sm">
            <span className="material-symbols-outlined text-primary text-xl">notifications</span>
            <h3 className="font-headline-lg-mobile text-sm text-on-surface">
              Emergency Alert & Notification Preferences
            </h3>
          </div>

          <div className="space-y-md text-xs font-body-sm">
            <div className="flex items-center justify-between p-sm rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div>
                <span className="font-label-bold text-on-surface block">Critical SOS Triggers</span>
                <span className="text-[11px] text-on-surface-variant">
                  Push instant alert on in-app commuter emergency trigger
                </span>
              </div>
              <input
                type="checkbox"
                checked={sosNotifications}
                onChange={(e) => setSosNotifications(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-sm rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div>
                <span className="font-label-bold text-on-surface block">
                  Speed Governor Tampering Alerts
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  Notify when a telemetry unit reports sensor bypass
                </span>
              </div>
              <input
                type="checkbox"
                checked={speedNotifications}
                onChange={(e) => setSpeedNotifications(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-sm rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div>
                <span className="font-label-bold text-on-surface block">Daily Safety Digest</span>
                <span className="text-[11px] text-on-surface-variant">
                  Receive 08:00 AM summary of regional infractions
                </span>
              </div>
              <input
                type="checkbox"
                checked={dailyDigest}
                onChange={(e) => setDailyDigest(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Security Audit Log Trail */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">history</span>
            <h3 className="font-headline-lg-mobile text-sm text-on-surface">
              Inspector Security Audit Trail (Read-Only Activity Log)
            </h3>
          </div>
          <Badge variant="neutral">{logs.length} Actions Recorded</Badge>
        </div>

        {isLoadingLogs ? (
          <div className="py-8 text-center text-xs text-on-surface-variant font-mono animate-pulse">
            Loading inspector audit trail...
          </div>
        ) : isErrorLogs ? (
          <EmptyState
            icon="error"
            title="Failed to Load Audit Logs"
            description={errorMessage || 'Unable to retrieve inspector activity trail from the server.'}
            secondaryCtaLabel="Retry"
            onSecondaryCta={loadLogs}
          />
        ) : logs.length === 0 ? (
          <EmptyState
            icon="history_toggle_off"
            title="No Audit Activity Recorded Yet"
            description="Official regulatory actions, fine issuances, and black spot verifications will appear here in the audit trail."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-body-sm">
              <thead>
                <tr className="border-b border-outline-variant/20 text-on-surface-variant font-label-mono uppercase">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Inspector / Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target / Vehicle</th>
                  <th className="py-2.5 px-3">SACCO Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {logs.slice(0, 10).map((log) => (
                  <tr key={log.id} className="hover:bg-surface-container-low/50">
                    <td className="py-3 px-3 font-label-mono text-outline">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-bold text-on-surface">{log.actorName}</td>
                    <td className="py-3 px-3 text-on-surface font-medium">{log.action}</td>
                    <td className="py-3 px-3 font-label-mono">{log.target}</td>
                    <td className="py-3 px-3 text-on-surface-variant">{log.saccoId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
