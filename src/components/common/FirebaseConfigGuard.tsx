import React from 'react';
import { firebaseConfigStatus } from '../../lib/firebase';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface FirebaseConfigGuardProps {
  children: React.ReactNode;
}

/**
 * FirebaseConfigGuard protects the application from running with missing or invalid
 * Firebase configuration credentials.
 *
 * PRODUCTION HARDENING: The unauthenticated sandbox bypass was removed because no mock
 * data layer exists in this codebase. Initializing the real Firebase SDK with placeholder
 * keys caused runtime exceptions on the first network/auth call. The legitimate
 * configuration-error screen and its Reload action are retained to halt execution
 * honestly for both local development and production.
 */
export const FirebaseConfigGuard: React.FC<FirebaseConfigGuardProps> = ({ children }) => {
  if (!firebaseConfigStatus.isValid) {
    return (
      <div
        id="firebase-config-error-screen"
        data-testid="firebase-config-error-screen"
        className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-6"
      >
        <Card className="max-w-md w-full p-6 text-center space-y-4 border border-error/30 bg-surface shadow-xl rounded-2xl">
          <div className="mx-auto w-14 h-14 rounded-full bg-error/10 text-error flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">error_outline</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-on-surface">Firebase Configuration Required</h1>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              The application cannot connect to backend services because required Firebase environment variables are missing or incomplete.
            </p>
          </div>

          {firebaseConfigStatus.missingKeys && firebaseConfigStatus.missingKeys.length > 0 && (
            <div className="text-left bg-surface-container p-3 rounded-xl space-y-1.5 text-xs font-mono">
              <div className="text-[11px] font-bold text-error uppercase">Missing Variables:</div>
              <ul className="list-disc list-inside space-y-0.5 text-on-surface-variant text-[11px]">
                {firebaseConfigStatus.missingKeys.map((key) => (
                  <li key={key} className="text-error font-medium">{key}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-on-surface-variant/80 text-left">
            Please define these keys in your environment (or <code className="bg-surface-container px-1 py-0.5 rounded text-primary">.env</code> file) and reload the application.
          </p>

          <Button
            id="btn-reload-config"
            data-testid="btn-reload-config"
            className="w-full font-bold"
            onClick={() => window.location.reload()}
          >
            Reload Application
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
