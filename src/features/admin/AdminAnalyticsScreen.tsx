import React from 'react';
import { Badge } from '../../components/ui/Badge';
import { AreaChartWrapper, LineChartWrapper, PieChartWrapper } from '../../components/charts/Charts';

export const AdminAnalyticsScreen: React.FC = () => {
  const userGrowthData = [
    { month: 'May', passengers: 38000, officials: 1100, authorities: 120 },
    { month: 'Jun', passengers: 42000, officials: 1250, authorities: 140 },
    { month: 'Jul', passengers: 47000, officials: 1380, authorities: 150 },
    { month: 'Aug', passengers: 52340, officials: 1420, authorities: 160 },
  ];

  const tripsVsViolationsData = [
    { month: 'May', trips: 142000, violations: 1820 },
    { month: 'Jun', trips: 168000, violations: 1540 },
    { month: 'Jul', trips: 195000, violations: 1320 },
    { month: 'Aug', trips: 214880, violations: 980 },
  ];

  const roleDistribution = [
    { name: 'Passengers', value: 52340, color: '#185FA5' },
    { name: 'SACCO Officials', value: 1420, color: '#1A5C2E' },
    { name: 'Authorities', value: 160, color: '#D97706' },
    { name: 'System Admins', value: 12, color: '#DC2626' },
  ];

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Platform Analytics & Safety Trend Intelligence
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Macro-level analytics on commuter adoption, trip volume, and overspeed reduction.
          </p>
        </div>

        <Badge variant="info">Live Macro Data</Badge>
      </div>

      {/* Top Row Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* User Growth Chart */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="border-b border-outline-variant/20 pb-sm">
            <h3 className="font-headline-lg-mobile text-sm text-on-surface font-bold">
              User Registration & Role Expansion
            </h3>
            <p className="font-body-sm text-[11px] text-on-surface-variant">
              Cumulative passenger onboarding vs official transport personnel
            </p>
          </div>

          <AreaChartWrapper
            data={userGrowthData}
            xKey="month"
            areas={[
              { key: 'passengers', name: 'Commuter Passengers', color: '#185FA5' },
              { key: 'officials', name: 'SACCO Officials', color: '#1A5C2E' },
            ]}
            height={240}
          />
        </div>

        {/* Trips vs Violations Reduction Chart */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="border-b border-outline-variant/20 pb-sm">
            <h3 className="font-headline-lg-mobile text-sm text-on-surface font-bold">
              Trip Ingestion vs Speed Violation Decline
            </h3>
            <p className="font-body-sm text-[11px] text-on-surface-variant">
              Demonstrating the safety impact of real-time speed governor monitoring
            </p>
          </div>

          <LineChartWrapper
            data={tripsVsViolationsData}
            xKey="month"
            lines={[
              { key: 'trips', name: 'Trips Completed', color: '#1A5C2E' },
              { key: 'violations', name: 'Overspeed Violations', color: '#DC2626' },
            ]}
            height={240}
          />
        </div>
      </div>

      {/* Bottom Row: Donut Chart & SACCO Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <h3 className="font-headline-lg-mobile text-sm text-on-surface font-bold border-b border-outline-variant/20 pb-sm">
            User Demographics
          </h3>
          <PieChartWrapper data={roleDistribution} height={200} />
        </div>

        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <h3 className="font-headline-lg-mobile text-sm text-on-surface font-bold border-b border-outline-variant/20 pb-sm">
            Top SACCO Safety Performance Leaderboard
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-body-sm">
              <thead className="bg-surface-container-low font-label-mono text-[10px] text-on-surface-variant uppercase border-b border-outline-variant/20">
                <tr>
                  <th className="p-sm">Rank</th>
                  <th className="p-sm">SACCO Name</th>
                  <th className="p-sm">Fleet Size</th>
                  <th className="p-sm">Safety Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 font-body-sm">
                <tr>
                  <td className="p-sm font-label-mono font-bold text-primary">#1</td>
                  <td className="p-sm font-bold text-on-surface">2NK Sacco</td>
                  <td className="p-sm font-label-mono">142 Vehicles</td>
                  <td className="p-sm font-label-mono font-bold text-emerald-600">94 / 100</td>
                </tr>
                <tr>
                  <td className="p-sm font-label-mono font-bold text-primary">#2</td>
                  <td className="p-sm font-bold text-on-surface">Super Metro Sacco</td>
                  <td className="p-sm font-label-mono">280 Vehicles</td>
                  <td className="p-sm font-label-mono font-bold text-emerald-600">91 / 100</td>
                </tr>
                <tr>
                  <td className="p-sm font-label-mono font-bold text-primary">#3</td>
                  <td className="p-sm font-bold text-on-surface">MetroLink Express</td>
                  <td className="p-sm font-label-mono">38 Vehicles</td>
                  <td className="p-sm font-label-mono font-bold text-amber-600">78 / 100</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
