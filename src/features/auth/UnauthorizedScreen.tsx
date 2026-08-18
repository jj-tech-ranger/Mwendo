import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';

export const UnauthorizedScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md">
      <EmptyState
        icon="lock"
        title={t('auth.unauthorized.title')}
        description={t('auth.unauthorized.subtitle')}
        primaryCtaLabel={t('auth.unauthorized.goHome')}
        onPrimaryCta={() => navigate('/passenger')}
      />
    </div>
  );
};
