import React from 'react';
import { useRouteError, useNavigate } from 'react-router-dom';
import { EmptyState } from '../ui/EmptyState';

export const RouteErrorElement: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  console.error('Route error caught by RouteErrorElement:', error);

  return (
    <div className="min-h-screen flex items-center justify-center p-md bg-background">
      <EmptyState
        icon="sync_problem"
        title="We couldn't load this information"
        description="Please check your connection and try refreshing the page."
        primaryCtaLabel="Refresh Page"
        onPrimaryCta={() => window.location.reload()}
        secondaryCtaLabel="Return to Home"
        onSecondaryCta={() => navigate('/')}
      />
    </div>
  );
};
