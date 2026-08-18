import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';

export const SessionExpiredScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md">
      <EmptyState
        icon="timer_off"
        title={t('auth.sessionExpired.title')}
        description={t('auth.sessionExpired.subtitle')}
        primaryCtaLabel={t('auth.sessionExpired.signInButton')}
        onPrimaryCta={() => navigate('/auth/login')}
      />
    </div>
  );
};
