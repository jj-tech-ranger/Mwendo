import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';

export const UnauthorizedScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md">
      <EmptyState
        icon="lock"
        title="403 - Access Denied"
        description="You do not have the required permissions to access this portal section. Please switch accounts or return home."
        primaryCtaLabel="Return to Home"
        onPrimaryCta={() => navigate('/passenger')}
      />
    </div>
  );
};
