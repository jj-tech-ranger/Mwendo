import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';

export const SessionExpiredScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md">
      <EmptyState
        icon="timer_off"
        title="Session Expired"
        description="Your security token has expired. Please sign in again to continue managing your journeys safely."
        primaryCtaLabel="Sign In Again"
        onPrimaryCta={() => navigate('/auth/login')}
      />
    </div>
  );
};
