import React from 'react';
import { useRouteError, useNavigate } from 'react-router-dom';
import { EmptyState } from '../ui/EmptyState';

export const RouteErrorElement: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  console.error('Route error caught by RouteErrorElement:', error);

  const errorMessage: string =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack || ''}`
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error, null, 2) || String(error)
        : String(error);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-md bg-background">
      <EmptyState
        icon="sync_problem"
        title="We couldn't load this information"
        description="Please check your connection and try refreshing the page."
        primaryCtaLabel="Refresh Page"
        onPrimaryCta={() => window.location.reload()}
        secondaryCtaLabel="Return to Home"
        onSecondaryCta={() => navigate('/')}
      />

      {Boolean(import.meta.env.DEV && error) && (
        <div className="mt-6 w-full max-w-2xl bg-red-950/40 border border-red-500/40 rounded-lg p-4 text-left">
          <p className="text-sm font-semibold text-red-400 mb-2">
            Development Error Details (Route Error):
          </p>

          <pre className="text-xs text-red-200 font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-64">
            {errorMessage}
          </pre>
        </div>
      )}
    </div>
  );
};
