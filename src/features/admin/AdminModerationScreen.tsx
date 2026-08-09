import React, { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { auditLogRepository, userRepository } from '../../repositories';
import { useAuthStore } from '../../store/useAuthStore';

export const AdminModerationScreen: React.FC = () => {
  const { user: currentAdmin } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'queue' | 'review' | 'trust'>('queue');

  // Trust Score Adjustment state
  const [targetUserId, setTargetUserId] = useState('');
  const [newScore, setNewScore] = useState<number>(85);
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  async function handleOverrideTrustScore(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUserId || !overrideReason) {
      alert('Please enter a User ID and a mandatory override reason.');
      return;
    }
    setIsSubmitting(true);

    try {
      // 1. Update user document
      await userRepository.update(targetUserId, {
        trustScore: newScore,
        updatedAt: new Date().toISOString(),
      });

      // 2. Log audit entry
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: 'TRUST_ENGINE',
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: `MANUAL_TRUST_SCORE_OVERRIDE (New Score: ${newScore})`,
        target: `User ID: ${targetUserId} - Reason: ${overrideReason}`,
        timestamp: new Date().toISOString(),
      });

      setToastMsg(`Successfully updated trust score for User ID ${targetUserId} to ${newScore}/100.`);
      setTargetUserId('');
      setOverrideReason('');
    } catch (err) {
      console.error('Failed to override trust score:', err);
      alert('Error updating trust score. Ensure the user exists.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Trust Engine, Abuse Review & Content Moderation
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Managing community reports, disputed speed violations, and reputation score overrides.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-surface-container border border-outline-variant/30 rounded-xl p-1 font-label-mono text-xs">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'queue'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Moderation Queue
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'review'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Abuse Case Review
          </button>

          <button
            onClick={() => setActiveTab('trust')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'trust'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Trust Score Override
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

      {/* Tab 1: Moderation Queue */}
      {activeTab === 'queue' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md space-y-md shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
              <h3 className="font-headline-lg-mobile text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">report_problem</span>
                Flagged Community Reports
              </h3>
              <Badge variant="warning">2 Pending</Badge>
            </div>

            <div className="space-y-3 text-xs font-body-sm">
              <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface">Case #AR-2291</span>
                  <Badge variant="danger">High Priority</Badge>
                </div>
                <p className="text-on-surface-variant">
                  Multiple commuters reported abusive comments attached to blackspot report #BS-881.
                </p>
                <div className="pt-2 flex justify-end">
                  <Button size="sm" variant="primary" onClick={() => setActiveTab('review')}>
                    Review Case #AR-2291
                  </Button>
                </div>
              </div>

              <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface">Case #AR-2292</span>
                  <Badge variant="warning">Medium</Badge>
                </div>
                <p className="text-on-surface-variant">
                  Suspected automated spam submissions on route Waiyaki Way from user ID <code className="font-label-mono text-primary">usr-104</code>.
                </p>
                <div className="pt-2 flex justify-end">
                  <Button size="sm" variant="secondary" onClick={() => setActiveTab('trust')}>
                    Adjust Trust Score
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md space-y-md shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
              <h3 className="font-headline-lg-mobile text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600">gavel</span>
                Disputed Speed Violations Queue
              </h3>
              <Badge variant="neutral">1 Pending</Badge>
            </div>

            <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-label-mono font-bold text-primary">Dispute #V-4081</span>
                <span className="font-label-mono text-[10px] text-outline">MetroLink Express</span>
              </div>
              <p className="text-on-surface-variant">
                Driver disputing 94 km/h speed breach recorded on A104 Waiyaki Way at 14:10 PM. Claims speed governor calibration certificate was active.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Abuse Review Case Detail */}
      {activeTab === 'review' && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg space-y-md shadow-sm max-w-3xl mx-auto">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-md">
            <div>
              <span className="font-label-mono text-xs text-primary font-bold">CASE #AR-2291</span>
              <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">
                Abuse Review: Unverified Hazard Report Misinformation
              </h3>
            </div>
            <Badge variant="danger">High Severity</Badge>
          </div>

          <div className="space-y-sm text-xs font-body-sm">
            <div className="p-md rounded-xl bg-surface-container-low space-y-1">
              <span className="font-label-mono text-[10px] text-outline uppercase font-bold">
                Flagged Content Preview
              </span>
              <p className="text-on-surface italic">
                "Major carjacking risk near Kangemi stage. Avoid at night."
              </p>
              <div className="font-label-mono text-[10px] text-outline pt-1">
                Submitted by User ID: usr-104 • Reporter Trust Score: 42/100
              </div>
            </div>

            <div className="p-md rounded-xl border border-outline-variant/20 space-y-2">
              <span className="font-label-mono text-[10px] text-outline uppercase font-bold">
                Decision Panel & Resolution Notes
              </span>
              <textarea
                rows={3}
                placeholder="Enter mandatory resolution notes for audit log..."
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-sm pt-md border-t border-outline-variant/20">
            <Button variant="outline" onClick={() => setActiveTab('queue')}>
              Dismiss Flag
            </Button>
            <Button variant="primary" className="bg-rose-600 hover:bg-rose-700 text-white border-none">
              Remove Content & Warn User
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: Trust Score Override Tool */}
      {activeTab === 'trust' && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg space-y-md shadow-sm max-w-xl mx-auto">
          <div className="border-b border-outline-variant/20 pb-md">
            <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">published_with_changes</span>
              Manual Trust Score Adjustment Tool
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Every manual adjustment directly recalculates reputation weightings and writes an immutable entry to <code className="font-label-mono">audit_logs</code>.
            </p>
          </div>

          <form onSubmit={handleOverrideTrustScore} className="space-y-md text-xs">
            <div>
              <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                Target User ID or Email
              </label>
              <input
                type="text"
                required
                placeholder="e.g. usr-104 or passenger4471@mwendosalama.co.ke"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-label-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                  New Adjusted Trust Score (0 - 100)
                </label>
                <span className="font-label-mono font-bold text-sm text-primary">{newScore} / 100</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={newScore}
                onChange={(e) => setNewScore(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div>
              <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                Mandatory Reason for Override (Audit Logged)
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Manual verification by NTSA officer confirms false positive flag on driver account."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface"
              />
            </div>

            <Button type="submit" variant="primary" className="w-full justify-center" disabled={isSubmitting}>
              {isSubmitting ? 'Saving & Audit Logging...' : 'Apply Score Override'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};
