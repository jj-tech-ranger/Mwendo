import React from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';

export const AccountSuspendedScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md">
      <EmptyState
        icon="block"
        title={t('auth.suspended.title')}
        description={t('auth.suspended.subtitle')}
        primaryCtaLabel={t('auth.suspended.contactSupport')}
        onPrimaryCta={() => {
          window.location.href = 'mailto:support@mwendosalama.go.ke?subject=Account%20Suspension%20Inquiry';
        }}
      />
    </div>
  );
};
