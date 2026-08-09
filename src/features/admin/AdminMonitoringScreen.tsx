import React, { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const AdminMonitoringScreen: React.FC = () => {
  const [expandedError, setExpandedError] = useState<string | null>('err-101');

  const errorList = [
    {
      id: 'err-101',
      title: 'QuotaExceededError: Firestore write rate limit reached on batch telemetry',
      endpoint: '/api/v1/telemetry/batch',
      impactedUsers: 14,
      firstSeen: '2026-08-08T04:12:00Z',
      lastSeen: '2026-08-08T04:45:00Z',
      stackTrace: `Error: QuotaExceededError: batch write failed
    at FirestoreClient.commitBatch (/src/lib/firebase.ts:142:10)
    at async processTelemetryIngestion (/src/services/telemetry.ts:88:5)
    at async RouteHandler (/src/routes/api.ts:24:2)`,
    },
    {
      id: 'err-102',
      title: 'GeofenceEvaluationTimeout: Spatial query exceeded 200ms threshold',
      endpoint: '/api/v1/blackspots/near',
      impactedUsers: 3,
      firstSeen: '2026-08-07T18:30:00Z',
      lastSeen: '2026-08-08T01:10:00Z',
      stackTrace: `TimeoutError: GeofenceEvaluationTimeout
    at spatialIndexSearch (/src/services/geofence.ts:54:12)
    at async evalBlackspots (/src/services/blackspots.ts:110:3)`,
    },
  ];

  return (
    <div className="bg-[#0A0F1D] text-slate-100 p-lg sm:p-xl rounded-2xl border border-slate-800 space-y-lg font-label-mono shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-slate-800 pb-md">
        <div>
          <h2 className="text-base text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-emerald-400">insights</span>
            API & Error Telemetry Monitoring
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time API latency breakdown, error rates, and exception stack traces.
          </p>
        </div>

        <span className="bg-emerald-950 border border-emerald-500/40 text-emerald-400 px-3 py-1 rounded-full text-xs">
          0.02% ERROR RATE (TARGET: &lt;0.05%)
        </span>
      </div>

      {/* Latency Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-md">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-md space-y-1">
          <span className="text-[10px] text-slate-400 uppercase">Total Requests (24h)</span>
          <p className="text-xl font-bold text-white">1,248,900</p>
          <span className="text-[9px] text-emerald-400">+8.2% throughput</span>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-md space-y-1">
          <span className="text-[10px] text-slate-400 uppercase">p50 Latency</span>
          <p className="text-xl font-bold text-emerald-400">14 ms</p>
          <span className="text-[9px] text-slate-500">Median Response</span>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-md space-y-1">
          <span className="text-[10px] text-slate-400 uppercase">p95 Latency</span>
          <p className="text-xl font-bold text-amber-400">85 ms</p>
          <span className="text-[9px] text-slate-500">Peak Load</span>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-md space-y-1">
          <span className="text-[10px] text-slate-400 uppercase">p99 Latency</span>
          <p className="text-xl font-bold text-amber-400">142 ms</p>
          <span className="text-[9px] text-slate-500">Tail Latency</span>
        </div>
      </div>

      {/* Exception Feed */}
      <div className="space-y-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Sentry-Style Active Exception Log
          </span>
          <span className="text-xs text-slate-400">{errorList.length} Unique Exceptions</span>
        </div>

        <div className="space-y-sm">
          {errorList.map((err) => (
            <div
              key={err.id}
              className="bg-[#111827] border border-slate-800 rounded-xl p-md space-y-2 transition-colors hover:border-slate-700"
            >
              <div className="flex items-start justify-between gap-md">
                <div>
                  <p className="text-xs font-bold text-rose-400">{err.title}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Endpoint: <code className="text-emerald-300">{err.endpoint}</code> • Impacted Users: {err.impactedUsers}
                  </p>
                </div>

                <button
                  onClick={() =>
                    setExpandedError(expandedError === err.id ? null : err.id)
                  }
                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-[10px]"
                >
                  {expandedError === err.id ? 'Hide Stack Trace' : 'View Stack Trace'}
                </button>
              </div>

              {expandedError === err.id && (
                <div className="bg-[#0A0F1D] border border-rose-950 p-md rounded-lg text-[10px] text-rose-300 space-y-2">
                  <div className="flex justify-between text-[9px] text-slate-400 border-b border-rose-950 pb-1">
                    <span>First seen: {new Date(err.firstSeen).toLocaleTimeString()}</span>
                    <span>Last seen: {new Date(err.lastSeen).toLocaleTimeString()}</span>
                  </div>
                  <pre className="overflow-x-auto leading-relaxed">{err.stackTrace}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
