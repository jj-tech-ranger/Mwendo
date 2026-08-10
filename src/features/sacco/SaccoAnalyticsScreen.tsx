import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore } from '../../store/useAuthStore';
import { driverRepository, vehicleRepository } from '../../repositories';
import { where } from 'firebase/firestore';
import { Driver, Vehicle } from '../../types';

export const SaccoAnalyticsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const saccoId = user?.saccoId || 'sacco_metrolink';
  const saccoName = saccoId === 'sacco_greenline' ? 'GreenLine SACCO' : 'MetroLink SACCO';

  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'leaderboards'>('analytics');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [dList, vList] = await Promise.all([
          driverRepository.getAll([where('saccoId', '==', saccoId)]),
          vehicleRepository.getAll([where('saccoId', '==', saccoId)]),
        ]);
        setDrivers(dList);
        setVehicles(vList);
      } catch (err) {
        console.warn('Error loading analytics data:', err);
      }
    }
    loadData();
  }, [saccoId]);

  const topDrivers = [...drivers].sort((a, b) => b.safetyScore - a.safetyScore);
  const flaggedVehicles = vehicles.filter((v) => v.status === 'suspended' || v.status === 'maintenance');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="text-lg font-black text-on-surface">Analytics & Fleet Performance — {saccoName}</h1>
          <p className="text-xs text-on-surface-variant">Real-time driver safety rankings, speed distribution, and corridor trends</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeSubTab === 'analytics' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Fleet Analytics
          </button>
          <button
            onClick={() => setActiveSubTab('leaderboards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeSubTab === 'leaderboards' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Driver Leaderboards
          </button>
        </div>
      </div>

      {activeSubTab === 'analytics' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 space-y-1">
              <span className="text-xs font-mono uppercase text-on-surface-variant">Average Speed Score</span>
              <div className="text-2xl font-black font-mono text-emerald-700">
                {drivers.length > 0
                  ? `${Math.round(drivers.reduce((acc, d) => acc + d.safetyScore, 0) / drivers.length)} / 100`
                  : '-- / 100'}
              </div>
            </Card>
            <Card className="p-5 space-y-1">
              <span className="text-xs font-mono uppercase text-on-surface-variant font-bold">Active Fleet Count</span>
              <div className="text-2xl font-black font-mono text-amber-600">{vehicles.length} Vehicles</div>
            </Card>
            <Card className="p-5 space-y-1">
              <span className="text-xs font-mono uppercase text-on-surface-variant">Active Drivers</span>
              <div className="text-2xl font-black font-mono text-primary">{drivers.length} Drivers</div>
            </Card>
          </div>

          <Card className="p-6 space-y-4">
            <h3 className="font-bold text-sm text-on-surface">Corridor Speed Compliance Breakdown</h3>
            <p className="text-xs text-on-surface-variant font-mono">
              {vehicles.length === 0
                ? 'No corridor telemetry recorded yet. Register vehicles to track compliance.'
                : 'Telemetry monitoring active across registered SACCO routes.'}
            </p>
          </Card>
        </div>
      ) : (
        /* LEADERBOARDS SUB TAB (§19) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500">workspace_premium</span>
              Safest Drivers (Top Rated)
            </h3>
            <div className="space-y-3 text-xs font-medium">
              {topDrivers.length === 0 ? (
                <p className="text-xs text-on-surface-variant font-mono">No drivers registered yet.</p>
              ) : (
                topDrivers.slice(0, 5).map((d, idx) => (
                  <div key={d.id} className="p-3 bg-surface-container rounded-xl flex items-center justify-between border border-outline-variant/20">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-amber-600">#{idx + 1}</span>
                      <div>
                        <div className="font-bold">{d.name}</div>
                        <div className="text-[10px] text-on-surface-variant font-mono">{d.totalTrips || 0} trips completed</div>
                      </div>
                    </div>
                    <Badge variant="success" className="font-mono font-bold">
                      {d.safetyScore}/100
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-error">warning</span>
              Vehicles Needing Attention
            </h3>
            <div className="space-y-3 text-xs font-medium">
              {flaggedVehicles.length === 0 ? (
                <p className="text-xs text-on-surface-variant font-mono">No vehicles flagged for safety concerns.</p>
              ) : (
                flaggedVehicles.map((v) => (
                  <div key={v.id} className="p-3 bg-surface-container rounded-xl flex items-center justify-between border border-error/30">
                    <div>
                      <div className="font-mono font-bold text-primary">{v.regNumber}</div>
                      <div className="text-[10px] text-on-surface-variant">Capacity: {v.capacity} pax</div>
                    </div>
                    <Badge variant="danger" className="font-mono font-bold">
                      {v.status.toUpperCase()}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
