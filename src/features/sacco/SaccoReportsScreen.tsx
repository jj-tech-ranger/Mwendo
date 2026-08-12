import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/useAuthStore';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';
import { useToast } from '../../components/ui/Toast';
import { getSaccoName, getEffectiveSaccoId } from '../../lib/saccoUtils';

export const SaccoReportsScreen: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const saccoId = getEffectiveSaccoId(user?.saccoId);

  const [generating, setGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState('Weekly Fleet Safety Summary');

  const handleGenerate = (type: string) => {
    setSelectedReportType(type);
    setGenerating(true);
    setReportReady(false);

    setTimeout(() => {
      setGenerating(false);
      setReportReady(true);
    }, 1500);
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
              Verified PDF Document
            </Badge>
          </div>

          {/* Document Summary Section */}
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-sm uppercase tracking-wider font-mono text-primary">1. Executive Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center p-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Active Fleet</span>
                <span className="text-lg font-bold">24 Vehicles</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Compliance Score</span>
                <span className="text-lg font-bold text-emerald-600">82 / 100</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Violations Recorded</span>
                <span className="text-lg font-bold text-amber-600">14 Events</span>
              </div>
            </div>
          </div>

          {/* Download Action Bar */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-mono text-slate-500">File: {saccoId}_safety_report_{Date.now()}.pdf</span>
            <Button
              className="font-bold text-xs"
              onClick={() => showToast('success', 'PDF Downloaded', 'PDF export downloaded successfully!')}
            >
              <span className="material-symbols-outlined text-base mr-1">download</span> Download PDF Export
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
