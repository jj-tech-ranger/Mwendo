import React from 'react';
import { EmptyState } from '../../components/ui/EmptyState';

export const AccountSuspendedScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md">
      <EmptyState
        icon="block"
        title="Account Suspended"
        description="Your Mwendo Salama account has been suspended due to policy compliance or safety review. Please contact support."
        primaryCtaLabel="Contact Support"
        onPrimaryCta={() => {
          window.location.href = 'mailto:support@mwendosalama.go.ke?subject=Account%20Suspension%20Inquiry';
        }}
      />
    </div>
  );
};
