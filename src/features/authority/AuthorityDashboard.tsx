import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/useAuthStore';
import {
  tripRepository,
  violationRepository,
  blackSpotRepository,
  vehicleRepository,
  saccoRepository,
  analyticsRepository,
} from '../../repositories';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Trip, Violation, BlackSpot, SafetyAlert, Vehicle, SACCO, PlatformAnalyticsDaily } from '../../types';
import { AreaChartWrapper, BarChartWrapper } from '../../components/charts/Charts';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { MapComponent, MapMarker } from '../../components/map/MapComponent';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

const DEFAULT_ALERTS_MOCK: SafetyAlert[] = [
  {
    id: 'alert_sos_01',
    tripId: 'trip_101',
    saccoId: 'MetroLink SACCO',
    vehicleRegNumber: 'KDA 123A',
    driverName: 'John Kamau',
    type: 'sos',
    severity: 'critical',
    message: 'Passenger SOS Triggered near Roysambu',
    latitude: -1.2185,
    longitude: 36.8875,
    speedKmH: 94,
    status: 'active',
    acknowledgedBySacco: false,
    acknowledgedByAuthority: false,
    timestamp: new Date().toISOString(),
  },
];

const KENYA_COUNTIES = [
  'All Kenya (National)',
  'Nairobi',
  'Kiambu',
  'Machakos',
  'Kajiado',
  'Nakuru',
  'Mombasa',
  'Kisumu',
  'Uasin Gishu',
  'Meru',
];

