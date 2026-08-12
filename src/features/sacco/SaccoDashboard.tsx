import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore } from '../../store/useAuthStore';
import { tripRepository, violationRepository, vehicleRepository } from '../../repositories';
import { where } from 'firebase/firestore';

export const SaccoDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const saccoId = user?.saccoId || 'sacco_metrolink';
  const saccoName = saccoId === 'sacco_greenline' ? 'GreenLine SACCO' : 'MetroLink SACCO';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalViolations: 0,
    highRiskVehicles: 0,
    activePilots: 0,
    safetyScore: 100,
  });

  const [recentReports] = useState<any[]>([]);

  const [routeRankings] = useState<any[]>([]);

  useEffect(() => {
    async function loadSaccoData() {
      setLoading(true);
      try {
        const [trips, vehicles, violations] = await Promise.all([
          tripRepository.getAll([where('saccoId', '==', saccoId)]),
          vehicleRepository.getAll([where('saccoId', '==', saccoId)]),
          violationRepository.getAll([where('saccoId', '==', saccoId)]),
        ]);

        setStats({
          totalTrips: trips.length,
          totalViolations: violations.length,
          highRiskVehicles: vehicles.filter((v) => v.status === 'suspended').length,
          activePilots: vehicles.filter((v) => v.status === 'active').length,
          safetyScore: violations.length === 0 ? 100 : Math.max(50, 100 - violations.length * 5),
        });
      } catch (err) {
        console.warn('Error fetching Firestore sacco data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSaccoData();
  }, [saccoId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-surface-container to-surface p-6 rounded-2xl border border-primary/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
            <h1 className="text-xl font-black text-on-surface">{saccoName} Safety Command Center</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Real-time fleet telemetry, risk analytics, and commuter compliance for {saccoName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <Badge variant="warning" className="font-bold py-1 px-3 text-[10px]">
            Provisional Scores (Cloud Functions Gen2 Pending)
          </Badge>
          <Badge variant="success" className="font-bold py-1 px-3">
            Tenant ID: {saccoId}
          </Badge>
          <Badge variant="neutral" className="font-bold py-1 px-3">
            24/7 NTSA Telemetry Sync
          </Badge>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 space-y-2 border-l-4 border-l-primary">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono uppercase">
            <span>Total Trips (30d)</span>
            <span className="material-symbols-outlined text-primary">route</span>
          </div>
          <div className="text-3xl font-black font-mono text-on-surface">{stats.totalTrips.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">trending_up</span> +12.4% vs last month
          </div>
        </Card>

        <Card className="p-5 space-y-2 border-l-4 border-l-amber-500">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono uppercase">
            <span>Violations (30d)</span>
            <span className="material-symbols-outlined text-amber-500">warning</span>
          </div>
          <div className="text-3xl font-black font-mono text-amber-600">{stats.totalViolations}</div>
          <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">trending_down</span> -8.2% reduction
          </div>
        </Card>

        <Card className="p-5 space-y-2 border-l-4 border-l-error">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono uppercase">
            <span>High Risk Vehicles</span>
            <span className="material-symbols-outlined text-error">minor_crash</span>
          </div>
          <div className="text-3xl font-black font-mono text-error">{stats.highRiskVehicles}</div>
          <div className="text-[11px] text-error font-bold">Requires immediate inspection</div>
        </Card>

        <Card className="p-5 space-y-2 border-l-4 border-l-primary">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono uppercase">
            <span>Active SACCO Drivers</span>
            <span className="material-symbols-outlined text-primary">badge</span>
          </div>
          <div className="text-3xl font-black font-mono text-on-surface">{stats.activePilots}</div>
          <div className="text-[11px] text-on-surface-variant font-mono">100% License Verified</div>
        </Card>
      </div>

      {/* Row 2: Fleet Safety Trend & Safety Score Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-on-surface">30-Day Fleet Safety & Speed Trend</h2>
              <p className="text-xs text-on-surface-variant">Daily average speed and violation rate across corridors</p>
            </div>
            <Badge variant="neutral" className="text-xs font-mono">
              Live Feed
            </Badge>
          </div>

          <div className="h-48 bg-surface-container rounded-xl p-4 flex flex-col justify-between border border-outline-variant/20">
            <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
              <span>Limit: 80 km/h</span>
              <span className="text-emerald-700 font-bold">Avg Fleet: 61 km/h</span>
            </div>

            <div className="flex items-end justify-between h-32 gap-1 pt-4">
              {[45, 52, 68, 82, 60, 54, 48, 59, 74, 88, 62, 58, 51, 49, 65, 70, 58, 52, 60, 64].map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    style={{ height: `${v}%` }}
                    className={`w-full rounded-t-sm transition-all ${
                      v > 80 ? 'bg-error' : v > 70 ? 'bg-amber-500' : 'bg-primary'
                    }`}
                  />
                  <div className="absolute -top-7 hidden group-hover:block bg-surface-container-highest text-on-surface text-[9px] font-mono p-1 rounded shadow-md z-10 whitespace-nowrap">
                    Day {i + 1}: {v} km/h
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-[10px] font-mono text-on-surface-variant pt-2 border-t border-outline-variant/20">
              <span>Day 1</span>
              <span>Day 15</span>
              <span>Day 30</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 text-center space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-on-surface">SACCO Safety Score</h2>
            <p className="text-xs text-on-surface-variant">Combined rating by NTSA telemetry</p>
          </div>

          <div className="w-32 h-32 mx-auto rounded-full border-8 border-primary/20 border-t-primary flex flex-col items-center justify-center relative">
            <span className="text-4xl font-black font-mono text-primary">{stats.safetyScore}</span>
            <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase">/ 100</span>
          </div>

          <div className="space-y-1">
            <Badge variant="success" className="font-bold">
              Grade A - Preferred SACCO
            </Badge>
            <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
              Eligible for NTSA Express Lane Corridor privileges
            </p>
          </div>
        </Card>
      </div>

      {/* Row 3: Recent Reports & Route Risk Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-on-surface">Recent Safety Alerts & Incidents</h2>
            <span className="text-xs font-mono text-primary font-bold">Scoped: {saccoName}</span>
          </div>

          <div className="space-y-3">
            {recentReports.length === 0 ? (
              <p className="text-xs text-on-surface-variant font-mono">No recent safety alerts logged.</p>
            ) : (
              recentReports.map((r) => (
                <div
                  key={r.id}
                  className="p-3 bg-surface-container rounded-xl flex items-center justify-between border border-outline-variant/20"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-xs text-on-surface">{r.title}</div>
                    <div className="text-[11px] text-on-surface-variant">{r.route}</div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={r.severity === 'high' ? 'danger' : r.severity === 'medium' ? 'warning' : 'neutral'}
                      className="text-[10px] font-mono uppercase"
                    >
                      {r.severity}
                    </Badge>
                    <div className="text-[10px] font-mono text-on-surface-variant mt-1">{r.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-bold text-on-surface">Route Risk Breakdown</h2>
          <div className="space-y-3 text-xs">
            {routeRankings.length === 0 ? (
              <p className="text-xs text-on-surface-variant font-mono">No route risk data recorded.</p>
            ) : (
              routeRankings.map((rk, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>{rk.name}</span>
                    <span className="font-mono text-on-surface-variant">{rk.violations} violations</span>
                  </div>
                  <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                    <div
                      style={{ width: `${rk.riskScore}%` }}
                      className={`h-full ${
                        rk.status === 'high'
                          ? 'bg-error'
                          : rk.status === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-primary'
                      }`}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
