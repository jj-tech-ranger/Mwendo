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
import { SafetyAlert } from '../../types';
import { AreaChartWrapper, BarChartWrapper } from '../../components/charts/Charts';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { MapComponent, MapMarker } from '../../components/map/MapComponent';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';
import { toStandardDate } from '../../lib/utils';

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
  const [realtimeAlerts, setRealtimeAlerts] = useState<SafetyAlert[]>([]);

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
          setRealtimeAlerts([]);
        }
      },
      (error) => {
        console.warn('[AuthorityDashboard] Real-time alerts error:', error);
        setRealtimeAlerts([]);
      }
    );

    return () => unsubscribe();
  }, []);

  const { data: authorityData, isError, error, refetch } = useQuery({
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

      return {
        trips: fetchedTrips,
        violations: fetchedViolations,
        blackSpots: fetchedSpots,
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
      const date = toStandardDate(v.timestamp);
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

  if (isError) {
    return (
      <EmptyState
        icon="error"
        title="Failed to Load Authority Metrics"
        description={
          (error as Error)?.message ||
          'Unable to retrieve national transit violations, blackspot hazard registry, or fleet audit logs. Please try again.'
        }
        secondaryCtaLabel="Retry Data Fetch"
        onSecondaryCta={() => refetch()}
      />
    );
  }

  return (