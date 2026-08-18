import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';

export const NotFound404Screen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md">
      <EmptyState
        icon="map"
        title="Page Not Found"
        description="We couldn't find the page you're looking for. It may have moved or is unavailable."
        primaryCtaLabel="Return to Home"
        onPrimaryCta={() => navigate('/passenger')}
      />
    </div>
  );
};
