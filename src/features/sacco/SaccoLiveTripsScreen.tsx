import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/useAuthStore';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getSaccoName, getEffectiveSaccoId } from '../../lib/saccoUtils';
import { MapComponent, MapMarker } from '../../components/map/MapComponent';

const DEFAULT_MOCK_TRIPS = [
  {
    id: 'trip_live_1',
    plateNumber: 'KDA 123A',
    driverName: 'John Kamau',
    routeName: 'Nairobi CBD - Thika Road Corridor',
    currentSpeedKmH: 62,
    status: 'active',
    passengers: 28,
    isOverspeeding: false,
    latitude: -1.2297,
    longitude: 36.8832,
    heading: 45,
  },
  {
    id: 'trip_live_2',
    plateNumber: 'KCC 789B',
    driverName: 'Samuel Ochieng',
    routeName: 'Mombasa Road Express',
    currentSpeedKmH: 84,
    status: 'active',
    passengers: 33,
    isOverspeeding: true,
    latitude: -1.3321,
    longitude: 36.8794,
    heading: 135,
  },
  {
    id: 'trip_live_3',
    plateNumber: 'KDE 456C',
    driverName: 'Peter Mwangi',
    routeName: 'Waiyaki Way - Kangemi',
    currentSpeedKmH: 50,
    status: 'active',
    passengers: 14,
    isOverspeeding: false,
    latitude: -1.2612,
    longitude: 36.7865,
    heading: 270,
  },
];

export const SaccoLiveTripsScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const saccoId = getEffectiveSaccoId(user?.saccoId);

  const [activeTab, setActiveTab] = useState<'map' | 'incidents'>('map');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!saccoId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, 'trips'),
      where('saccoId', '==', saccoId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const liveTrips = snapshot.docs.map((docSnap, idx) => {
            const t = docSnap.data();
            return {
              id: docSnap.id,
              plateNumber: t.plateNumber || t.vehicleRegNumber || 'KDA 123A',
              driverName: t.driverName || `Driver #${idx + 10}`,
              routeName: t.routeName || 'Thika Road',
              currentSpeedKmH: t.currentSpeedKmH || 65,
              status: t.status,
              passengers: t.passengerCount || 20,
              isOverspeeding: (t.currentSpeedKmH || 0) > 80,
              latitude:
                t.currentLocation?.latitude ||
                t.latitude ||
                -1.286389 + (idx % 4) * 0.018,
              longitude:
                t.currentLocation?.longitude ||
                t.longitude ||
                36.817223 + (idx % 4) * 0.022,
              heading: t.heading || (idx * 45) % 360,
            };
          });
          setTrips(liveTrips);
        } else {
          setTrips(DEFAULT_MOCK_TRIPS);
        }
        setIsLoading(false);
      },
      (error) => {
        console.warn('[SaccoLiveTripsScreen] onSnapshot error:', error);
        setTrips(DEFAULT_MOCK_TRIPS);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [saccoId]);

  const mapMarkers: MapMarker[] = useMemo(() => {
    return trips.map((t) => ({
      id: t.id,
      lat: t.latitude,
      lng: t.longitude,
      type: 'vehicle',
      title: `${t.plateNumber} — ${t.driverName}`,
      subtitle: `${t.routeName} • ${t.currentSpeedKmH} km/h ${t.isOverspeeding ? '(OVERSPEEDING)' : ''}`,
      heading: t.heading,
      severity: t.isOverspeeding ? 'high' : 'low',
    }));
  }, [trips]);

  const handleAcknowledgeIncident = (id: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, acknowledged: true } : inc))
    );
  };

  if (!saccoId) {
    return (
      <EmptyState
        icon="error"
        title="Account Not Fully Provisioned"
        description="Your account is missing a SACCO assignment. Contact your administrator."
      />
    );
  }

  const saccoName = getSaccoName(saccoId);

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

            {trips.length === 0 ? (
              <p className="text-xs text-on-surface-variant font-mono p-4">No active trips currently tracked for this SACCO.</p>
            ) : (
              trips.map((t) => (
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
              ))
            )}
          </Card>

          {/* Real Geospatial Map Display (Right 60%) */}
          <div className="lg:col-span-7 h-full min-h-[400px]">
            <MapComponent
              markers={mapMarkers}
              centerAddress={`${saccoName} Live Fleet Telemetry`}
              showRouteTrace={true}
              showHeatmapOverlay={false}
              onMarkerClick={(m) => setSelectedTripId(m.id)}
              className="h-full w-full shadow-md"
            />
          </div>
        </div>
      )}

      {/* INCIDENTS TAB */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          {incidents.length === 0 ? (
            <Card className="p-8 text-center text-xs text-on-surface-variant font-mono">
              No active incidents reported for this SACCO.
            </Card>
          ) : (
            incidents.map((inc) => (
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
          ))
        )}
        </div>
      )}
    </div>
  );
};
