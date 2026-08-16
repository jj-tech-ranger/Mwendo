import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { violationRepository, auditLogRepository } from '../../repositories';
import { Violation, SeverityLevel } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../components/ui/Toast';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

export const AuthorityComplianceScreen: React.FC = () => {
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const { data: violations = [], isLoading } = useQuery({
    queryKey: ['violations'],
    queryFn: async () => {
      return violationRepository.getAll();
    },
    staleTime: QUERY_STALE_TIMES.SAFETY_ALERTS,
  });

  // Filtered dataset
  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      const matchesSearch =
        v.vehicleRegNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.saccoId && v.saccoId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.locationName && v.locationName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSeverity = severityFilter === 'all' || v.severity === severityFilter;
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [violations, searchQuery, severityFilter, statusFilter]);

  // Action handlers
  const handleUpdateStatus = async (violationId: string, newStatus: 'reviewed' | 'disputed' | 'dismissed', actionNote: string) => {
    try {
      await violationRepository.update(violationId, { status: newStatus });
      await queryClient.invalidateQueries({ queryKey: ['violations'] });

      // Write Audit Log
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: selectedViolation?.saccoId || 'NTSA',
        actorName: user?.displayName || 'Inspector ' + (user?.badgeNumber || 'NTSA-901'),
        actorRole: 'NTSA Inspector',
        action: actionNote,
        target: `Violation ${violationId} (${selectedViolation?.vehicleRegNumber})`,
        timestamp: new Date().toISOString(),
      });

      setActionSuccessMsg(`Successfully executed action: ${actionNote}`);
      setSelectedViolation(null);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to process enforcement action:', err);
      showToast('error', 'Enforcement Failed', 'Error updating violation enforcement status.');
    }
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface">
            PSV Compliance & Enforcement Portal
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Official NTSA speed limit breaches, route deviations, and statutory sanction workflows
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <Badge variant="info">Enforcement Active</Badge>
          <span className="font-label-mono text-xs text-on-surface-variant">
            {filteredViolations.length} Records
          </span>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-md rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-label-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
          {/* Search Input */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by plate, SACCO, location..."
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <label className="font-label-mono text-xs text-on-surface-variant whitespace-nowrap">
              Severity:
            </label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-label-mono rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical (&gt;25 km/h over)</option>
              <option value="high">High (&gt;15 km/h over)</option>
              <option value="medium">Medium (&gt;5 km/h over)</option>
              <option value="low">Low (&lt;5 km/h over)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="font-label-mono text-xs text-on-surface-variant whitespace-nowrap">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-label-mono rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="reviewed">Sanctioned / Reviewed</option>
              <option value="disputed">Disputed by SACCO</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Violations Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead>
              <tr className="border-b border-outline-variant/20 text-on-surface-variant font-label-mono uppercase">
                <th className="py-2.5 px-3">Vehicle Plate</th>
                <th className="py-2.5 px-3">SACCO ID</th>
                <th className="py-2.5 px-3">Recorded Speed</th>
                <th className="py-2.5 px-3">Speed Limit</th>
                <th className="py-2.5 px-3">Location / Corridor</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-on-surface">
              {filteredViolations.length > 0 ? (
                filteredViolations.map((v) => (
                  <tr key={v.id} className="hover:bg-surface-container-low/50">
                    <td className="py-3 px-3 font-bold text-on-surface">{v.vehicleRegNumber}</td>
                    <td className="py-3 px-3 font-label-mono text-on-surface-variant">{v.saccoId}</td>
                    <td className="py-3 px-3 font-label-mono font-bold text-rose-600">
                      {v.recordedSpeedKmH} km/h
                    </td>
                    <td className="py-3 px-3 font-label-mono text-outline">{v.speedLimitKmH} km/h</td>
                    <td className="py-3 px-3">{v.locationName || v.routeName || 'Thika Superhighway'}</td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          v.severity === 'critical' || v.severity === 'high' ? 'danger' : 'warning'
                        }
                      >
                        {v.severity.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          v.status === 'reviewed'
                            ? 'success'
                            : v.status === 'pending'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {v.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setSelectedViolation(v)}>
                        Enforce
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-on-surface-variant font-body-sm text-xs">
                    No compliance violations found for the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {selectedViolation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl max-w-lg w-full p-lg shadow-2xl space-y-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-2xl">gavel</span>
                <h3 className="font-headline-lg-mobile text-base text-on-surface">
                  NTSA Enforcement Action Panel
                </h3>
              </div>
              <button
                onClick={() => setSelectedViolation(null)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Violation Details */}
            <div className="bg-surface-container-low p-md rounded-xl space-y-2 text-xs font-body-sm">
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-on-surface-variant">Vehicle Plate:</span>
                <span className="font-bold text-on-surface">{selectedViolation.vehicleRegNumber}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-on-surface-variant">SACCO / Operator:</span>
                <span className="font-bold text-on-surface">{selectedViolation.saccoId}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-on-surface-variant">Recorded Telemetry Speed:</span>
                <span className="font-bold text-rose-600 font-label-mono">
                  {selectedViolation.recordedSpeedKmH} km/h (Limit: {selectedViolation.speedLimitKmH} km/h)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Location:</span>
                <span className="text-on-surface font-medium">
                  {selectedViolation.locationName || 'Main Corridor'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <p className="font-label-mono text-[11px] text-on-surface-variant uppercase">
                Select Statutory Action:
              </p>

              <Button
                variant="primary"
                className="w-full justify-start gap-3 bg-rose-600 hover:bg-rose-700 text-white"
                onClick={() =>
                  handleUpdateStatus(
                    selectedViolation.id,
                    'reviewed',
                    `Issued KES 15,000 Statutory Fine to ${selectedViolation.saccoId} for Plate ${selectedViolation.vehicleRegNumber}`
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">receipt_long</span>
                Issue KES 15,000 Speeding Fine
              </Button>

              <Button
                variant="secondary"
                className="w-full justify-start gap-3"
                onClick={() =>
                  handleUpdateStatus(
                    selectedViolation.id,
                    'reviewed',
                    `Issued Official Warning Notice to ${selectedViolation.saccoId}`
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">warning</span>
                Issue Written SACCO Warning
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 border-amber-500/40 text-amber-700 dark:text-amber-300"
                onClick={() =>
                  handleUpdateStatus(
                    selectedViolation.id,
                    'reviewed',
                    `Initiated Fleet Roadworthiness Audit for ${selectedViolation.saccoId}`
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">fact_check</span>
                Initiate Mandatory SACCO Fleet Audit
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-on-surface-variant"
                onClick={() =>
                  handleUpdateStatus(
                    selectedViolation.id,
                    'dismissed',
                    `Dismissed infraction for ${selectedViolation.vehicleRegNumber}`
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">cancel</span>
                Dismiss Infraction
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
