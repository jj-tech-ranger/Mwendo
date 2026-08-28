import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface ServiceCheck {
  name: string;
  type: string;
  status: 'healthy' | 'checking' | 'unconfigured' | 'error';
  latencyMs?: number;
  details: string;
}

type CheckStatus = ServiceCheck['status'];

const getErrorCode = (err: unknown): string => {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String((err as { code?: unknown }).code ?? '');
  }
  return '';
};

const checkFirestore = async (): Promise<{ status: CheckStatus; latencyMs: number; details: string }> => {
  const start = performance.now();
  try {
    await getDoc(doc(db, 'system_config', 'global'));
    return {
      status: 'healthy',
      latencyMs: Math.round(performance.now() - start),
      details: 'Connected and responding to a Firestore read.',
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const code = getErrorCode(err);
    if (code === 'permission-denied' || code === 'not-found') {
      return {
        status: 'healthy',
        latencyMs,
        details: 'Firestore responded; the probe document is not readable or does not exist.',
      };
    }
    return {
      status: 'error',
      latencyMs,
      details: code ? `Firestore request failed (${code}).` : 'Firestore request failed.',
    };
  }
};

export const AdminSystemHealthScreen: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [firestore, setFirestore] = useState<Pick<ServiceCheck, 'status' | 'latencyMs' | 'details'>>({
    status: 'checking',
    details: 'Checking Firestore connectivity...',
  });
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setIsTesting(true);
    setFirestore((current) => ({ ...current, status: 'checking', details: 'Checking Firestore connectivity...' }));
    const result = await checkFirestore();
    setFirestore(result);
    setLastChecked(new Date());
    setIsTesting(false);
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const authStatus: CheckStatus = auth.currentUser ? 'healthy' : 'unconfigured';
  const services: ServiceCheck[] = [
    {
      name: 'Primary Cloud Database',
      type: 'Real-Time Data Store',
      ...firestore,
    },
    {
      name: 'Identity & Authentication Gateway',
      type: 'Security & Claims Provider',
      status: authStatus,
      details: auth.currentUser
        ? `Authenticated session active (${auth.currentUser.email || auth.currentUser.uid}).`
        : 'Firebase Auth is loaded, but no authenticated session is active.',
    },
    {
      name: 'Audit & Incident Pipeline',
      type: 'System Auditing & Logs',
      status: 'unconfigured',
      details: 'No client-side health probe is configured for the audit pipeline.',
    },
    {
      name: 'Vehicle GPS Ingestion Pipeline',
      type: 'Real-Time GPS Location Stream',
      status: 'unconfigured',
      details: 'No live ingestion health probe is configured on this admin client.',
    },
  ];

  const overallStatus = services.some((service) => service.status === 'error')
    ? 'error'
    : services.some((service) => service.status === 'checking')
      ? 'checking'
      : services.some((service) => service.status === 'unconfigured')
        ? 'degraded'
        : 'healthy';

  return (
    <div className="bg-[#0A0F1D] text-slate-100 p-lg sm:p-xl rounded-2xl border border-slate-800 space-y-lg font-label-mono shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-slate-800 pb-md">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                overallStatus === 'healthy'
                  ? 'bg-emerald-500'
                  : overallStatus === 'checking'
                    ? 'bg-amber-500 animate-pulse'
                    : overallStatus === 'degraded'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
              }`}
            />
            <h2 className="text-base text-emerald-400 font-bold uppercase tracking-widest">
              Infrastructure Health & Status
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Live client connectivity diagnostics.{' '}
            {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Initial check in progress...'}
          </p>
        </div>

        <Button
          variant="outline"
          className="border-emerald-700/50 text-emerald-400 hover:bg-emerald-950/50 gap-2"
          onClick={() => void checkHealth()}
          disabled={isTesting}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">swap_calls</span>
          {isTesting ? 'Checking Database...' : 'Run Diagnostics Ping'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        {services.map((service) => (
          <div key={service.name} className="bg-[#111827] border border-slate-800 rounded-xl p-md space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">{service.name}</span>
                <span className="text-[10px] text-slate-400">{service.type}</span>
              </div>
              <span
                className={`flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  service.status === 'healthy'
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                    : service.status === 'checking'
                      ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                      : service.status === 'unconfigured'
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    service.status === 'healthy'
                      ? 'bg-emerald-400'
                      : service.status === 'checking'
                        ? 'bg-amber-400'
                        : service.status === 'unconfigured'
                          ? 'bg-slate-400'
                          : 'bg-rose-400'
                  }`}
                />
                {service.status}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-400">{service.details}</span>
              {typeof service.latencyMs === 'number' && (
                <span className="text-emerald-400 font-bold ml-2 shrink-0">{service.latencyMs} ms</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#111827] border border-slate-800 rounded-xl p-md space-y-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-slate-400" aria-hidden="true">info</span>
          <span className="text-xs font-bold text-white">System Infrastructure Monitoring</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          This screen reports only checks that the browser can actually perform. Backend pipelines without a dedicated health probe are shown as unconfigured rather than incorrectly reported as healthy.
        </p>
      </div>
    </div>
  );
};
