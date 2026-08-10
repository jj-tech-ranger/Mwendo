import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LineChartWrapper, BarChartWrapper, DonutChartWrapper } from '../../components/charts/Charts';
import { useAuthStore } from '../../store/useAuthStore';
import { saccoRepository, blackSpotRepository, violationRepository } from '../../repositories';
import { SACCO, BlackSpot, Violation } from '../../types';

export const AuthorityReportsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [selectedReportType, setSelectedReportType] = useState('national_digest');
  const [selectedScope, setSelectedScope] = useState(user?.county || 'All Kenya (National)');
  const [dateRange, setDateRange] = useState('30d');
  const [isExporting, setIsExporting] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const [saccos, setSaccos] = useState<SACCO[]>([]);
  const [blackSpots, setBlackSpots] = useState<BlackSpot[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [sList, bList, vList] = await Promise.all([
          saccoRepository.getAll(),
          blackSpotRepository.getAll(),
          violationRepository.getAll(),
        ]);
        setSaccos(sList);
        setBlackSpots(bList);
        setViolations(vList);
      } catch (err) {
        console.error('Error loading report analytics:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const saccoComplianceData = saccos.map((s, idx) => ({
    name: s.name,
    value: s.safetyScore || 100,
    color: idx % 2 === 0 ? '#1A5C2E' : '#185FA5',
  }));

  const speedTrendData = Object.entries(
    violations.reduce((acc, v) => {
      const day = new Date(v.timestamp).toLocaleDateString('en-US', { weekday: 'short' });
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([day, infractions]) => ({
    day,
    infractions,
    complianceRate: Math.max(70, 100 - infractions * 2),
  }));

  const hazardBreakdownData = Object.entries(
    blackSpots.reduce((acc, spot) => {
      const type = spot.hazardType || 'accident_prone';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, count], idx) => ({
    name: type.replace('_', ' ').toUpperCase(),
    value: count,
    color: ['#C0392B', '#E67E22', '#185FA5', '#64748B'][idx % 4],
  }));

  // CSV Exporter
  const handleExportCsv = () => {
    setIsExporting(true);
    setTimeout(() => {
      const headers = ['Report_Type', 'Jurisdiction_Scope', 'Date_Range', 'Infractions_Total', 'Compliance_Rate'];
      const rows = [
        [selectedReportType, selectedScope, dateRange, '279', '87.4%'],
        [selectedReportType, selectedScope, 'Prev Period', '312', '85.1%'],
      ];

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `NTSA_Safety_Report_${selectedReportType}_${dateRange}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsExporting(false);
      setDownloadNotice('CSV Report generated and downloaded to your device.');
      setTimeout(() => setDownloadNotice(null), 4000);
    }, 600);
  };

  // PDF Print preview
  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface">
            NTSA Regulatory Reports & Analytical Intelligence
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Official PSV compliance indices, speed violation digests, and printable authority exports
          </p>
        </div>

        <div className="flex items-center gap-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="gap-2"
          >
            <span className="material-symbols-outlined text-base">csv</span>
            {isExporting ? 'Exporting...' : 'Export CSV Data'}
          </Button>

          <Button variant="primary" size="sm" onClick={handlePrintPdf} className="gap-2">
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
            <label className="font-label-mono text-xs text-on-surface-variant block mb-1">
              Select Report Type:
            </label>
            <select
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
            <label className="font-label-mono text-xs text-on-surface-variant block mb-1">
              Jurisdiction Scope:
            </label>
            <select
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
            <label className="font-label-mono text-xs text-on-surface-variant block mb-1">
              Time Period:
            </label>
            <select
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
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Total Telemetry Trips
          </span>
          <p className="font-headline-lg-mobile text-2xl text-on-surface font-bold">14,280</p>
          <span className="font-label-mono text-[10px] text-emerald-600">
            100% Real-time GPS tracked
          </span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Speed Violations
          </span>
          <p className="font-headline-lg-mobile text-2xl text-rose-600 font-bold">279</p>
          <span className="font-label-mono text-[10px] text-rose-600">-12% vs previous period</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Statutory Fines Issued
          </span>
          <p className="font-headline-lg-mobile text-2xl text-amber-600 font-bold">KES 4.18M</p>
          <span className="font-label-mono text-[10px] text-amber-600">84% Collected</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-1">
          <span className="font-label-mono text-[11px] text-on-surface-variant uppercase">
            Overall Compliance Rate
          </span>
          <p className="font-headline-lg-mobile text-2xl text-primary font-bold">87.4%</p>
          <span className="font-label-mono text-[10px] text-emerald-600">+2.3% Target met</span>
        </div>
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-lg-mobile text-sm text-on-surface">
              7-Day Speed Violation & Compliance Trend
            </h3>
            <Badge variant="info">{selectedScope}</Badge>
          </div>

          <LineChartWrapper
            data={speedTrendData}
            xKey="day"
            lines={[
              { key: 'infractions', name: 'Speed Breaches', color: '#C0392B' },
              { key: 'complianceRate', name: 'Compliance Rate (%)', color: '#1A5C2E' },
            ]}
            height={240}
          />
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-lg-mobile text-sm text-on-surface">
              Hazard & Blackspot Category Proportions
            </h3>
            <Badge variant="warning">NTSA Verified</Badge>
          </div>

          <DonutChartWrapper data={hazardBreakdownData} height={240} />
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
              {saccoComplianceData.map((s, idx) => (
                <tr key={s.name} className="hover:bg-surface-container-low/50">
                  <td className="py-3 px-3 font-label-mono font-bold text-on-surface">
                    #{idx + 1}
                  </td>
                  <td className="py-3 px-3 font-bold text-on-surface">{s.name}</td>
                  <td className="py-3 px-3">120 Vehicles</td>
                  <td className="py-3 px-3 font-bold font-label-mono" style={{ color: s.color }}>
                    {s.value} / 100
                  </td>
                  <td className="py-3 px-3 font-label-mono">{100 - s.value}</td>
                  <td className="py-3 px-3">
                    <Badge variant={s.value > 85 ? 'success' : s.value > 70 ? 'warning' : 'danger'}>
                      {s.value > 85 ? 'COMPLIANT' : s.value > 70 ? 'MONITORED' : 'UNDER AUDIT'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
