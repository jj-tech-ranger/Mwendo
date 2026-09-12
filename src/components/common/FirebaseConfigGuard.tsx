import React, { useState } from 'react';
import { AlertTriangle, Key, RefreshCw, FileCode, Play, ExternalLink } from 'lucide-react';
import { firebaseConfigStatus } from '../../lib/firebase';

interface FirebaseConfigGuardProps {
  children: React.ReactNode;
}

export const FirebaseConfigGuard: React.FC<FirebaseConfigGuardProps> = ({ children }) => {
  const [demoMode, setDemoMode] = useState(() => {
    return typeof window !== 'undefined' && (
      window.sessionStorage.getItem('mwendo_demo_mode') === 'true' ||
      window.location.search.includes('demo=true')
    );
  });

  const handleEnterDemoMode = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('mwendo_demo_mode', 'true');
    }
    setDemoMode(true);
  };

  if (firebaseConfigStatus.isValid || demoMode) {
    return (
      <>
        {!firebaseConfigStatus.isValid && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between z-50 relative">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span><strong>Interactive Demo Mode:</strong> Firebase environment variables not configured. Running with simulated local data.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.sessionStorage.removeItem('mwendo_demo_mode');
                }
                setDemoMode(false);
              }}
              className="text-xs font-semibold underline hover:text-amber-700 dark:hover:text-amber-100 flex items-center gap-1"
            >
              <span>Setup Firebase</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}
        {children}
      </>
    );
  }

  const { missingKeys } = firebaseConfigStatus;

  return (
    <main
      id="firebase-config-error-container"
      className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans"
    >
      <div
        id="firebase-config-error-card"
        className="w-full max-w-xl bg-white border border-amber-200 rounded-xl shadow-sm p-6 md:p-8 space-y-6"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-600 shrink-0">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-slate-900">
              Firebase Configuration Required
            </h1>
            <p className="text-sm text-slate-600">
              The application requires Firebase to store and sync live trips and reports. You can configure Firebase environment variables or explore immediately in interactive demo mode.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
            <Key className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>Missing Environment Variables ({missingKeys.length})</span>
          </div>
          <div className="bg-slate-900 rounded-lg p-3 overflow-x-auto text-xs font-mono text-amber-400 space-y-1">
            {missingKeys.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-red-400">✗</span>
                <span>{key}=</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <FileCode className="w-4 h-4 text-slate-600" aria-hidden="true" />
            <span>How to configure</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
            <li>
              <strong>Local Development:</strong> Copy variables from <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">.env.example</code> to <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">.env</code> and provide your Firebase Web App credentials.
            </li>
            <li>
              <strong>AI Studio Integration:</strong> Use the Settings menu to add your Firebase credentials or provision a project.
            </li>
          </ul>
        </div>

        <div className="pt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            id="continue-demo-btn"
            onClick={handleEnterDemoMode}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <Play className="w-4 h-4 fill-white" aria-hidden="true" />
            <span>Explore App in Demo Mode</span>
          </button>
          <button
            type="button"
            id="reload-page-btn"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Reload</span>
          </button>
        </div>
      </div>
    </main>
  );
};
