import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/LoadingIndicators';
import { useAuthStore } from '../../store/useAuthStore';
import { blackSpotRepository, safetyAlertRepository } from '../../repositories';
import { BlackSpot, SafetyAlert } from '../../types';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

const AlertListSkeleton: React.FC = () => (
  <div className="space-y-3" role="status" aria-label="Loading safety alerts">
    {[0, 1, 2].map((item) => (
      <Card key={item} className="p-4 space-y-3 border border-outline-variant/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Skeleton variant="circle" className="w-9 h-9 shrink-0" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </Card>
    ))}
    <span className="sr-only">Loading active corridor alerts…</span>
  </div>
);

const ReportListSkeleton: React.FC = () => (
  <div className="space-y-3" role="status" aria-label="Loading hazard reports">
    {[0, 1].map((item) => (
      <Card key={item} className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <div className="pt-2 border-t border-outline-variant/20 flex justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      </Card>
    ))}
    <span className="sr-only">Loading your hazard reports…</span>
  </div>
);

export const PassengerAlertsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [activeSubTab, setActiveSubTab] = useState<'alerts' | 'achievements' | 'trust' | 'reports'>('alerts');
  const [selectedAlert, setSelectedAlert] = useState<SafetyAlert | null>(null);

  const {
    data: alertsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['passengerAlertsAndReports', user?.uid],
    queryFn: async () => {
      const [allAlerts, allSpots] = await Promise.all([
        safetyAlertRepository.getAll().catch(() => [] as SafetyAlert[]),
        blackSpotRepository.getAll().catch(() => [] as BlackSpot[]),
      ]);

      const mySpots = user?.uid
        ? allSpots.filter((s) => s.reportedByUid === user.uid)
        : allSpots;

      return {
        alerts: allAlerts,
        myReports: mySpots,
      };
    },
    staleTime: QUERY_STALE_TIMES.SAFETY_ALERTS,
  });

  const alertsList = alertsData?.alerts || [];
  const reportsList = alertsData?.myReports || [];
  const verifiedReportsCount = reportsList.filter((r) => r.verifiedByAuthority || r.status === 'published').length;
  const calculatedTrustScore = Math.min(100, 50 + verifiedReportsCount * 15 + (user ? 10 : 0));

  if (isError) {
    return (
      <div className="p-4 sm:p-6 max-w-xl mx-auto pb-24">
        <EmptyState
          icon="error"
          title="Failed to Load Safety Alerts"
          description={
            (error as Error)?.message ||
            'Unable to fetch transit notifications and submitted hazard reports. Please try again.'
          }
          secondaryCtaLabel="Retry"
          onSecondaryCta={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      <div>
        <h1 className="text-xl font-black text-on-surface">Alerts & Safety Center</h1>
        <p className="text-xs text-on-surface-variant">
          Live transit notices, community trust score, and hazard report history
        </p>
      </div>

      <div className="flex bg-surface-container p-1 rounded-xl text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('alerts')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'alerts' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          Notifications ({alertsList.length})
        </button>
        <button
          onClick={() => setActiveSubTab('trust')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'trust' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          Trust Score
        </button>
        <button
          onClick={() => setActiveSubTab('reports')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'reports' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          My Reports ({reportsList.length})
        </button>
        <button
          onClick={() => setActiveSubTab('achievements')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'achievements' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          Badges
        </button>
      </div>

      {activeSubTab === 'alerts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant">
            <span>Live Corridor Alerts</span>
            <span>{alertsList.length} Active</span>
          </div>

          {isLoading ? (
            <AlertListSkeleton />
          ) : alertsList.length === 0 ? (
            <EmptyState
              icon="notifications_off"
              title="No Active Safety Alerts"
              description="Corridor speed compliance warnings and verified road hazard notices will appear here in real time."
            />
          ) : (
            alertsList.map((alert) => (
              <Card
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className="p-4 cursor-pointer hover:bg-surface-container-high/50 transition-colors space-y-2 border border-outline-variant/30"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`p-1.5 rounded-full ${
                        alert.severity === 'critical'
                          ? 'bg-error/20 text-error'
                          : alert.severity === 'high'
                          ? 'bg-amber-500/20 text-amber-600'
                          : 'bg-emerald-500/20 text-emerald-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base block">
                        {alert.type === 'overspeeding' ? 'speed' : alert.type === 'sos' ? 'emergency' : 'warning'}
                      </span>
                    </span>
                    <span className="font-bold text-sm text-on-surface">{alert.type.replace('_', ' ').toUpperCase()} Alert</span>
                  </div>

                  <span className="text-[10px] font-mono text-on-surface-variant">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs text-on-surface-variant">{alert.message}</p>
              </Card>
            ))
          )}
        </div>
      )}

      {activeSubTab === 'trust' && (
        <div className="space-y-4">
          <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-emerald-900/10 to-teal-900/10 border border-emerald-500/20">
            <div className="w-24 h-24 mx-auto rounded-full bg-emerald-600/10 border-4 border-emerald-600 text-emerald-800 dark:text-emerald-300 flex flex-col items-center justify-center">
              <span className="text-3xl font-black font-mono">{calculatedTrustScore}</span>
              <span className="text-[9px] uppercase tracking-wider font-bold">/ 100</span>
            </div>

            <div>
              <Badge className="bg-emerald-700 text-white font-bold">
                {calculatedTrustScore >= 80 ? 'Trusted Reporter' : 'Community Contributor'}
              </Badge>
              <p className="text-xs text-on-surface-variant mt-2 max-w-xs mx-auto">
                Your hazard submissions receive priority moderation review based on your verified report track record.
              </p>
            </div>
          </Card>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold text-on-surface-variant uppercase">
              Trust Score Metrics
            </h3>
            <Card className="p-3 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span>Verified Hazard Reports ({verifiedReportsCount})</span>
                <span className="text-emerald-700 font-bold">+{verifiedReportsCount * 15} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Base Reporter Standing</span>
                <span className="text-emerald-700 font-bold">+50 pts</span>
              </div>
              <div className="flex justify-between">
                <span>Authenticated Account</span>
                <span className="text-emerald-700 font-bold">+{user ? 10 : 0} pts</span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeSubTab === 'reports' && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold text-on-surface-variant uppercase">
            Submitted Hazard Reports
          </h2>

          {isLoading ? (
            <ReportListSkeleton />
          ) : reportsList.length === 0 ? (
            <EmptyState
              icon="report_off"
              title="No Hazard Reports Submitted"
              description="You have not submitted any road hazard or black spot reports yet. Report unsafe road conditions to protect fellow commuters."
            />
          ) : (
            reportsList.map((r) => (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-sm text-on-surface">{r.name}</div>
                    <div className="text-xs text-on-surface-variant">{r.routeName || r.county}</div>
                  </div>

                  <Badge
                    variant={r.status === 'published' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}
                    className="text-[10px] uppercase font-bold"
                  >
                    {r.status || 'pending'}
                  </Badge>
                </div>

                <p className="text-xs text-on-surface-variant line-clamp-2">{r.hazardDescription}</p>

                <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant border-t border-outline-variant/20 pt-2">
                  <span>Reported: {new Date(r.createdAt).toLocaleDateString()}</span>
                  <span className="text-emerald-700 font-bold">
                    {r.verifiedByAuthority ? 'Verified (+15 pts)' : 'Under Moderation'}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {activeSubTab === 'achievements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-on-surface">Community Badges</span>
            <span className="text-emerald-700 font-bold">
              {verifiedReportsCount > 0 ? '2 Unlocked' : '1 Unlocked'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { title: 'Safe Commuter', desc: 'Registered commuter on Mwendo Salama', icon: 'verified_user', earned: true },
              {
                title: 'Road Guardian',
                desc: 'First road hazard verified by authority',
                icon: 'shield',
                earned: verifiedReportsCount > 0,
              },
              {
                title: 'Active Reporter',
                desc: 'Submitted 3+ road safety hazard reports',
                icon: 'flag',
                earned: reportsList.length >= 3,
              },
            ].map((b, idx) => (
              <Card
                key={idx}
                className={`p-4 text-center space-y-2 ${
                  b.earned ? 'bg-surface border-emerald-500/30' : 'bg-surface-container-low opacity-60'
                }`}
              >
                <div
                  className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                    b.earned ? 'bg-emerald-600 text-white' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">{b.icon}</span>
                </div>
                <div className="font-bold text-xs text-on-surface">{b.title}</div>
                <p className="text-[10px] text-on-surface-variant">{b.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title={selectedAlert ? `${selectedAlert.type.toUpperCase()} Alert Detail` : 'Notification Detail'}
      >
        {selectedAlert && (
          <div className="space-y-3 text-xs text-on-surface">
            <div className="font-mono text-on-surface-variant">
              {new Date(selectedAlert.timestamp).toLocaleString()}
            </div>
            <p className="text-on-surface leading-relaxed">{selectedAlert.message}</p>
            {typeof selectedAlert.speedKmH === 'number' && (
              <div className="p-2 rounded bg-surface-container font-mono text-xs">
                Recorded Speed: <strong>{selectedAlert.speedKmH} km/h</strong> (Limit: 80 km/h)
              </div>
            )}
            <Button className="w-full mt-2" onClick={() => setSelectedAlert(null)}>
              Dismiss
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
};
