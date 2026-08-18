import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/useAuthStore';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';
import { useToast } from '../../components/ui/Toast';
import { getSaccoName, getEffectiveSaccoId } from '../../lib/saccoUtils';
import { vehicleRepository, violationRepository, tripRepository, complaintRepository } from '../../repositories';
import { where } from 'firebase/firestore';
import { calculateSaccoSafetyScore } from '../../lib/engine';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

export const SaccoReportsScreen: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const saccoId = getEffectiveSaccoId(user?.saccoId);

  const [generating, setGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState('Weekly Fleet Safety Summary');

  const { data: reportData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['saccoReportData', saccoId],
    queryFn: async () => {
      if (!saccoId) {
        return {
          vehicles: [],
          violations: [],
          trips: [],
          complaints: [],
          safetyScore: 100,
        };
      }

      const [vehicles, violations, trips, complaints] = await Promise.all([
        vehicleRepository.getAll([where('saccoId', '==', saccoId)]),
        violationRepository.getAll([where('saccoId', '==', saccoId)]),
        tripRepository.getAll([where('saccoId', '==', saccoId)]),
        complaintRepository.getAll([where('saccoId', '==', saccoId)]),
      ]);

      const vehicleScores = vehicles.map((v) => (typeof v.riskScore === 'number' ? v.riskScore : 85));
      const unresolvedComplaintsCount = complaints.filter((c) => c.status !== 'resolved').length;
      const calculatedScore = calculateSaccoSafetyScore(vehicleScores, unresolvedComplaintsCount);

      return {
        vehicles,
        violations,
        trips,
        complaints,
        safetyScore: calculatedScore,
      };
    },
    enabled: !!saccoId,
    staleTime: QUERY_STALE_TIMES.ANALYTICS_SUMMARIES,
  });

  const vehicles = reportData?.vehicles || [];
  const violations = reportData?.violations || [];
  const trips = reportData?.trips || [];
  const safetyScore = reportData?.safetyScore ?? 100;

  const handleGenerate = (type: string) => {
    setSelectedReportType(type);
    setGenerating(true);
    setReportReady(false);

    setTimeout(() => {
      setGenerating(false);
      setReportReady(true);
    }, 600);
  };

  const handleExportCSV = () => {
    if (!saccoId) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const headers = ['Vehicle Registration', 'Capacity', 'Status', 'Risk Score', 'Insurance Expiry', 'Inspection Expiry'];
    const rows = vehicles.map((v) => [
      v.regNumber,
      v.capacity,
      v.status,
      v.riskScore ?? 85,
      v.insuranceExpiry || 'N/A',
      v.inspectionExpiry || 'N/A',
    ]);

    const csvContent = [
      `# Mwendo Salama - ${selectedReportType}`,
      `# SACCO: ${getSaccoName(saccoId)} (${saccoId})`,
      `# Generated: ${new Date().toISOString()}`,
      `# Overall Safety Score: ${safetyScore}/100`,
      `# Active Vehicles: ${vehicles.length}`,
      `# Recorded Violations: ${violations.length}`,
      `# Total Trips: ${trips.length}`,
      '',
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${val}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${saccoId}_safety_report_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('success', 'CSV Export Complete', `Downloaded ${saccoId}_safety_report_${dateStr}.csv`);
  };

  const handlePrintPDF = () => {
    window.print();
    showToast('info', 'Print Dialog Opened', 'Select "Save as PDF" in your print options to save.');
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

  if (isError) {
    return (
      <EmptyState
        icon="error"
        title="Failed to Load Report Data"
        description={
          (error as Error)?.message ||
          'Unable to query vehicle records and safety violation ledgers for report compilation. Please try again.'
        }
        secondaryCtaLabel="Retry"
        onSecondaryCta={() => refetch()}
      />
    );
  }

  const saccoName = getSaccoName(saccoId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="text-lg font-black text-on-surface">Reports Generation Hub — {saccoName}</h1>
          <p className="text-xs text-on-surface-variant">Export official NTSA compliance reports and weekly safety audits</p>
        </div>

        <Badge variant="neutral" className="font-mono text-xs">
          Tenant: {saccoId}
        </Badge>
      </div>

      {/* Reports Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Weekly Fleet Safety Summary', desc: 'Compliance score, overspeeding occurrences, and driver performance over the past 7 days.', icon: 'summarize' },
          { title: 'Monthly NTSA Compliance Log', desc: 'Full audit ledger of active vehicles, inspection certificates, and violation events.', icon: 'verified' },
          { title: 'Driver Violation Ledger', desc: 'Itemized disciplinary violation events categorized by vehicle registration number.', icon: 'badge' },
        ].map((r, i) => (
          <Card key={i} className="p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="material-symbols-outlined text-primary text-3xl">{r.icon}</span>
              <h3 className="font-bold text-sm text-on-surface">{r.title}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">{r.desc}</p>
            </div>

            <Button
              className="w-full font-bold text-xs"
              isLoading={generating && selectedReportType === r.title}
              onClick={() => handleGenerate(r.title)}
            >
              Generate Report
            </Button>
          </Card>
        ))}
      </div>

      {/* GENERATED REPORT PREVIEW DOCUMENT VIEW (§17) */}
      {reportReady && (
        <Card className="p-8 space-y-6 border-2 border-primary/30 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 max-w-4xl mx-auto shadow-xl">
          {/* Document Header */}
          <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="flex items-center gap-3">
              <img src={BRAND_ASSETS.appIcon} alt="Mwendo Salama" className="w-10 h-10 rounded-lg" />
              <div>
                <h2 className="text-base font-black tracking-tight">{saccoName} — Official Safety Audit</h2>
                <span className="font-mono text-xs text-slate-500 block">Generated: {new Date().toLocaleDateString()} • Mwendo Salama System</span>
              </div>
            </div>

            <Badge variant="success" className="font-mono text-xs py-1 px-3">
              Verified Audit Document
            </Badge>
          </div>

          {/* Document Summary Section with Real Data */}
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-sm uppercase tracking-wider font-mono text-primary">1. Executive Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center p-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Active Fleet</span>
                <span className="text-lg font-bold">{vehicles.length} Vehicles</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Compliance Score</span>
                <span className={`text-lg font-bold ${safetyScore >= 80 ? 'text-emerald-600' : safetyScore >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {safetyScore} / 100
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Violations Recorded</span>
                <span className="text-lg font-bold text-amber-600">{violations.length} Events</span>
              </div>
            </div>
          </div>

          {/* Itemized Vehicle Roster Preview */}
          <div className="space-y-2 text-xs">
            <h3 className="font-bold text-sm uppercase tracking-wider font-mono text-primary">2. Fleet Roster Breakdown</h3>
            {vehicles.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">No vehicles currently registered in this SACCO.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border border-slate-200 dark:border-slate-700">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-2">Reg Number</th>
                      <th className="p-2">Capacity</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Risk Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {vehicles.slice(0, 5).map((v) => (
                      <tr key={v.id}>
                        <td className="p-2 font-bold">{v.regNumber}</td>
                        <td className="p-2">{v.capacity} pax</td>
                        <td className="p-2 uppercase">{v.status}</td>
                        <td className="p-2">{v.riskScore ?? 85}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {vehicles.length > 5 && (
                  <p className="text-[10px] text-slate-500 mt-1 italic">Showing first 5 of {vehicles.length} vehicles. Export full CSV for complete list.</p>
                )}
              </div>
            )}
          </div>

          {/* Download Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-mono text-slate-500">Report Reference: {saccoId}_safety_{Date.now()}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="font-bold text-xs" onClick={handleExportCSV}>
                <span className="material-symbols-outlined text-base mr-1">csv</span> Export CSV Ledger
              </Button>
              <Button size="sm" className="font-bold text-xs" onClick={handlePrintPDF}>
                <span className="material-symbols-outlined text-base mr-1">print</span> Print / Save PDF
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
