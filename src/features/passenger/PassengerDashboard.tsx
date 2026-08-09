import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/useAuthStore';
import { useTripStore } from '../../store/useTripStore';
import { alertRepository, blackSpotRepository, saccoRepository, tripRepository } from '../../repositories';

export const PassengerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { startTrip } = useTripStore();

  const [plateNumber, setPlateNumber] = useState('');
  const [saccoId, setSaccoId] = useState('');
  const [route, setRoute] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [saccos, setSaccos] = useState<Array<{ id: string; name: string }>>([]);
  const [tripsTracked, setTripsTracked] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState(0);
  const [dangerZones, setDangerZones] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const [fetchedSaccos, fetchedTrips, fetchedAlerts, fetchedSpots] = await Promise.all([
          saccoRepository.getAll(),
          tripRepository.getAll(),
          alertRepository.getAll(),
          blackSpotRepository.getAll(),
        ]);

        if (!isMounted) return;
        setSaccos(fetchedSaccos.map((s) => ({ id: s.id, name: s.name })));
        setTripsTracked(fetchedTrips.filter((t) => !user?.id || t.userId === user.id).length);
        setRecentAlerts(fetchedAlerts.filter((a) => !user?.id || a.userId === user.id).length);
        setDangerZones(fetchedSpots.length);
      } catch (err) {
        console.error('Failed to load passenger dashboard data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (saccoId) return;
    if (saccos.length > 0) setSaccoId(saccos[0]!.id);
  }, [saccos, saccoId]);

  const selectedSaccoName = useMemo(() => saccos.find((s) => s.id === saccoId)?.name || '', [saccos, saccoId]);

  const handleStartTrip = () => {
    if (!plateNumber.trim() || !selectedSaccoName.trim() || !route.trim()) return;
    startTrip({
      plateNumber: plateNumber.trim(),
      saccoName: selectedSaccoName,
      routeName: route.trim(),
    });
    navigate('/passenger/start-trip');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <BrandMark className="w-10 h-10" />
          <div>
            <h1 className="text-lg font-black tracking-tight text-on-surface">
              Welcome{user?.displayName ? `, ${user.displayName}` : ''}
            </h1>
            <p className="text-xs text-on-surface-variant font-medium">Mwendo Salama Passenger</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/passenger/alerts')}
          className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined text-2xl">notifications</span>
        </button>
      </div>

      <Card className="p-5 space-y-4 shadow-sm border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">Quick Trip Setup</span>
          <Badge variant="neutral" className="text-[10px]">
            Live GPS
          </Badge>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Enter PSV Plate Number</label>
            <Input
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              placeholder="Enter plate number"
              className="font-mono text-base font-bold uppercase tracking-wider"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">SACCO Organization</label>
            <select
              value={saccoId}
              onChange={(e) => setSaccoId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface text-xs focus:ring-2 focus:ring-primary focus:outline-none"
            >
              {saccos.length === 0 ? (
                <option value="">No SACCOs available</option>
              ) : (
                saccos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Route Corridor</label>
            <Input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Enter route" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button
            onClick={handleStartTrip}
            disabled={!plateNumber.trim() || !selectedSaccoName.trim() || !route.trim()}
            className="w-full h-11 text-sm font-bold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">speed</span>
            Start Trip
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/passenger/report-blackspot')}
            className="w-full h-11 text-sm font-bold flex items-center justify-center gap-2 border-warning text-warning hover:bg-warning/10"
          >
            <span className="material-symbols-outlined text-lg">warning</span>
            Report Black Spot
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-medium">Trips Tracked</span>
            <span className="material-symbols-outlined text-primary text-xl">directions_bus</span>
          </div>
          <div className="text-2xl font-black font-mono text-on-surface">{isLoading ? '—' : tripsTracked}</div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-medium">Recent Alerts</span>
            <span className="material-symbols-outlined text-warning text-xl">notifications_active</span>
          </div>
          <div className="text-2xl font-black font-mono text-on-surface">{isLoading ? '—' : recentAlerts}</div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-medium">Safety Score</span>
            <span className="material-symbols-outlined text-emerald-600 text-xl">verified_user</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-emerald-800">{user?.trustScore ?? 0}</span>
            <span className="text-xs text-on-surface-variant font-mono">/100</span>
          </div>
        </Card>

        <Card className="p-4 space-y-1 border-warning/30 bg-amber-500/5">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-medium">Danger Zones</span>
            <span className="material-symbols-outlined text-amber-600 text-xl">report</span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-800">{isLoading ? '—' : dangerZones}</div>
        </Card>
      </div>
    </div>
  );
};
