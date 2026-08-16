import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { complaintRepository, auditLogRepository } from '../../repositories';
import { Complaint } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../components/ui/Toast';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

export const AuthorityComplaintsScreen: React.FC = () => {
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['complaints'],
    queryFn: async () => {
      return complaintRepository.getAll();
    },
    staleTime: QUERY_STALE_TIMES.SAFETY_ALERTS,
  });

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const matchSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.saccoId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.vehicleRegNumber && c.vehicleRegNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [complaints, searchQuery, statusFilter]);

  const handleAction = async (complaintId: string, newStatus: 'investigating' | 'resolved', actionText: string) => {
    try {
      await complaintRepository.update(complaintId, { status: newStatus });
      await queryClient.invalidateQueries({ queryKey: ['complaints'] });

      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: selectedComplaint?.saccoId || 'NTSA',
        actorName: user?.displayName || 'Inspector',
        actorRole: 'NTSA Inspector',
        action: actionText,
        target: `Complaint ${complaintId}`,
        timestamp: new Date().toISOString(),
      });

      setSuccessMsg(`Action executed: ${actionText}`);
      setSelectedComplaint(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to process complaint action:', err);
      showToast('error', 'Update Failed', 'Error updating complaint status.');
    }
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface">
            NTSA Passenger Complaint Verification Queue
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Official review of commuter reported overspeeding, harassment, and reckless driving
          </p>
        </div>

        <span className="font-label-mono text-xs text-on-surface-variant">
          {filteredComplaints.length} Total Complaints
        </span>
      </div>

      {successMsg && (
        <div className="p-md rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-label-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">rate_review</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, vehicle plate, SACCO..."
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="font-label-mono text-xs text-on-surface-variant whitespace-nowrap">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-label-mono rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open / Unreviewed</option>
              <option value="investigating">Under Investigation</option>
              <option value="resolved">Resolved / Sanctioned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Complaints Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead>
              <tr className="border-b border-outline-variant/20 text-on-surface-variant font-label-mono uppercase">
                <th className="py-2.5 px-3">Complaint Title</th>
                <th className="py-2.5 px-3">SACCO Name</th>
                <th className="py-2.5 px-3">Vehicle Plate</th>
                <th className="py-2.5 px-3">Passenger</th>
                <th className="py-2.5 px-3">Logged Date</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Inspector Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-on-surface">
              {filteredComplaints.length > 0 ? (
                filteredComplaints.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-container-low/50">
                    <td className="py-3 px-3 font-bold text-on-surface">{c.title}</td>
                    <td className="py-3 px-3 text-on-surface-variant">{c.saccoId}</td>
                    <td className="py-3 px-3 font-label-mono">{c.vehicleRegNumber || 'N/A'}</td>
                    <td className="py-3 px-3">{c.passengerName || 'Anonymous Commuter'}</td>
                    <td className="py-3 px-3 font-label-mono text-outline">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          c.status === 'resolved'
                            ? 'success'
                            : c.status === 'investigating'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {c.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setSelectedComplaint(c)}>
                        Verify
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr key="empty">
                  <td colSpan={7} className="py-8">
                    <EmptyState
                      title="No Complaints Logged"
                      description="No passenger complaints logged yet."
                      icon="rate_review"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verify Detail Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl max-w-lg w-full p-lg shadow-2xl space-y-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">rate_review</span>
                <h3 className="font-headline-lg-mobile text-base text-on-surface">
                  Verify Passenger Complaint
                </h3>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="bg-surface-container-low p-md rounded-xl space-y-2 text-xs font-body-sm">
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-on-surface-variant">Title:</span>
                <span className="font-bold text-on-surface">{selectedComplaint.title}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-on-surface-variant">SACCO / Plate:</span>
                <span className="font-bold text-on-surface">
                  {selectedComplaint.saccoId} ({selectedComplaint.vehicleRegNumber || 'N/A'})
                </span>
              </div>
              <div className="space-y-1 pt-1">
                <span className="text-on-surface-variant block">Full Commuter Description:</span>
                <p className="text-on-surface bg-surface-container p-2 rounded-lg italic">
                  "{selectedComplaint.description}"
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-label-mono text-[11px] text-on-surface-variant uppercase">
                Inspector Verification Action:
              </p>

              <Button
                variant="primary"
                className="w-full justify-start gap-3"
                onClick={() =>
                  handleAction(
                    selectedComplaint.id,
                    'investigating',
                    `Escalated complaint to ${selectedComplaint.saccoId} for formal explanation`
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">forward_to_inbox</span>
                Demand Formal Explanation from SACCO
              </Button>

              <Button
                variant="secondary"
                className="w-full justify-start gap-3"
                onClick={() =>
                  handleAction(
                    selectedComplaint.id,
                    'resolved',
                    `Sanctioned SACCO ${selectedComplaint.saccoId} following verified passenger complaint`
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">gavel</span>
                Sanction SACCO Operator
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() =>
                  handleAction(
                    selectedComplaint.id,
                    'resolved',
                    `Resolved complaint for ${selectedComplaint.vehicleRegNumber}`
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Mark Complaint Resolved
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
