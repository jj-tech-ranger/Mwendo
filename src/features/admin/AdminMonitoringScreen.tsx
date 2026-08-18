import React from 'react';
import { EmptyState } from '../../components/ui/EmptyState';

export const AdminMonitoringScreen: React.FC = () => {
  return (
    <div className="bg-[#0A0F1D] text-slate-100 p-lg sm:p-xl rounded-2xl border border-slate-800 space-y-lg font-label-mono shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-slate-800 pb-md">
        <div>
          <h2 className="text-base text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-emerald-400">insights</span>
            System Health & Error Monitoring
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time performance breakdown and operational exception feeds.
          </p>
        </div>

        <span className="bg-slate-800 border border-slate-700 text-slate-400 px-3 py-1 rounded-full text-xs">
          OBSERVABILITY DISCONNECTED
        </span>
      </div>

      {/* Honest Empty / Unconnected State */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-8">
        <EmptyState
          icon="monitoring"
          title="Monitoring Integration Not Yet Connected"
          description="External monitoring integrations have not been attached to this deployment. Once configured, real-time status and throughput metrics will appear here."
        />
      </div>

      {/* Integration Setup Note */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-md space-y-2 text-xs">
        <span className="text-slate-300 font-bold block">How to connect observability:</span>
        <ol className="list-decimal list-inside space-y-1 text-slate-400">
          <li>Define your APM DSN or Cloud Monitoring credentials in your environment configuration.</li>
          <li>Deploy the tracing SDK in your server-side API middleware.</li>
          <li>Real exceptions and latency percentiles will stream automatically to this operational console.</li>
        </ol>
      </div>
    </div>
  );
};
