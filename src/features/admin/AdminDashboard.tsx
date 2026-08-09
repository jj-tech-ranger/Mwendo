import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { AreaChartWrapper } from '../../components/charts/Charts';
import { auditLogRepository, userRepository, saccoRepository } from '../../repositories';
import { AuditLog } from '../../types';
import { useNavigate } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const fetchedLogs = await auditLogRepository.getAll();
        if (isMounted) setLogs(fetchedLogs);
      } catch (err) {
        console.error('Failed to load admin logs:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Growth chart data (last 90 days aggregated preview)
  const growthData = [
    { name: 'May', trips: 142000, newUsers: 12400 },
    { name: 'Jun', trips: 168000, newUsers: 15200 },
    { name: 'Jul', trips: 195000, newUsers: 18900 },
    { name: 'Aug', trips: 214880, newUsers: 22100 },
  ];

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
            Cross-tenant platform overview across all 12 SACCOs and 47 Kenya Counties
          </p>
        </div>

        <div className="flex items-center gap-sm">
          <Badge variant="success" className="py-1.5 px-3 font-label-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-ping inline-block" />
            SYSTEMS NOMINAL (99.97% UPTIME)
          </Badge>
        </div>
      </div>

      {/* Top Row: 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-md">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Total Users
          </span>
          <p className="font-headline-lg-mobile text-2xl text-on-surface font-bold">52,340</p>
          <span className="font-label-mono text-[10px] text-emerald-600 font-bold">+18.4% this month</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Active SACCOs
          </span>
          <p className="font-headline-lg-mobile text-2xl text-primary font-bold">12</p>
          <span className="font-label-mono text-[10px] text-on-surface-variant">1 Pending Audit</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Active Authorities
          </span>
          <p className="font-headline-lg-mobile text-2xl text-on-surface font-bold">4</p>
          <span className="font-label-mono text-[10px] text-on-surface-variant">NTSA + County Units</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Total Trips (30d)
          </span>
          <p className="font-headline-lg-mobile text-2xl text-on-surface font-bold">214,880</p>
          <span className="font-label-mono text-[10px] text-emerald-600 font-bold">+12.1% GPS tracked</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Platform Uptime
          </span>
          <p className="font-headline-lg-mobile text-2xl text-emerald-600 font-bold">99.97%</p>
          <span className="font-label-mono text-[10px] text-emerald-600 font-bold">SLO Target Met</span>
        </div>
      </div>

      {/* Second Row: Platform Growth Area Chart & System Status Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Large Growth Chart (2/3) */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
            <div>
              <h3 className="font-headline-lg-mobile text-sm text-on-surface font-bold">
                Platform-Wide Growth & Telemetry Ingestion (90 Days)
              </h3>
              <p className="font-body-sm text-[11px] text-on-surface-variant">
                Dual metric comparison: Passenger trips vs new registered commuters
              </p>
            </div>
            <Badge variant="info">All Corridors</Badge>
          </div>

          <AreaChartWrapper
            data={growthData}
            xKey="name"
            areas={[
              { key: 'trips', name: 'Trips Completed', color: '#1A5C2E' },
              { key: 'newUsers', name: 'New Users', color: '#185FA5' },
            ]}
            height={260}
          />
        </div>

        {/* System Status Card (1/3) */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm mb-sm">
              <h3 className="font-headline-lg-mobile text-sm text-on-surface font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">dns</span>
                Infrastructure Status
              </h3>
              <Button size="sm" variant="outline" onClick={() => navigate('/admin/system-health')}>
                Details
              </Button>
            </div>

            <div className="space-y-sm text-xs font-body-sm">
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-on-surface">Firestore DB Cluster</span>
                </div>
                <span className="font-label-mono text-[10px] text-emerald-600 font-bold">18ms</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="font-bold text-on-surface">Cloud Functions (Telemetry)</span>
                </div>
                <span className="font-label-mono text-[10px] text-amber-600 font-bold">142ms latency</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-on-surface">Cloud Storage Bucket</span>
                </div>
                <span className="font-label-mono text-[10px] text-emerald-600 font-bold">24ms</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-on-surface">Pub/Sub Message Bus</span>
                </div>
                <span className="font-label-mono text-[10px] text-emerald-600 font-bold">8ms</span>
              </div>
            </div>
          </div>

          <div className="pt-sm border-t border-outline-variant/20 text-[10px] font-label-mono text-on-surface-variant flex items-center justify-between">
            <span>Region: europe-west2</span>
            <span>SLO: 99.95%</span>
          </div>
        </div>
      </div>

      {/* Third Row: Recent Admin Activity Feed & Moderation Snapshot */}
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
              logs.slice(0, 4).map((log) => (
                <div key={log.id} className="p-sm rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-on-surface">{log.actorName}</span>
                    <span className="font-label-mono text-[10px] text-outline">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="font-body-sm text-xs text-on-surface-variant">{log.action}</p>
                  <div className="font-label-mono text-[10px] text-outline">
                    Target: {log.target} • Scope: {log.saccoId}
                  </div>
                </div>
              ))
            ) : (
              [
                {
                  id: 'demo-1',
                  actorName: 'System Admin (SA-01)',
                  action: 'Updated Feature Flag: overspeedLimitDisplayed to 100% rollout',
                  target: 'Global Client Config',
                  timestamp: new Date().toISOString(),
                },
                {
                  id: 'demo-2',
                  actorName: 'System Admin (SA-01)',
                  action: 'Verified MetroLink Express SACCO Compliance Documents',
                  target: 'SACCO #REC-2026-89',
                  timestamp: new Date(Date.now() - 1800000).toISOString(),
                },
              ].map((log) => (
                <div key={log.id} className="p-sm rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-on-surface">{log.actorName}</span>
                    <span className="font-label-mono text-[10px] text-outline">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="font-body-sm text-xs text-on-surface-variant">{log.action}</p>
                  <div className="font-label-mono text-[10px] text-outline">Target: {log.target}</div>
                </div>
              ))
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
              <Badge variant="warning">3 Pending Reviews</Badge>
            </div>

            <div className="space-y-sm">
              <div className="p-sm rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono text-xs font-bold text-on-surface">
                    Flagged Hazard Report #R-992
                  </span>
                  <Badge variant="danger">High Severity</Badge>
                </div>
                <p className="font-body-sm text-xs text-on-surface">
                  Commuter reported dangerous unmarked bump on A104 Waiyaki Way near Kangemi.
                </p>
                <div className="font-label-mono text-[10px] text-outline">
                  Reported by 3 distinct passengers
                </div>
              </div>

              <div className="p-sm rounded-xl border border-outline-variant/20 bg-surface-container-low space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono text-xs font-bold text-on-surface">
                    Disputed Violation #V-4081
                  </span>
                  <Badge variant="warning">Dispute</Badge>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  MetroLink Express driver disputing 94 km/h speed breach logged at 14:10 PM.
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            className="w-full justify-center gap-2 mt-md"
            onClick={() => navigate('/admin/moderation')}
          >
            <span className="material-symbols-outlined text-lg">rate_review</span>
            Review Moderation Queue Now
          </Button>
        </div>
      </div>
    </div>
  );
};
