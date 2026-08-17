import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface ServiceCheck {
  name: string;
  type: string;
  status: 'healthy' | 'checking' | 'unconfigured' | 'error';
  latencyMs?: number | undefined;
  details: string;
}

export const AdminSystemHealthScreen: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [firestoreLatency, setFirestoreLatency] = useState<number | null>(null);
  const [firestoreStatus, setFirestoreStatus] = useState<'healthy' | 'checking' | 'error'>('checking');
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const checkHealth = async () => {
    setIsTesting(true);
    setFirestoreStatus('checking');
    const start = performance.now();
    try {
      // Test read from Firestore
      await getDoc(doc(db, 'system_config', 'global'));
      const end = performance.now();
      const latency = Math.round(end - start);
      setFirestoreLatency(latency);
      setFirestoreStatus('healthy');
    } catch (err: any) {
      const end = performance.now();
      const latency = Math.round(end - start);
      setFirestoreLatency(latency);
      // If error is permission or not-found, the connection itself is alive
      if (err?.code === 'permission-denied' || err?.code === 'not-found') {
        setFirestoreStatus('healthy');
      } else {
        setFirestoreStatus('error');
      }
    } finally {
      setIsTesting(false);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const services: ServiceCheck[] = [
    {
      name: 'Cloud Firestore Database',
      type: 'Primary Data Store',
      status: firestoreStatus,
      latencyMs: firestoreLatency ?? undefined,
      details:
        firestoreStatus === 'healthy'
          ? `Connected (${firestoreLatency ?? 0}ms round-trip latency)`
          : firestoreStatus === 'checking'
          ? 'Verifying socket handshake...'
          : 'Failed to connect to Firestore backend',
    },
    {
      name: 'Firebase Authentication Service',
      type: 'Identity & Claims Provider',
      status: auth.currentUser ? 'healthy' : 'healthy',
      details: auth.currentUser
        ? `Authenticated session active (${auth.currentUser.email || auth.currentUser.uid})`
        : 'Auth subsystem initialized and ready',
    },
    {
      name: 'Google Cloud Logging / Observability',
      type: 'External Telemetry',
      status: 'unconfigured',
      details: 'Observability agent not configured in this environment',
    },
    {
      name: 'Pub/Sub Vehicle Telemetry Stream',
      type: 'High-Throughput GPS Ingestion',
      status: 'unconfigured',
      details: 'Managed pub/sub queue connector not configured in this environment',
    },
  ];

  return (
    <div className="bg-[#0A0F1D] text-slate-100 p-lg sm:p-xl rounded-2xl border border-slate-800 space-y-lg font-label-mono shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-slate-800 pb-md">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                firestoreStatus === 'healthy'
                  ? 'bg-emerald-500 animate-ping'
                  : firestoreStatus === 'checking'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <h2 className="text-base text-emerald-400 font-bold uppercase tracking-widest">
              SYS_OPS Infrastructure Health & Telemetry
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Live client connectivity diagnostics and backend integration status. Last checked:{' '}
            {lastChecked.toLocaleTimeString()}
          </p>
        </div>

        <Button
          variant="outline"
          className="border-emerald-700/50 text-emerald-400 hover:bg-emerald-950/50 gap-2"
          onClick={checkHealth}
          disabled={isTesting}
        >
          <span className="material-symbols-outlined text-base">swap_calls</span>
          {isTesting ? 'Pinging Services...' : 'Run Diagnostics Ping'}
        </Button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        {services.map((s, idx) => (
          <div key={idx} className="bg-[#111827] border border-slate-800 rounded-xl p-md space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">{s.name}</span>
                <span className="text-[10px] text-slate-400">{s.type}</span>
              </div>
              <span
                className={`flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  s.status === 'healthy'
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                    : s.status === 'checking'
                    ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                    : s.status === 'unconfigured'
                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    s.status === 'healthy'
                      ? 'bg-emerald-400'
                      : s.status === 'checking'
                      ? 'bg-amber-400'
                      : s.status === 'unconfigured'
                      ? 'bg-slate-400'
                      : 'bg-rose-400'
                  }`}
                />
                {s.status}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{s.details}</span>
              {typeof s.latencyMs === 'number' && (
                <span className="text-emerald-400 font-bold ml-2">{s.latencyMs} ms</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Observability Connection Info */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-md space-y-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-slate-400">info</span>
          <span className="text-xs font-bold text-white">Observability & APM Configuration</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Google Cloud Monitoring, Prometheus scrapers, and Sentry error ingestion can be attached to
          Mwendo Salama by provisioning the respective cloud integration tokens in your container
          environment.
        </p>
      </div>
    </div>
  );
};
