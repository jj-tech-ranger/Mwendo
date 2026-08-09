import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { tripRepository, alertRepository } from '../../repositories';
import { where } from 'firebase/firestore';

export const SaccoLiveTripsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const saccoId = user?.saccoId || 'sacco_metrolink';
  const saccoName = saccoId === 'sacco_greenline' ? 'GreenLine SACCO' : 'MetroLink SACCO';

  const [activeTab, setActiveTab] = useState<'map' | 'incidents'>('map');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const [trips, setTrips] = useState<any[]>([
    {
      id: 't_1',
      plateNumber: saccoId === 'sacco_greenline' ? 'KDC 101G' : 'KDA 123A',
      driverName: 'Driver #22',
      routeName: 'Thika Superhighway',
      currentSpeedKmH: 74,
      status: 'active',
      passengers: 28,
      isOverspeeding: false,
    },
    {
      id: 't_2',
      plateNumber: saccoId === 'sacco_greenline' ? 'KDC 202G' : 'KCB 450Z',
      driverName: 'Driver #45',
      routeName: 'Mombasa Road',
      currentSpeedKmH: 89,
      status: 'active',
      passengers: 14,
      isOverspeeding: true,
    },
    {
      id: 't_3',
      plateNumber: saccoId === 'sacco_greenline' ? 'KDC 303G' : 'KDD 555M',
      driverName: 'Driver #12',
      routeName: 'Waiyaki Way',
      currentSpeedKmH: 62,
      status: 'active',
      passengers: 32,
      isOverspeeding: false,
    },
  ]);

  const [incidents, setIncidents] = useState<any[]>([
    {
      id: 'inc_1',
      type: 'Overspeed Alert',
      plate: saccoId === 'sacco_greenline' ? 'KDC 202G' : 'KCB 450Z',
      speed: '89 km/h (Limit: 80)',
      location: 'Mombasa Rd - Near Cabanas',
      time: '3 mins ago',
      severity: 'high',
      acknowledged: false,
    },
    {
      id: 'inc_2',
      type: 'Black Spot Proximity',
      plate: saccoId === 'sacco_greenline' ? 'KDC 101G' : 'KDA 123A',
      speed: '74 km/h',
      location: 'Thika Rd - Survey of Kenya',
      time: '12 mins ago',
      severity: 'medium',
      acknowledged: true,
    },
  ]);

  useEffect(() => {
    async function loadLiveData() {
      try {
        const liveTrips = await tripRepository.getAll([where('saccoId', '==', saccoId)]);
        if (liveTrips.length > 0) {
          setTrips(
            liveTrips.map((t, idx) => ({
              id: t.id,
              plateNumber: t.plateNumber || t.vehicleRegNumber || 'KDA 123A',
              driverName: t.driverName || `Driver #${idx + 10}`,
              routeName: t.routeName || 'Thika Road',
              currentSpeedKmH: t.currentSpeedKmH || 65,
              status: t.status,
              passengers: t.passengerCount || 20,
              isOverspeeding: (t.currentSpeedKmH || 0) > 80,
            }))
          );
        }
      } catch (err) {
        console.warn('Error loading live trip data:', err);
      }
    }
    loadLiveData();
  }, [saccoId]);

  const handleAcknowledgeIncident = (id: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, acknowledged: true } : inc))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'map'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Live Operations Map ({trips.length} Active)
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'incidents'
                ? 'bg-error text-on-error'
                : 'bg-error/10 text-error hover:bg-error/20'
            }`}
          >
            <span className="material-symbols-outlined text-base">warning</span>
            Active Incidents ({incidents.filter((i) => !i.acknowledged).length})
          </button>
        </div>

        <Badge variant="success" className="font-mono text-xs">
          Live GPS Telemetry: Connected
        </Badge>
      </div>

      {/* MAP TAB */}
      {activeTab === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[600px]">
          {/* Active Trip List (Left 40%) */}
          <Card className="lg:col-span-5 p-4 flex flex-col space-y-3 overflow-y-auto">
            <h3 className="font-bold text-xs uppercase font-mono text-on-surface-variant">
              Active Vehicles On Route — {saccoName}
            </h3>

            {trips.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTripId(t.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedTripId === t.id
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : t.isOverspeeding
                    ? 'border-error/50 bg-error/5'
                    : 'border-outline-variant/30 bg-surface-container/50 hover:bg-surface-container'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-primary text-sm">{t.plateNumber}</span>
                  <Badge variant={t.isOverspeeding ? 'danger' : 'success'} className="font-mono text-[10px]">
                    {t.currentSpeedKmH} km/h
                  </Badge>
                </div>
                <div className="text-xs text-on-surface-variant mt-1 flex justify-between">
                  <span>{t.routeName}</span>
                  <span>{t.driverName}</span>
                </div>
              </div>
            ))}
          </Card>

          {/* Interactive Live Map Display (Right 60%) */}
          <Card className="lg:col-span-7 p-0 overflow-hidden relative border border-outline-variant/30 flex flex-col bg-slate-900">
            {/* Map Canvas Mockup with Live Vehicle Markers */}
            <div className="flex-1 w-full relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] p-6 flex items-center justify-center">
              <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur-xs text-white p-2.5 rounded-xl text-xs font-mono border border-slate-700 space-y-1">
                <div className="font-bold text-emerald-400">Nairobi Metro Highway Feed</div>
                <div className="text-[10px] text-slate-400">Scoped Tenant: {saccoId}</div>
              </div>

              {/* Map Simulated Routes & Vehicle Pins */}
              <div className="w-full h-full relative flex items-center justify-center">
                {/* Simulated Road Lane */}
                <div className="absolute w-3/4 h-1 bg-slate-700 transform -rotate-12 rounded-full" />
                <div className="absolute w-2/3 h-1 bg-slate-700 transform rotate-45 rounded-full" />

                {/* Vehicle Markers */}
                <div className="absolute top-1/3 left-1/3 flex flex-col items-center group cursor-pointer">
                  <span className="material-symbols-outlined text-2xl text-emerald-400 animate-bounce">
                    navigation
                  </span>
                  <span className="bg-emerald-950 text-emerald-200 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500">
                    {trips[0]?.plateNumber || 'KDA 123A'} (74 km/h)
                  </span>
                </div>

                <div className="absolute bottom-1/3 right-1/4 flex flex-col items-center group cursor-pointer">
                  <span className="material-symbols-outlined text-2xl text-error animate-ping">
                    warning
                  </span>
                  <span className="bg-red-950 text-red-200 text-[10px] font-mono px-2 py-0.5 rounded border border-red-500 font-bold">
                    {trips[1]?.plateNumber || 'KCB 450Z'} (89 km/h - OVERSPEED)
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* INCIDENTS TAB */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          {incidents.map((inc) => (
            <Card
              key={inc.id}
              className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 ${
                inc.severity === 'high' ? 'border-l-error bg-error/5' : 'border-l-amber-500'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={inc.severity === 'high' ? 'danger' : 'warning'} className="uppercase font-mono text-[10px]">
                    {inc.type}
                  </Badge>
                  <span className="font-mono font-bold text-sm text-primary">{inc.plate}</span>
                  <span className="text-xs text-on-surface-variant font-mono">• {inc.time}</span>
                </div>
                <div className="text-xs font-bold text-on-surface">{inc.speed} — {inc.location}</div>
              </div>

              <div className="flex items-center gap-2">
                {inc.acknowledged ? (
                  <Badge variant="success" className="font-bold">
                    Acknowledged
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    className="font-bold text-xs"
                    onClick={() => handleAcknowledgeIncident(inc.id)}
                  >
                    Acknowledge Alert
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
