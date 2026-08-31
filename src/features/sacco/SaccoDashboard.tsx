import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/useAuthStore';
import { tripRepository, violationRepository, vehicleRepository, complaintRepository, analyticsRepository } from '../../repositories';
import { calculateSaccoSafetyScore } from '../../lib/engine';
import { where } from 'firebase/firestore';
import { getSaccoName, getEffectiveSaccoId } from '../../lib/saccoUtils';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';
import { toStandardDate } from '../../lib/utils';
import { Trip } from '../../types';
import { useMotionPresets } from '../../lib/motion';

interface RecentReportItem {
  id: string;
  title: string;
  route: string;
  severity: 'low' | 'medium' | 'high';
  time: string;
}

interface RouteRankingItem {
  name: string;
  violations: number;
  riskScore: number;
  status: 'low' | 'medium' | 'high';
}

export const SaccoDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const saccoId = getEffectiveSaccoId(user?.saccoId);
  const { variants } = useMotionPresets();

  const [recentReports] = useState<RecentReportItem[]>([]);
  const [routeRankings] = useState<RouteRankingItem[]>([]);

  const { data: stats = {
    totalTrips: 0,
    totalViolations: 0,
    highRiskVehicles: 0,
    activePilots: 0,
    safetyScore: null,
    trips: [] as Trip[],
  }, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ['saccoDashboardStats', saccoId],
    queryFn: async () => {
      if (!saccoId) {
        return {
          totalTrips: 0,
          totalViolations: 0,
          highRiskVehicles: 0,
          activePilots: 0,
          safetyScore: null,
          trips: [],
        };
      }

      const [trips, vehicles, violations, complaints, precomputedDoc] = await Promise.all([
        tripRepository.getAll([where('saccoId', '==', saccoId)]),
        vehicleRepository.getAll([where('saccoId', '==', saccoId)]),
        violationRepository.getAll([where('saccoId', '==', saccoId)]),
        complaintRepository.getAll([where('saccoId', '==', saccoId)]),
        analyticsRepository.getById(`sacco_${saccoId}`).catch(() => null),
      ]);

      const vehicleScores = vehicles.map((v) =>
        typeof v.riskScore === 'number' ? v.riskScore : 100
      );
      const unresolvedComplaintsCount = complaints.filter(
        (c) => c.status !== 'resolved'
      ).length;

      const calculatedSafetyScore =
        precomputedDoc && 'safetyScore' in precomputedDoc && typeof precomputedDoc.safetyScore === 'number'
          ? precomputedDoc.safetyScore
          : vehicles.length > 0
          ? calculateSaccoSafetyScore(vehicleScores, unresolvedComplaintsCount)
          : null;

      // Group trips by day for trend
      const dailyTripsMap: { [key: string]: { count: number; totalSpeed: number } } = {};
      trips.forEach((t) => {
        const dateKey = toStandardDate(t.startTime || t.createdAt).toISOString().split('T')[0] || 'today';
        if (!dailyTripsMap[dateKey]) {
          dailyTripsMap[dateKey] = { count: 0, totalSpeed: 0 };
        }
        dailyTripsMap[dateKey].count += 1;
        dailyTripsMap[dateKey].totalSpeed += t.avgSpeedKmH || t.currentSpeedKmH || 0;
      });

      return {
        totalTrips: trips.length,
        totalViolations: violations.length,
        highRiskVehicles: vehicles.filter((v) => v.status === 'suspended').length,
        activePilots: vehicles.filter((v) => v.status === 'active').length,
        safetyScore: calculatedSafetyScore,
        trips,
      };
    },
    enabled: !!saccoId,
    staleTime: QUERY_STALE_TIMES.ANALYTICS_SUMMARIES,
  });

  if (!saccoId) {
    return (
      <EmptyState
        icon="error"
        title="Account Not Fully Provisioned"
        description="Your account is missing a SACCO assignment. Contact your administrator."
      />
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon="error"
        title="We couldn't load the dashboard metrics"
        description="Unable to fetch fleet information and compliance metrics. Please check your connection and try again."
        secondaryCtaLabel="Try Again"
        onSecondaryCta={() => refetch()}
      />
    );
  }

  const saccoName = getSaccoName(saccoId);

  return (
    <motion.div
      variants={variants.staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Top Welcome Banner */}
      <motion.div
        variants={variants.staggerItem}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-surface-container to-surface p-6 rounded-2xl border border-primary/20"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
            <h1 className="text-xl font-black text-on-surface">{saccoName} Safety Command Center</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Real-time fleet operations, risk analytics, and commuter compliance for {saccoName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <Badge variant="success" className="font-bold py-1 px-3">
            Tenant ID: {saccoId}
          </Badge>
          <Badge variant="neutral" className="font-bold py-1 px-3">
            24/7 Safety Monitoring Active
          </Badge>
        </div>
      </motion.div>

      {/* 4 KPI Cards */}
      <motion.div variants={variants.staggerItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 space-y-2 border-l-4 border-l-primary">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono uppercase">
            <span>Total Trips (30d)</span>
            <span className="material-symbols-outlined text-primary">route</span>
          </div>
          <div className="text-3xl font-black font-mono text-on-surface">{stats.totalTrips.toLocaleString()}</div>
          <div className="text-[11px] text-on-surface-variant font-mono">
            {stats.totalTrips > 0 ? 'Verified GPS Trips' : 'No trips logged yet'}
          </div>
        </Card>

        <Card className="p-5 space-y-2 border-l-4 border-l-amber-500">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono uppercase">
            <span>Violations (30d)</span>
            <span className="material-symbols-outlined text-amber-500">warning</span>
          </div>
          <div className="text-3xl font-black font-mono text-amber-600">{stats.totalViolations}</div>
          <div className="text-[11px] text-on-surface-variant font-mono">
            {stats.totalViolations > 0 ? 'Detected infractions' : 'Zero violations recorded'}
          </div>
        </Card>

        <Card className="p-5 space-y-2 border-l-4 border-l-error">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono uppercase">
            <span>High Risk Vehicles</span>
            <span className="material-symbols-outlined text-error">minor_crash</span>
          </div>
          <div className="text-3xl font-black font-mono text-error">{stats.highRiskVehicles}</div>
          <div className="text-[11px] text-on-surface-variant font-mono">
            {stats.highRiskVehicles > 0 ? 'Requires inspection' : 'All vehicles compliant'}
          </div>
        </Card>

        <Card className="p-5 space-y-2 border-l-4 border-l-primary">
          <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono uppercase">
            <span>Active SACCO Drivers</span>
            <span className="material-symbols-outlined text-primary">badge</span>
          </div>
          <div className="text-3xl font-black font-mono text-on-surface">{stats.activePilots}</div>
          <div className="text-[11px] text-on-surface-variant font-mono">
            {stats.activePilots > 0 ? 'Active fleet drivers' : 'No drivers registered'}
          </div>
        </Card>
      </motion.div>

      {/* Row 2: Fleet Safety Trend & Safety Score Donut */}
      <motion.div variants={variants.staggerItem} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          {stats.trips.length > 0 ? (
            <div className="h-48 bg-surface-container rounded-xl p-4 flex flex-col justify-between border border-outline-variant/20">
              <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
                <span>Limit: 80 km/h</span>
                <span className="text-emerald-700 font-bold">Speed Monitoring Active</span>
              </div>

              <div className="flex items-end justify-between h-32 gap-1 pt-4">
                {stats.trips.slice(-20).map((t: Trip, i: number) => {
                  const speed = t.currentSpeedKmH || t.avgSpeedKmH || 40;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        style={{ height: `${Math.min(100, (speed / 100) * 100)}%` }}
                        className={`w-full rounded-t-sm transition-all ${
                          speed > 80 ? 'bg-error' : speed > 70 ? 'bg-amber-500' : 'bg-primary'
                        }`}
                      />
                      <div className="absolute -top-7 hidden group-hover:block bg-surface-container-highest text-on-surface text-[9px] font-mono p-1 rounded shadow-md z-10 whitespace-nowrap">
                        {t.plateNumber || 'Vehicle'}: {speed} km/h
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-[10px] font-mono text-on-surface-variant pt-2 border-t border-outline-variant/20">
                <span>Earliest</span>
                <span>Latest</span>
              </div>
            </div>
          ) : (
            <div className="h-48 bg-surface-container/50 rounded-xl p-4 flex items-center justify-center border border-outline-variant/20">
              <EmptyState
                icon="speed"
                title="No Operational Data Available Yet"
                description="No operational data is available yet."
              />
            </div>
          )}
        </Card>

        <Card className="p-6 text-center space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-on-surface">SACCO Safety Score</h2>
            <p className="text-xs text-on-surface-variant">Combined rating by NTSA safety metrics</p>
          </div>

          <div className="w-32 h-32 mx-auto rounded-full border-8 border-primary/20 border-t-primary flex flex-col items-center justify-center relative">
            <span className="text-4xl font-black font-mono text-primary">
              {stats.safetyScore !== null ? stats.safetyScore : '--'}
            </span>
            <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase">/ 100</span>
          </div>

          <div className="space-y-1">
            {stats.safetyScore !== null ? (
              <>
                <Badge
                  variant={
                    stats.safetyScore >= 80
                      ? 'success'
                      : stats.safetyScore >= 65
                      ? 'warning'
                      : 'danger'
                  }
                  className="font-bold"
                >
                  {stats.safetyScore >= 80
                    ? 'Grade A - Preferred SACCO'
                    : stats.safetyScore >= 65
                    ? 'Grade B - Standard SACCO'
                    : stats.safetyScore >= 50
                    ? 'Grade C - Probationary SACCO'
                    : 'Grade D - High Risk SACCO'}
                </Badge>
                <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
                  {stats.safetyScore >= 80
                    ? 'Eligible for NTSA Express Lane Corridor privileges'
                    : stats.safetyScore >= 65
                    ? 'Standard commercial operating compliance status'
                    : 'Subject to enhanced NTSA roadside compliance checks'}
                </p>
              </>
            ) : (
              <p className="text-xs text-on-surface-variant">No operational data is available yet.</p>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Row 3: Recent Reports & Route Risk Rankings */}
      <motion.div variants={variants.staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </motion.div>
    </motion.div>
  );
};
