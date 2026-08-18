import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { auditLogRepository, userRepository, saccoRepository, tripRepository, complaintRepository, analyticsRepository } from '../../repositories';
import { AuditLog, Complaint, PlatformAnalyticsDaily } from '../../types';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data: dashboardData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['adminDashboardData'],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const [fetchedLogs, fetchedUsers, fetchedSaccos, precomputedDoc, fetchedComplaints] = await Promise.all([
        auditLogRepository.getAll(),
        userRepository.getAll(),
        saccoRepository.getAll(),
        analyticsRepository.getById(`daily_${todayStr}`).catch(() => null),
        complaintRepository.getAll(),
      ]);

      let tripCount = 0;
      if (precomputedDoc && 'totalTrips' in precomputedDoc && typeof (precomputedDoc as PlatformAnalyticsDaily).totalTrips === 'number') {
        tripCount = (precomputedDoc as PlatformAnalyticsDaily).totalTrips;
      } else {
        const fallbackTrips = await tripRepository.getAll();
        tripCount = fallbackTrips.length;
      }

      return {
        logs: fetchedLogs,
        complaints: fetchedComplaints.filter((c) => c.status === 'open' || c.status === 'investigating'),
        stats: {
          userCount: fetchedUsers.length,
          saccoCount: fetchedSaccos.length,
          tripCount,
        },
      };
    },
    staleTime: QUERY_STALE_TIMES.ANALYTICS_SUMMARIES,
  });

  const logs = dashboardData?.logs || [];
  const complaints = dashboardData?.complaints || [];
  const stats = dashboardData?.stats || { userCount: 0, saccoCount: 0, tripCount: 0 };

  if (isError) {
    return (
      <EmptyState
        icon="error"
        title="Failed to Load Admin Operations Data"
        description={
          (error as Error)?.message ||
          'Unable to load cross-tenant platform statistics, user directories, and audit logs. Please try again.'
        }
        secondaryCtaLabel="Retry Data Sync"
        onSecondaryCta={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-lg">
      {/* Top Banner */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">admin_panel_settings</span>
            <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
              Mwendo Salama Platform Operations & Control
            </h2>
          </div>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Cross-tenant platform overview across registered SACCOs and Kenya Counties
          </p>
        </div>

        <div className="flex items-center gap-sm">
          <Badge variant="success" className="py-1.5 px-3 font-label-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-ping inline-block" />
            SYSTEM OPERATIONAL
          </Badge>
        </div>
      </div>

      {/* Top Row: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Total Users
          </span>
          <p className="font-headline-lg-mobile text-2xl text-on-surface font-bold">{stats.userCount}</p>
          <span className="font-label-mono text-[10px] text-on-surface-variant">Registered users</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Active SACCOs
          </span>
          <p className="font-headline-lg-mobile text-2xl text-primary font-bold">{stats.saccoCount}</p>
          <span className="font-label-mono text-[10px] text-on-surface-variant">Registered SACCOs</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Total Tracked Trips
          </span>
          <p className="font-headline-lg-mobile text-2xl text-on-surface font-bold">{stats.tripCount}</p>
          <span className="font-label-mono text-[10px] text-on-surface-variant">Recorded in database</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Pending Moderation
          </span>
          <p className="font-headline-lg-mobile text-2xl text-amber-600 font-bold">{complaints.length}</p>
          <span className="font-label-mono text-[10px] text-on-surface-variant">Reports awaiting review</span>
        </div>
      </div>

      {/* Second Row: System Status Card & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Recent Admin Activity Feed */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
            <h3 className="font-headline-lg-mobile text-sm text-on-surface font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">history</span>
              Recent Governance & Administrative Actions
            </h3>
            <Button size="sm" variant="secondary" onClick={() => navigate('/admin/audit-logs')}>
              Full Logs
            </Button>
          </div>

          <div className="space-y-sm">
            {logs.length > 0 ? (
              logs.slice(0, 5).map((log) => (
                <div key={log.id} className="p-sm rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-on-surface">{log.actorName}</span>
                    <span className="font-label-mono text-[10px] text-outline">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="font-body-sm text-xs text-on-surface-variant">{log.action}</p>
                  <div className="font-label-mono text-[10px] text-outline">
                    Target: {log.target} {log.saccoId ? `• Scope: ${log.saccoId}` : ''}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-on-surface-variant font-mono p-4">No audit logs recorded yet.</p>
            )}
          </div>
        </div>

        {/* Moderation Queue Snapshot */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm mb-sm">
              <h3 className="font-headline-lg-mobile text-sm text-on-surface font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-xl">gavel</span>
                Moderation Queue Snapshot
              </h3>
              <Badge variant="warning">{complaints.length} Pending Reviews</Badge>
            </div>

            <div className="space-y-sm">
              {complaints.length === 0 ? (
                <p className="text-xs text-on-surface-variant font-mono p-4">
                  No pending complaints or reports in moderation queue.
                </p>
              ) : (
                complaints.slice(0, 3).map((c) => (
                  <div key={c.id} className="p-sm rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-label-mono text-xs font-bold text-on-surface">
                        {c.vehicleRegNumber || 'General Complaint'}
                      </span>
                      <Badge variant="warning">{c.status}</Badge>
                    </div>
                    <p className="font-body-sm text-xs text-on-surface">
                      {c.description || c.title}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <Button
            variant="primary"
            className="w-full justify-center gap-2 mt-md"
            onClick={() => navigate('/admin/moderation')}
          >
            <span className="material-symbols-outlined text-lg">rate_review</span>
            Review Moderation Queue
          </Button>
        </div>
      </div>
    </div>
  );
};