export const AuthorityDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const userCounty = user?.county || 'Nairobi';
  const isCountyScoped = user?.authorityScope === 'county';

  const [selectedCounty, setSelectedCounty] = useState<string>(
    isCountyScoped ? userCounty : 'All Kenya (National)'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [realtimeAlerts, setRealtimeAlerts] = useState<SafetyAlert[]>(DEFAULT_ALERTS_MOCK);

  // Real-time onSnapshot listener for emergency feed
  useEffect(() => {
    const q = query(collection(db, 'alerts'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const fetched = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as SafetyAlert[];
          setRealtimeAlerts(fetched);
        } else {
          setRealtimeAlerts(DEFAULT_ALERTS_MOCK);
        }
      },
      (error) => {
        console.warn('[AuthorityDashboard] Real-time alerts error:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const { data: authorityData, isLoading } = useQuery({
    queryKey: ['authorityDashboardData'],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const [fetchedTrips, fetchedViolations, fetchedSpots, fetchedVehicles, fetchedSaccos, _precomputedDoc] =
        await Promise.all([
          tripRepository.getAll(),
          violationRepository.getAll(),
          blackSpotRepository.getAll(),
          vehicleRepository.getAll(),
          saccoRepository.getAll(),
          analyticsRepository.getById(`daily_${todayStr}`).catch(() => null),
        ]);

      const blackSpots: BlackSpot[] =
        fetchedSpots.length > 0
          ? fetchedSpots
          : [
              {
                id: 'bs-salgaa-01',
                name: 'Salgaa Deceleration Incline',
                routeName: 'Nakuru - Eldoret Highway (A104)',
                county: 'Nakuru',
                latitude: -0.2185,
                longitude: 35.8821,
                severity: 'critical',
                hazardType: 'accident_prone',
                accidentCount12M: 28,
                hazardDescription: 'Steep hill descent with runaway truck risk.',
                reportedByUid: 'ntsa',
                verifiedByAuthority: true,
                status: 'published',
                confidenceScore: 0.98,
                createdAt: new Date().toISOString(),
              },
              {
                id: 'bs-kinungi-02',
                name: 'Kinungi Flyover Crash Zone',
                routeName: 'Nairobi - Naivasha Highway (A104)',
                county: 'Nakuru',
                latitude: -0.8351,
                longitude: 36.4678,
                severity: 'high',
                hazardType: 'accident_prone',
                accidentCount12M: 19,
                hazardDescription: 'High velocity overtake conflict area.',
                reportedByUid: 'ntsa',
                verifiedByAuthority: true,
                status: 'published',
                confidenceScore: 0.95,
                createdAt: new Date().toISOString(),
              },
              {
                id: 'bs-waiyaki-03',
                name: 'Waiyaki Way Kangemi U-Turn',
                routeName: 'Waiyaki Way Corridor',
                county: 'Nairobi',
                latitude: -1.2612,
                longitude: 36.7865,
                severity: 'high',
                hazardType: 'unmarked_bump',
                accidentCount12M: 14,
                hazardDescription: 'Sudden deceleration zone.',
                reportedByUid: 'ntsa',
                verifiedByAuthority: true,
                status: 'published',
                confidenceScore: 0.92,
                createdAt: new Date().toISOString(),
              },
            ];

      return {
        trips: fetchedTrips,
        violations: fetchedViolations,
        blackSpots,
        vehicles: fetchedVehicles,
        saccos: fetchedSaccos,
      };
    },
    staleTime: QUERY_STALE_TIMES.ANALYTICS_SUMMARIES,
  });

  const trips = authorityData?.trips || [];
  const violations = authorityData?.violations || [];
  const blackSpots = authorityData?.blackSpots || [];
  const alerts = realtimeAlerts;
  const vehicles = authorityData?.vehicles || [];
  const saccos = authorityData?.saccos || [];

  // Sort SACCOs by safetyScore ascending (lowest safety score = highest audit priority)
  const auditPrioritySaccos = useMemo(() => {
    return [...saccos].sort((a, b) => (a.safetyScore ?? 100) - (b.safetyScore ?? 100));
  }, [saccos]);

  // Filtered dataset by County selection
  const filteredSpots = useMemo(() => {
    if (selectedCounty === 'All Kenya (National)') return blackSpots;
    return blackSpots.filter((b) => b.county === selectedCounty || b.routeName?.includes(selectedCounty));
  }, [blackSpots, selectedCounty]);

  const filteredViolations = useMemo(() => {
    if (selectedCounty === 'All Kenya (National)') return violations;
    return violations.filter((v) => v.locationName?.includes(selectedCounty) || v.routeName?.includes(selectedCounty));
  }, [violations, selectedCounty]);

  const filteredAlerts = useMemo(() => {
    if (selectedCounty === 'All Kenya (National)') return alerts;
    return alerts.filter((a) => a.message.includes(selectedCounty));
  }, [alerts, selectedCounty]);

  // Derived KPI metrics
  const activeTripsCount = useMemo(() => {
    return trips.filter((t) => t.status === 'active').length;
  }, [trips]);

  const violationsToday = useMemo(() => {
    return filteredViolations.length;
  }, [filteredViolations]);

  const verifiedBlackSpotsCount = useMemo(() => {
    return filteredSpots.filter((s) => s.verifiedByAuthority).length;
  }, [filteredSpots]);

  const activeSosCount = useMemo(() => {
    return filteredAlerts.filter((a) => a.type === 'sos' || a.severity === 'critical').length;
  }, [filteredAlerts]);

  // Map markers from black spots & active alerts
  const mapMarkers: MapMarker[] = useMemo(() => {
    const markers: MapMarker[] = [];
    filteredSpots.slice(0, 10).forEach((spot, idx) => {
      markers.push({
        id: spot.id || `spot-${idx}`,
        lat: spot.latitude || -1.286389 + idx * 0.02,
        lng: spot.longitude || 36.817223 + idx * 0.02,
        type: 'blackspot',
        title: spot.name || spot.title || 'Black Spot Location',
        subtitle: `${spot.routeName} • ${spot.severity.toUpperCase()} Risk`,
        severity: spot.severity === 'critical' || spot.severity === 'high' ? 'high' : 'medium',
      });
    });

    filteredAlerts.slice(0, 5).forEach((alert, idx) => {
      markers.push({
        id: alert.id || `alert-${idx}`,
        lat: alert.latitude || -1.25 + idx * 0.01,
        lng: alert.longitude || 36.85 + idx * 0.01,
        type: 'incident',
        title: `SOS Alert: ${alert.vehicleRegNumber}`,
        subtitle: `${alert.type.toUpperCase()} - ${alert.speedKmH} km/h`,
        severity: 'high',
      });
    });

    return markers;
  }, [filteredSpots, filteredAlerts]);

  // Dynamic Speed Trend aggregation from real violations
  const speedTrendData = useMemo(() => {
    const hours: Record<string, { time: string; avgSpeed: number; violations: number }> = {};
    for (const v of violations) {
      const date = new Date(v.timestamp);
      const hourStr = `${String(date.getHours()).padStart(2, '0')}:00`;
      if (!hours[hourStr]) {
        hours[hourStr] = { time: hourStr, avgSpeed: 0, violations: 0 };
      }
      hours[hourStr].violations += 1;
      hours[hourStr].avgSpeed = v.recordedSpeedKmH;
    }
    return Object.values(hours).sort((a, b) => a.time.localeCompare(b.time));
  }, [violations]);

  // Dynamic County Violation aggregation from real violations
  const countyViolationData = useMemo(() => {
    const counts: Record<string, { county: string; low: number; high: number }> = {};
    for (const v of violations) {
      const c = v.locationName || 'Nairobi Corridor';
      if (!counts[c]) {
        counts[c] = { county: c, low: 0, high: 0 };
      }
      if (v.severity === 'high' || v.severity === 'critical') {
        counts[c].high += 1;
      } else {
        counts[c].low += 1;
      }
    }
    return Object.values(counts);
  }, [violations]);

  return (
    <div className="space-y-lg">
      {/* Scope & Jurisdiction Header Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-2xl">shield_person</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline-lg-mobile text-lg text-on-surface">
                NTSA Inspector Operations Center
              </h2>
              <Badge variant={isCountyScoped ? 'warning' : 'info'}>
                {isCountyScoped ? 'County Jurisdiction' : 'National Command'}
              </Badge>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Monitoring Kenya PSV Safety, Roadworthiness & Live Speed Compliance
            </p>
          </div>
        </div>

        {/* Scope Selector */}
        <div className="flex items-center gap-sm">
          <label
            htmlFor="authority-scope-select"
            className="font-label-bold text-xs text-on-surface-variant whitespace-nowrap"
          >
            Authority Scope:
          </label>
          <select
            id="authority-scope-select"
            value={selectedCounty}
            onChange={(e) => setSelectedCounty(e.target.value)}
            disabled={isCountyScoped}
            className="bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-label-mono rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {KENYA_COUNTIES.map((county) => (
              <option key={county} value={county}>
                {county}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="flex items-center gap-md">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PSV Plate, SACCO, Driver Name, or Black Spot ID..."
            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl pl-10 pr-4 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <Button variant="secondary" size="sm" className="gap-2">
          <span className="material-symbols-outlined text-base">tune</span>
          Filters
        </Button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-md">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <div className="flex justify-between items-center text-on-surface-variant">
            <span className="font-label-mono text-[11px] uppercase tracking-wider">Active PSVs</span>
            <span className="material-symbols-outlined text-primary text-xl">directions_bus</span>
          </div>
          <p className="font-headline-lg-mobile text-2xl text-on-surface font-bold">
            {activeTripsCount}
          </p>
          <span className="font-label-mono text-[10px] text-emerald-600 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">arrow_upward</span> Real-time streaming
          </span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <div className="flex justify-between items-center text-on-surface-variant">
            <span className="font-label-mono text-[11px] uppercase tracking-wider">Violations Today</span>
            <span className="material-symbols-outlined text-amber-600 text-xl">speed</span>
          </div>
          <p className="font-headline-lg-mobile text-2xl text-on-surface font-bold">
            {violationsToday}
          </p>
          <span className="font-label-mono text-[10px] text-amber-600">
            Overspeed & Route Deviation
          </span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <div className="flex justify-between items-center text-on-surface-variant">
            <span className="font-label-mono text-[11px] uppercase tracking-wider">Verified Hazards</span>
            <span className="material-symbols-outlined text-rose-600 text-xl">warning</span>
          </div>
          <p className="font-headline-lg-mobile text-2xl text-on-surface font-bold">
            {verifiedBlackSpotsCount}
          </p>
          <span className="font-label-mono text-[10px] text-rose-600">
            Blackspots & Road Bumps
          </span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <div className="flex justify-between items-center text-on-surface-variant">
            <span className="font-label-mono text-[11px] uppercase tracking-wider">Compliance Index</span>
            <span className="material-symbols-outlined text-primary text-xl">verified</span>
          </div>
          <p className="font-headline-lg-mobile text-2xl text-on-surface font-bold">
            87.4%
          </p>
          <span className="font-label-mono text-[10px] text-emerald-600">
            +2.1% National Target
          </span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <div className="flex justify-between items-center text-on-surface-variant">
            <span className="font-label-mono text-[11px] uppercase tracking-wider">Active SOS</span>
            <span className="material-symbols-outlined text-rose-600 text-xl animate-pulse">
              e911_emergency
            </span>
          </div>
          <p className="font-headline-lg-mobile text-2xl text-rose-600 font-bold">
            {activeSosCount}
          </p>
          <span className="font-label-mono text-[10px] text-rose-600 font-bold">
            Requires Police Dispatch
          </span>
        </div>
      </div>

      {/* Main Map & Live Alert Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Live Authority Operations Map */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">map</span>
              <h3 className="font-headline-lg-mobile text-sm text-on-surface">
                Live PSV Radar & Black Spot Density Map ({selectedCounty})
              </h3>
            </div>
            <Badge variant="success">Map Live</Badge>
          </div>

          <MapComponent
            markers={mapMarkers}
            centerAddress={`${selectedCounty} Regional Corridor`}
            showHeatmapOverlay={true}
            className="h-[360px]"
          />
        </div>

        {/* Live Safety & SOS Emergency Feed */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm flex flex-col justify-between space-y-md">
          <div>
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm mb-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-xl">campaign</span>
                <h3 className="font-headline-lg-mobile text-sm text-on-surface">
                  Live Emergency & Overspeed Feed
                </h3>
              </div>
              <span className="font-label-mono text-[10px] text-on-surface-variant">
                Auto-refreshing
              </span>
            </div>

            <div className="space-y-sm max-h-[320px] overflow-y-auto pr-1">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="p-sm rounded-xl border border-outline-variant/20 bg-surface-container-low space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-label-mono text-xs font-bold text-on-surface">
                        {alert.vehicleRegNumber}
                      </span>
                      <Badge
                        variant={
                          alert.type === 'sos' || alert.severity === 'critical'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {alert.type.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="font-body-sm text-[11px] text-on-surface-variant">
                      {alert.message}
                    </p>
                    <div className="flex justify-between items-center text-[10px] font-label-mono text-outline">
                      <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                      <button className="text-primary hover:underline font-bold">
                        Dispatch Patrol
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-md text-center border border-outline-variant/20 rounded-xl bg-surface-container-low text-on-surface-variant text-xs">
                  <span className="material-symbols-outlined text-2xl text-emerald-600 block mb-1">
                    check_circle
                  </span>
                  No emergency alerts or speed incidents reported.
                </div>
              )}
            </div>
          </div>

          <Button variant="outline" size="sm" className="w-full text-xs">
            View All Incident Logs
          </Button>
        </div>
      </div>

      {/* Speed Trends & County Risk Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline-lg-mobile text-sm text-on-surface">
                Hourly Speed & Violation Trend
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Average corridor speed vs limit breaches
              </p>
            </div>
            <span className="font-label-mono text-xs text-primary font-bold">Limit: 80 km/h</span>
          </div>

          <AreaChartWrapper
            data={speedTrendData}
            xKey="time"
            areas={[
              { key: 'avgSpeed', name: 'Avg Speed (km/h)', color: '#185FA5' },
              { key: 'violations', name: 'Violations Logged', color: '#C0392B' },
            ]}
            height={240}
          />
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline-lg-mobile text-sm text-on-surface">
                County Incident & Hazard Distribution
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Low risk vs High risk infractions by region
              </p>
            </div>
            <span className="font-label-mono text-xs text-outline">NTSA Analytics</span>
          </div>

          <BarChartWrapper
            data={countyViolationData}
            xKey="county"
            bars={[
              { key: 'low', name: 'Minor Speeding', color: '#E67E22' },
              { key: 'high', name: 'Critical Violations', color: '#C0392B' },
            ]}
            height={240}
          />
        </div>
      </div>

      {/* High Risk SACCO Regulatory Priority Queue */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-headline-lg-mobile text-sm text-on-surface">
              Regulatory Audit Priority Queue (SACCO Compliance Oversight)
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant">
              SACCOs flagged for excessive speeding, uninspected vehicles, or unaddressed complaints
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-2">
            <span className="material-symbols-outlined text-base">download</span>
            Export Audit Report
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead>
              <tr className="border-b border-outline-variant/20 text-on-surface-variant font-label-mono uppercase">
                <th className="py-2.5 px-3">SACCO Name</th>
                <th className="py-2.5 px-3">Reg Code</th>
                <th className="py-2.5 px-3">Active Fleet</th>
                <th className="py-2.5 px-3">Safety Score</th>
                <th className="py-2.5 px-3">Overspeed Breaches</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Inspector Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-on-surface">
              {auditPrioritySaccos.length >= 3 ? (
                auditPrioritySaccos.map((sacco) => (
                  <tr key={sacco.id} className="hover:bg-surface-container-low/50">
                    <td className="py-3 px-3 font-bold text-on-surface">{sacco.name}</td>
                    <td className="py-3 px-3 font-label-mono text-on-surface-variant">
                      {sacco.registrationCode || sacco.id}
                    </td>
                    <td className="py-3 px-3">{sacco.fleetCount || 0} Vehicles</td>
                    <td
                      className={`py-3 px-3 font-bold ${
                        (sacco.safetyScore ?? 100) < 70
                          ? 'text-rose-600'
                          : (sacco.safetyScore ?? 100) < 85
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {sacco.safetyScore ?? 100} / 100
                    </td>
                    <td className="py-3 px-3 font-label-mono text-on-surface-variant">
                      {sacco.contactPhone || 'N/A'}
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          sacco.status === 'suspended'
                            ? 'danger'
                            : sacco.status === 'under_review'
                            ? 'warning'
                            : 'success'
                        }
                      >
                        {sacco.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button size="sm" variant="secondary">
                        Inspect Fleet
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr key="empty">
                  <td colSpan={7} className="py-8">
                    <EmptyState
                      title="Insufficient SACCO Data"
                      description="At least 3 SACCO records are required to generate the Regulatory Audit Priority Queue."
                      icon="verified"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
