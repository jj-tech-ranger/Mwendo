import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LineChartWrapper, DonutChartWrapper } from '../../components/charts/Charts';
import { useAuthStore } from '../../store/useAuthStore';
import {
  saccoRepository,
  blackSpotRepository,
  violationRepository,
  tripRepository,
  vehicleRepository,
} from '../../repositories';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

export const AuthorityReportsScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [selectedReportType, setSelectedReportType] = useState('national_digest');
  const [selectedScope, setSelectedScope] = useState(user?.county || 'All Kenya (National)');
  const [dateRange, setDateRange] = useState('30d');
  const [isExporting, setIsExporting] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['authorityReportsData'],
    queryFn: async () => {
      const [sList, bList, vList, tList, vehList] = await Promise.all([
        saccoRepository.getAll(),
        blackSpotRepository.getAll(),
        violationRepository.getAll(),
        tripRepository.getAll(),
        vehicleRepository.getAll(),
      ]);
      return {
        saccos: sList,
        blackSpots: bList,
        violations: vList,
        trips: tList,
        vehicles: vehList,
      };
    },
    staleTime: QUERY_STALE_TIMES.ANALYTICS_SUMMARIES,
  });

  const allSaccos = reportData?.saccos || [];
  const allBlackSpots = reportData?.blackSpots || [];
  const allViolations = reportData?.violations || [];
  const allTrips = reportData?.trips || [];
  const allVehicles = reportData?.vehicles || [];

  // Calculate timestamps for selected date window and previous comparison period
  const { periodStartMs, prevPeriodStartMs, prevPeriodEndMs } = useMemo(() => {
    const now = Date.now();
    let durationMs = 30 * 24 * 60 * 60 * 1000;
    if (dateRange === '7d') {
      durationMs = 7 * 24 * 60 * 60 * 1000;
    } else if (dateRange === '30d') {
      durationMs = 30 * 24 * 60 * 60 * 1000;
    } else if (dateRange === '90d') {
      durationMs = 90 * 24 * 60 * 60 * 1000;
    } else if (dateRange === 'ytd') {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
      durationMs = Math.max(24 * 60 * 60 * 1000, now - startOfYear);
    }

    const periodStart = now - durationMs;
    const prevPeriodEnd = periodStart;
    const prevPeriodStart = periodStart - durationMs;

    return {
      periodStartMs: periodStart,
      prevPeriodStartMs: prevPeriodStart,
      prevPeriodEndMs: prevPeriodEnd,
    };
  }, [dateRange]);

  // Scope filter helper
  const matchesScope = (countyOrLocation?: string, routeName?: string) => {
    if (selectedScope === 'All Kenya (National)') return true;
    const scopeLower = selectedScope.toLowerCase();
    const countyMatch = countyOrLocation ? countyOrLocation.toLowerCase().includes(scopeLower) : false;
    const routeMatch = routeName ? routeName.toLowerCase().includes(scopeLower) : false;
    return countyMatch || routeMatch;
  };

  // Filtered dataset for active window and jurisdiction
  const filteredTrips = useMemo(() => {
    return allTrips.filter((t) => {
      const tripTime = new Date(t.startTime || t.createdAt || 0).getTime();
      if (tripTime < periodStartMs) return false;
      if (selectedScope !== 'All Kenya (National)') {
        return matchesScope(t.origin || t.destination, t.routeName);
      }
      return true;
    });
  }, [allTrips, periodStartMs, selectedScope]);

  const filteredViolations = useMemo(() => {
    return allViolations.filter((v) => {
      const vTime = new Date(v.timestamp).getTime();
      if (vTime < periodStartMs) return false;
      if (selectedScope !== 'All Kenya (National)') {
        return matchesScope(v.locationName, v.routeName);
      }
      return true;
    });
  }, [allViolations, periodStartMs, selectedScope]);

  const prevMetrics = useMemo(() => {
    const prevViolations = allViolations.filter((v) => {
      const vTime = new Date(v.timestamp).getTime();
      if (vTime < prevPeriodStartMs || vTime >= prevPeriodEndMs) return false;
      if (selectedScope !== 'All Kenya (National)') {
        return matchesScope(v.locationName, v.routeName);
      }
      return true;
    });

    return {
      violationsCount: prevViolations.length,
    };
  }, [allViolations, prevPeriodStartMs, prevPeriodEndMs, selectedScope]);

  const filteredBlackSpots = useMemo(() => {
    if (selectedScope === 'All Kenya (National)') return allBlackSpots;
    return allBlackSpots.filter((b) => matchesScope(b.county, b.routeName || b.name));
  }, [allBlackSpots, selectedScope]);

  // Derived KPI metrics
  const totalTripsCount = filteredTrips.length;
  const totalViolationsCount = filteredViolations.length;

  // Kenyan Statutory Fines schedule: Traffic Act Cap 403
  const totalFinesKES = useMemo(() => {
    return filteredViolations.reduce((sum, v) => {
      const delta = (v.recordedSpeedKmH || 0) - (v.speedLimitKmH || 0);
      if (delta > 20) return sum + 15000;
      if (delta > 10) return sum + 10000;
      return sum + 5000;
    }, 0);
  }, [filteredViolations]);

  const formattedFines = useMemo(() => {
    if (totalFinesKES >= 1_000_000) {
      return `KES ${(totalFinesKES / 1_000_000).toFixed(2)}M`;
    }
    if (totalFinesKES >= 1_000) {
      return `KES ${(totalFinesKES / 1_000).toFixed(1)}K`;
    }
    return `KES ${totalFinesKES.toLocaleString()}`;
  }, [totalFinesKES]);

  const complianceRate = useMemo(() => {
    if (totalTripsCount === 0) {
      return totalViolationsCount === 0 ? 100 : 0;
    }
    const tripsWithViolations = filteredTrips.filter(
      (t) => (t.violationsCount && t.violationsCount > 0) || (t.overspeedEventsCount && t.overspeedEventsCount > 0)
    ).length;
    const cleanTrips = Math.max(0, totalTripsCount - Math.max(tripsWithViolations, Math.min(totalViolationsCount, totalTripsCount)));
    return (cleanTrips / totalTripsCount) * 100;
  }, [totalTripsCount, totalViolationsCount, filteredTrips]);

  const formattedComplianceRate =
    totalTripsCount === 0 && totalViolationsCount === 0 ? '100.0%' : `${complianceRate.toFixed(1)}%`;

  const violationDeltaPercent = useMemo(() => {
    if (prevMetrics.violationsCount === 0) return null;
    return Math.round(
      ((totalViolationsCount - prevMetrics.violationsCount) / prevMetrics.violationsCount) * 100
    );
  }, [totalViolationsCount, prevMetrics.violationsCount]);

  // SACCO Safety Ranking Breakdown
  const saccoComplianceData = useMemo(() => {
    const violationsBySacco = filteredViolations.reduce((acc, v) => {
      if (v.saccoId) {
        acc[v.saccoId] = (acc[v.saccoId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const fleetBySacco = allVehicles.reduce((acc, veh) => {
      if (veh.saccoId) {
        acc[veh.saccoId] = (acc[veh.saccoId] || 0) + (veh.status === 'active' ? 1 : 0);
      }
      return acc;
    }, {} as Record<string, number>);

    return allSaccos
      .map((s) => {
        const breaches = violationsBySacco[s.id] || 0;
        const fleet = fleetBySacco[s.id] || s.fleetCount || 0;
        const baseScore = s.safetyScore || 100;
        const computedScore = Math.max(20, Math.min(100, baseScore - breaches * 2));
        const status: 'COMPLIANT' | 'MONITORED' | 'UNDER AUDIT' =
          computedScore >= 85 ? 'COMPLIANT' : computedScore >= 70 ? 'MONITORED' : 'UNDER AUDIT';

        return {
          id: s.id,
          name: s.name,
          value: computedScore,
          fleetCount: fleet,
          safetyScore: computedScore,
          speedBreaches: breaches,
          status,
          color: computedScore >= 85 ? '#1A5C2E' : computedScore >= 70 ? '#185FA5' : '#C0392B',
        };
      })
      .sort((a, b) => b.safetyScore - a.safetyScore);
  }, [allSaccos, filteredViolations, allVehicles]);

  // Chart datasets
  const speedTrendData = useMemo(() => {
    if (filteredViolations.length === 0) return [];
    const grouped = filteredViolations.reduce((acc, v) => {
      const dateKey = new Date(v.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      acc[dateKey] = (acc[dateKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([day, infractions]) => ({
      day,
      infractions,
      complianceRate: Math.max(40, 100 - infractions * 5),
    }));
  }, [filteredViolations]);

  const hazardBreakdownData = useMemo(() => {
    if (filteredBlackSpots.length === 0) return [];
    const colors = ['#C0392B', '#E67E22', '#185FA5', '#64748B', '#7C3AED', '#0D9488'];
    const grouped = filteredBlackSpots.reduce((acc, spot) => {
      const type = spot.hazardType || 'accident_prone';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([type, count], idx) => ({
      name: type.replace(/_/g, ' ').toUpperCase(),
      value: count,
      color: colors[idx % colors.length],
    }));
  }, [filteredBlackSpots]);

  // CSV Exporter — Derives strictly and entirely from computed repository state
  const handleExportCsv = () => {
    setIsExporting(true);
    setTimeout(() => {
      const lines: string[] = [];

      lines.push('========================================================================');
      lines.push('NATIONAL TRANSPORT AND SAFETY AUTHORITY (NTSA) - REGULATORY REPORT');
      lines.push(`Generated: ${new Date().toISOString()}`);
      lines.push(`Report Type: ${selectedReportType}`);
      lines.push(`Jurisdiction Scope: ${selectedScope}`);
      lines.push(`Time Window: ${dateRange}`);
      lines.push('========================================================================');
      lines.push('');

      lines.push('--- EXECUTIVE SUMMARY METRICS ---');
      lines.push('Metric,Value,Unit/Note');
      lines.push(`Total Telemetry Trips,${totalTripsCount},GPS Recorded`);
      lines.push(`Speed Violations,${totalViolationsCount},Infractions`);
      lines.push(`Statutory Fines Assessed,KES ${totalFinesKES.toLocaleString()},Kenya Traffic Act Cap 403`);
      lines.push(`Overall Compliance Rate,${formattedComplianceRate},Clean Trips / Total`);
      lines.push('');

      lines.push('--- SACCO SAFETY & COMPLIANCE INDEX ---');
      lines.push('Rank,SACCO Name,Active Fleet,Safety Score (/100),Speed Breaches,Regulatory Status');
      if (saccoComplianceData.length === 0) {
        lines.push('No SACCO records available for the selected scope.');
      } else {
        saccoComplianceData.forEach((s, idx) => {
          lines.push(`${idx + 1},"${s.name.replace(/"/g, '""')}",${s.fleetCount},${s.safetyScore},${s.speedBreaches},${s.status}`);
        });
      }
      lines.push('');

      lines.push('--- SPEED VIOLATION AUDIT LOG ---');
      lines.push('Violation ID,Vehicle Reg,Driver,Route,Recorded Speed (km/h),Speed Limit (km/h),Delta (km/h),Severity,Timestamp,Status');
      if (filteredViolations.length === 0) {
        lines.push('No violations recorded for this period and jurisdiction.');
      } else {
        filteredViolations.forEach((v) => {
          const delta = (v.recordedSpeedKmH || 0) - (v.speedLimitKmH || 0);
          lines.push(
            `"${v.id}","${v.vehicleRegNumber || 'N/A'}","${(v.driverName || 'Unknown').replace(/"/g, '""')}","${(v.routeName || 'N/A').replace(/"/g, '""')}",${v.recordedSpeedKmH || 0},${v.speedLimitKmH || 0},${delta},${v.severity},"${v.timestamp}",${v.status}`
          );
        });
      }

      const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute(
        'download',
        `NTSA_Safety_Report_${selectedReportType}_${selectedScope.replace(/[^a-zA-Z0-9]/g, '_')}_${dateRange}.csv`
      );
      if (typeof document !== 'undefined' && document.body && typeof document.body.appendChild === 'function') {
        try {
          document.body.appendChild(link);
        } catch {
          // ignore in environments where appendChild is restricted
        }
      }
      if (typeof link.click === 'function') {
        link.click();
      }
      if (typeof document !== 'undefined' && document.body && link.parentNode === document.body && typeof document.body.removeChild === 'function') {
        try {
          document.body.removeChild(link);
        } catch {
          // ignore
        }
      }

      setIsExporting(false);
      setDownloadNotice('CSV Report generated and downloaded to your device.');
      setTimeout(() => setDownloadNotice(null), 4000);
    }, 400);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-headline-lg-mobile text-lg text-on-surface">
              NTSA Regulatory Reports & Analytical Intelligence
            </h2>
            <Badge variant="success" className="text-[10px]">
              Active Telemetry Analytics
            </Badge>
          </div>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Official PSV compliance indices, speed violation digests, and printable authority exports
          </p>
        </div>

        <div className="flex items-center gap-sm">
          <Button
            id="export-csv-btn"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting || isLoading}
            className="gap-2"
          >
            <span className="material-symbols-outlined text-base">csv</span>
            {isExporting ? 'Exporting...' : 'Export CSV Data'}
          </Button>

          <Button
            id="print-pdf-btn"
            variant="primary"
            size="sm"
            onClick={handlePrintPdf}
            className="gap-2"
          >
            <span className="material-symbols-outlined text-base">print</span>
            Print / PDF Summary
          </Button>
        </div>
      </div>

      {downloadNotice && (
        <div className="p-md rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-label-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">download_done</span>
            <span>{downloadNotice}</span>
          </div>
          <button onClick={() => setDownloadNotice(null)}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Controls Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
          {/* Report Type Selector */}
          <div>
            <label htmlFor="report-type-select" className="font-label-mono text-xs text-on-surface-variant block mb-1">
              Select Report Type:
            </label>
            <select
              id="report-type-select"
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-label-bold rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="national_digest">National PSV Safety Digest</option>
              <option value="county_violations">County Speed Violation Breakdown</option>
              <option value="sacco_compliance">SACCO Safety Index & Ranking</option>
              <option value="blackspot_density">Black-Spot & Hazard Density Report</option>
            </select>
          </div>

          {/* Scope Selector */}
          <div>
            <label htmlFor="scope-select" className="font-label-mono text-xs text-on-surface-variant block mb-1">
              Jurisdiction Scope:
            </label>
            <select
              id="scope-select"
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-label-mono rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="All Kenya (National)">All Kenya (National)</option>
              <option value="Nairobi">Nairobi County</option>
              <option value="Kiambu">Kiambu County</option>
              <option value="Machakos">Machakos County</option>
              <option value="Nakuru">Nakuru County</option>
              <option value="Mombasa">Mombasa County</option>
            </select>
          </div>

          {/* Date Range Selector */}
          <div>
            <label htmlFor="date-range-select" className="font-label-mono text-xs text-on-surface-variant block mb-1">
              Time Period:
            </label>
            <select
              id="date-range-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-label-mono rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last Quarter (90 Days)</option>
              <option value="ytd">Year-To-Date (2026)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-md">
        <div id="kpi-total-trips" className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Total Telemetry Trips
          </span>
          <p className="font-headline-lg-mobile text-2xl text-on-surface font-bold">
            {isLoading ? '...' : totalTripsCount.toLocaleString()}
          </p>
          <span className="font-label-mono text-[10px] text-emerald-600">
            {totalTripsCount > 0 ? '100% Real-time GPS tracked' : 'No trips in selected window'}
          </span>
        </div>

        <div id="kpi-speed-violations" className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Speed Violations
          </span>
          <p className="font-headline-lg-mobile text-2xl text-rose-600 font-bold">
            {isLoading ? '...' : totalViolationsCount.toLocaleString()}
          </p>
          <span className="font-label-mono text-[10px] text-rose-600">
            {violationDeltaPercent !== null
              ? `${violationDeltaPercent > 0 ? '+' : ''}${violationDeltaPercent}% vs previous period`
              : totalViolationsCount === 0 ? '0 infractions recorded' : 'No prior baseline'}
          </span>
        </div>

        <div id="kpi-fines-issued" className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Statutory Fines Issued
          </span>
          <p className="font-headline-lg-mobile text-2xl text-amber-600 font-bold">
            {isLoading ? '...' : formattedFines}
          </p>
          <span className="font-label-mono text-[10px] text-amber-600">
            {totalFinesKES > 0 ? 'Traffic Act Cap 403 Schedule' : 'No fines assessed'}
          </span>
        </div>

        <div id="kpi-compliance-rate" className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Overall Compliance Rate
          </span>
          <p className="font-headline-lg-mobile text-2xl text-primary font-bold">
            {isLoading ? '...' : formattedComplianceRate}
          </p>
          <span className="font-label-mono text-[10px] text-emerald-600">
            {complianceRate >= 85 ? 'Compliance target met' : 'Requires regulatory review'}
          </span>
        </div>
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-lg-mobile text-sm text-on-surface">
              Speed Violation & Compliance Trend
            </h3>
            <Badge variant="info">{selectedScope}</Badge>
          </div>

          {speedTrendData.length > 0 ? (
            <LineChartWrapper
              data={speedTrendData}
              xKey="day"
              lines={[
                { key: 'infractions', name: 'Speed Breaches', color: '#C0392B' },
                { key: 'complianceRate', name: 'Compliance Rate (%)', color: '#1A5C2E' },
              ]}
              height={240}
            />
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-on-surface-variant text-xs gap-2">
              <span className="material-symbols-outlined text-3xl text-outline">insights</span>
              <span>No speed infractions logged for {selectedScope} in this period.</span>
            </div>
          )}
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-lg-mobile text-sm text-on-surface">
              Hazard & Blackspot Category Proportions
            </h3>
            <Badge variant="warning">NTSA Verified</Badge>
          </div>

          {hazardBreakdownData.length > 0 ? (
            <DonutChartWrapper data={hazardBreakdownData} height={240} />
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-on-surface-variant text-xs gap-2">
              <span className="material-symbols-outlined text-3xl text-outline">report_problem</span>
              <span>No blackspot hazards mapped for {selectedScope}.</span>
            </div>
          )}
        </div>
      </div>

      {/* SACCO Safety Ranking Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
          <h3 className="font-headline-lg-mobile text-sm text-on-surface">
            SACCO Safety Index & Compliance Breakdown
          </h3>
          <span className="font-label-mono text-xs text-on-surface-variant">
            Scope: {selectedScope}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead>
              <tr className="border-b border-outline-variant/20 text-on-surface-variant font-label-mono uppercase">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">SACCO Name</th>
                <th className="py-2.5 px-3">Active Fleet</th>
                <th className="py-2.5 px-3">Safety Score</th>
                <th className="py-2.5 px-3">Speed Breaches</th>
                <th className="py-2.5 px-3">Regulatory Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-on-surface">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-on-surface-variant font-label-mono">
                    Loading regulatory analytics...
                  </td>
                </tr>
              ) : saccoComplianceData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-on-surface-variant">
                    No SACCO safety records found for {selectedScope}.
                  </td>
                </tr>
              ) : (
                saccoComplianceData.map((s, idx) => (
                  <tr key={s.id || s.name} className="hover:bg-surface-container-low/50">
                    <td className="py-3 px-3 font-label-mono font-bold text-on-surface">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-3 font-bold text-on-surface">{s.name}</td>
                    <td className="py-3 px-3 font-label-mono">{s.fleetCount} Vehicles</td>
                    <td className="py-3 px-3 font-bold font-label-mono" style={{ color: s.color }}>
                      {s.safetyScore} / 100
                    </td>
                    <td className="py-3 px-3 font-label-mono">{s.speedBreaches}</td>
                    <td className="py-3 px-3">
                      <Badge variant={s.status === 'COMPLIANT' ? 'success' : s.status === 'MONITORED' ? 'warning' : 'danger'}>
                        {s.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
