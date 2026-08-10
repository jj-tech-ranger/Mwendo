import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { PieChartWrapper } from '../../components/charts/Charts';
import { userRepository, saccoRepository } from '../../repositories';
import { SACCO, UserProfile } from '../../types';

export const AdminAnalyticsScreen: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [saccos, setSaccos] = useState<SACCO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [uList, sList] = await Promise.all([
          userRepository.getAll(),
          saccoRepository.getAll(),
        ]);
        setUsers(uList);
        setSaccos(sList);
      } catch (err) {
        console.error('Error loading analytics data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute actual role distribution
  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const roleDistribution = [
    { name: 'Passengers', value: roleCounts['passenger'] || 0, color: '#185FA5' },
    { name: 'SACCO Officials', value: roleCounts['sacco_official'] || 0, color: '#1A5C2E' },
    { name: 'Authorities', value: roleCounts['authority'] || 0, color: '#D97706' },
    { name: 'System Admins', value: roleCounts['admin'] || 0, color: '#DC2626' },
  ].filter((r) => r.value > 0);

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Platform Analytics & Safety Intelligence
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Analytics on commuter adoption, registered SACCO fleets, and platform roles.
          </p>
        </div>

        <Badge variant="info">Live Database Metrics</Badge>
      </div>

      {/* Main Grid: User Roles & SACCO Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <h3 className="font-headline-lg-mobile text-sm text-on-surface font-bold border-b border-outline-variant/20 pb-sm">
            Registered User Demographics ({users.length} total)
          </h3>
          {roleDistribution.length > 0 ? (
            <PieChartWrapper data={roleDistribution} height={200} />
          ) : (
            <p className="text-xs text-on-surface-variant font-mono p-4">
              No registered user demographics data yet.
            </p>
          )}
        </div>

        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <h3 className="font-headline-lg-mobile text-sm text-on-surface font-bold border-b border-outline-variant/20 pb-sm">
            Registered SACCO Performance Leaderboard ({saccos.length} total)
          </h3>

          <div className="overflow-x-auto">
            {saccos.length === 0 ? (
              <p className="text-xs text-on-surface-variant font-mono p-4">
                No SACCOs registered in the database yet.
              </p>
            ) : (
              <table className="w-full text-left text-xs font-body-sm">
                <thead className="bg-surface-container-low font-label-mono text-[10px] text-on-surface-variant uppercase border-b border-outline-variant/20">
                  <tr>
                    <th className="p-sm">Rank</th>
                    <th className="p-sm">SACCO Name</th>
                    <th className="p-sm">Registered Code</th>
                    <th className="p-sm">Safety Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-body-sm">
                  {saccos.map((sacco, idx) => (
                    <tr key={sacco.id}>
                      <td className="p-sm font-label-mono font-bold text-primary">#{idx + 1}</td>
                      <td className="p-sm font-bold text-on-surface">{sacco.name}</td>
                      <td className="p-sm font-label-mono">{sacco.registrationCode || sacco.id}</td>
                      <td className="p-sm font-label-mono font-bold text-emerald-600">
                        {sacco.safetyScore || 100} / 100
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
