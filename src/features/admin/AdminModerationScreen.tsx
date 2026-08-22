import React, { useState, useEffect, useCallback } from 'react';
import { where } from 'firebase/firestore';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { auditLogRepository, userRepository, violationRepository } from '../../repositories';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../components/ui/Toast';
import { Violation } from '../../types';
import { toStandardDate } from '../../lib/utils';

export const AdminModerationScreen: React.FC = () => {
  const { showToast } = useToast();
  const { user: currentAdmin } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'queue' | 'review' | 'trust'>('queue');

  // Real Disputed Violations state
  const [disputedViolations, setDisputedViolations] = useState<Violation[]>([]);
  const [loadingDisputes, setLoadingDisputes] = useState(true);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // Trust Score Adjustment state
  const [targetUserId, setTargetUserId] = useState('');
  const [newScore, setNewScore] = useState<number>(85);
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    setLoadingDisputes(true);
    try {
      const results = await violationRepository.getAll([where('status', '==', 'disputed')]);
      setDisputedViolations(results);
    } catch (err) {
      console.error('[AdminModerationScreen] Error fetching disputed violations:', err);
      showToast('error', 'Unable to Load Data', "We couldn't load disputed violations. Please try again.");
    } finally {
      setLoadingDisputes(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  async function handleResolveDispute(action: 'reviewed' | 'dismissed') {
    if (!selectedViolation) return;
    if (!resolutionNotes.trim()) {
      showToast('warning', 'Notes Required', 'Please enter resolution notes before submitting a decision.');
      return;
    }

    setIsResolving(true);
    try {
      // 1. Update violation in Firestore
      await violationRepository.update(selectedViolation.id, {
        status: action,
      });

      // 2. Write immutable audit log entry
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: selectedViolation.saccoId || 'SYSTEM_ADMIN',
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: `RESOLVE_VIOLATION_DISPUTE (${action.toUpperCase()})`,
        target: `Violation ID: ${selectedViolation.id} (${selectedViolation.vehicleRegNumber}) - Notes: ${resolutionNotes}`,
        timestamp: new Date().toISOString(),
      });

      showToast(
        'success',
        'Dispute Adjudicated',
        action === 'reviewed'
          ? `Dispute dismissed and violation upheld for ${selectedViolation.vehicleRegNumber}.`
          : `Dispute upheld and violation dismissed for ${selectedViolation.vehicleRegNumber}.`
      );

      setSelectedViolation(null);
      setResolutionNotes('');
      setActiveTab('queue');
      await fetchDisputes();
    } catch (err) {
      console.error('[AdminModerationScreen] Failed to adjudicate dispute:', err);
      showToast('error', 'Update Failed', "We couldn't update the violation status. Please try again.");
    } finally {
      setIsResolving(false);
    }
  }

  async function handleOverrideTrustScore(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUserId || !overrideReason) {
      showToast('warning', 'Missing Details', 'Please enter a User ID and a mandatory override reason.');
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
      showToast('error', 'Update Failed', 'Error updating trust score. Ensure the user exists.');
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
            Dispute Case Review
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
          {/* Left Column: Flagged Community Reports (Honest Disclosure) */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md space-y-md shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
              <h3 className="font-headline-lg-mobile text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">report_problem</span>
                Flagged Community Reports
              </h3>
              <Badge variant="neutral">Not Implemented</Badge>
            </div>

            <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-3 text-xs font-body-sm">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-outline text-xl mt-0.5">info</span>
                <div className="space-y-1">
                  <p className="font-bold text-on-surface">Community abuse-flagging is not yet implemented</p>
                  <p className="text-on-surface-variant leading-relaxed">
                    No active user flags are pending moderation.
                  </p>
                  <p className="text-on-surface-variant leading-relaxed pt-1">
                    Hazard and road-safety report verification is handled separately via the Black Spots moderation panel.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Real Disputed Speed Violations Queue */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md space-y-md shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
              <h3 className="font-headline-lg-mobile text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600">gavel</span>
                Disputed Speed Violations Queue
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant={disputedViolations.length > 0 ? 'warning' : 'neutral'}>
                  {loadingDisputes ? 'Loading...' : `${disputedViolations.length} Pending`}
                </Badge>
                <button
                  onClick={fetchDisputes}
                  className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
                  title="Refresh Disputed Violations"
                  aria-label="Refresh Disputed Violations"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                </button>
              </div>
            </div>

            {loadingDisputes ? (
              <div className="p-lg text-center text-xs text-on-surface-variant font-label-mono animate-pulse">
                Loading disputed violations...
              </div>
            ) : disputedViolations.length === 0 ? (
              <EmptyState
                icon="gavel"
                title="No disputed violations pending review"
                description="All speed breach recordings and SACCO citations are currently clear of open disputes."
              />
            ) : (
              <div className="space-y-3">
                {disputedViolations.map((violation) => (
                  <div
                    key={violation.id}
                    className="p-md rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-label-mono font-bold text-primary">
                        {violation.vehicleRegNumber}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            violation.severity === 'critical' || violation.severity === 'high'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {violation.severity.toUpperCase()}
                        </Badge>
                        <span className="font-label-mono text-[10px] text-outline">
                          {violation.saccoId}
                        </span>
                      </div>
                    </div>

                    <p className="text-on-surface-variant">
                      Recorded speed of{' '}
                      <strong className="text-rose-600 dark:text-rose-400 font-label-mono">
                        {violation.recordedSpeedKmH} km/h
                      </strong>{' '}
                      in a {violation.speedLimitKmH} km/h zone
                      {violation.routeName ? ` on ${violation.routeName}` : ''}
                      {violation.driverName ? ` (Driver: ${violation.driverName})` : ''}.
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10 text-[11px] text-on-surface-variant font-label-mono">
                      <span>{toStandardDate(violation.timestamp).toLocaleString()}</span>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setSelectedViolation(violation);
                          setActiveTab('review');
                        }}
                      >
                        Review Dispute
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Dispute Case Review */}
      {activeTab === 'review' && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg space-y-md shadow-sm max-w-3xl mx-auto">
          {selectedViolation ? (
            <>
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-md">
                <div>
                  <span className="font-label-mono text-xs text-primary font-bold">
                    DISPUTE: {selectedViolation.vehicleRegNumber}
                  </span>
                  <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">
                    Violation Adjudication & Evidence Review
                  </h3>
                </div>
                <Badge
                  variant={
                    selectedViolation.severity === 'critical' || selectedViolation.severity === 'high'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {selectedViolation.severity.toUpperCase()} SEVERITY
                </Badge>
              </div>

              <div className="space-y-sm text-xs font-body-sm">
                <div className="p-md rounded-xl bg-surface-container-low space-y-2">
                  <span className="font-label-mono text-[10px] text-outline uppercase font-bold">
                    Violation Speed & GPS Details
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-label-mono text-xs">
                    <div>
                      <span className="text-[10px] text-outline block">Violation ID</span>
                      <span className="text-on-surface font-bold">{selectedViolation.id}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-outline block">Vehicle Plate</span>
                      <span className="text-on-surface font-bold">{selectedViolation.vehicleRegNumber}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-outline block">SACCO ID</span>
                      <span className="text-on-surface">{selectedViolation.saccoId}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-outline block">Recorded Speed</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        {selectedViolation.recordedSpeedKmH} km/h
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-outline block">Zone Speed Limit</span>
                      <span className="text-on-surface">{selectedViolation.speedLimitKmH} km/h</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-outline block">Confidence Score</span>
                      <span className="text-on-surface">{selectedViolation.confidenceScore}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-outline block">Driver</span>
                      <span className="text-on-surface">{selectedViolation.driverName || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-outline block">Route / Location</span>
                      <span className="text-on-surface">{selectedViolation.routeName || selectedViolation.locationName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-outline block">Timestamp</span>
                      <span className="text-on-surface">{toStandardDate(selectedViolation.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-md rounded-xl border border-outline-variant/20 space-y-2">
                  <label htmlFor="adjudication-notes" className="font-label-mono text-[10px] text-outline uppercase font-bold block">
                    Adjudication Decision Notes (Required for Audit Log)
                  </label>
                  <textarea
                    id="adjudication-notes"
                    rows={3}
                    required
                    placeholder="Enter mandatory resolution notes (e.g., GPS telemetry calibrated against road grade; speed breach upheld / false positive sensor reading dismissed)..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-sm pt-md border-t border-outline-variant/20">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedViolation(null);
                    setActiveTab('queue');
                  }}
                  disabled={isResolving}
                >
                  Cancel & Return to Queue
                </Button>
                <div className="flex items-center gap-sm">
                  <Button
                    variant="outline"
                    className="text-rose-600 dark:text-rose-400 border-rose-600/30 hover:bg-rose-500/10"
                    onClick={() => handleResolveDispute('dismissed')}
                    disabled={isResolving}
                  >
                    {isResolving ? 'Processing...' : 'Uphold Dispute (Dismiss Violation)'}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleResolveDispute('reviewed')}
                    disabled={isResolving}
                  >
                    {isResolving ? 'Processing...' : 'Dismiss Dispute (Uphold Violation)'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-xl">
              <EmptyState
                icon="fact_check"
                title="No Dispute Selected for Review"
                description={
                  disputedViolations.length > 0
                    ? `There are ${disputedViolations.length} disputed violation(s) waiting in the Moderation Queue.`
                    : 'The disputed violations queue is currently empty.'
                }
                primaryCtaLabel="Open Moderation Queue"
                onPrimaryCta={() => setActiveTab('queue')}
              />
            </div>
          )}
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
              <label htmlFor="target-user-id" className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant block mb-1">
                Target User ID or Email
              </label>
              <input
                id="target-user-id"
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
                <label htmlFor="trust-score-range" className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                  New Adjusted Trust Score (0 - 100)
                </label>
                <span className="font-label-mono font-bold text-sm text-primary">{newScore} / 100</span>
              </div>
              <input
                id="trust-score-range"
                type="range"
                min="0"
                max="100"
                value={newScore}
                onChange={(e) => setNewScore(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div>
              <label htmlFor="override-reason" className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant block mb-1">
                Mandatory Reason for Override (Audit Logged)
              </label>
              <textarea
                id="override-reason"
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
