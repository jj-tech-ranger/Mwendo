import React from 'react';
import { AlertTriangle, Key, RefreshCw, FileCode } from 'lucide-react';
import { firebaseConfigStatus } from '../../lib/firebase';

interface FirebaseConfigGuardProps {
  children: React.ReactNode;
}

export const FirebaseConfigGuard: React.FC<FirebaseConfigGuardProps> = ({ children }) => {
  if (firebaseConfigStatus.isValid) {
    return <>{children}</>;
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
              The application could not connect to Firebase because required environment variables are missing.
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
              <strong>Production / Hosting:</strong> Ensure your deployment CI/CD workflow passes these variables during <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">npm run build</code>.
            </li>
          </ul>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            id="reload-page-btn"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Reload Application</span>
          </button>
        </div>
      </div>
    </main>
  );
};
