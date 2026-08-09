import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';

export const NotFound404Screen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md">
      <EmptyState
        icon="map"
        title="404 - Page Not Found"
        description="The screen or route you requested does not exist in Mwendo Salama."
        primaryCtaLabel="Return Home"
        onPrimaryCta={() => navigate('/passenger')}
      />
    </div>
  );
};
