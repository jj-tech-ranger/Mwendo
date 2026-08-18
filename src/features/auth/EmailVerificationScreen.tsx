import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';

export const EmailVerificationScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-center items-center p-margin-mobile text-center">
      <div className="w-full max-w-sm space-y-lg bg-surface-container-lowest p-lg sm:p-xl rounded-2xl border border-outline-variant/30 shadow-sm">
        <PrimaryLogo className="h-10 w-auto mx-auto mb-2" />
        <span className="material-symbols-outlined text-5xl text-primary">mark_email_unread</span>
        <h1 className="font-headline-lg text-on-surface">{t('auth.emailVerification.title')}</h1>
        <p className="font-body-md text-on-surface-variant leading-relaxed">
          {t('auth.emailVerification.checkInbox')}
        </p>

        <div className="space-y-md pt-2">
          <Button variant="primary" className="w-full" onClick={() => navigate('/auth/login')}>
            {t('auth.forgotPassword.backToLogin')}
          </Button>
          <Button variant="ghost" className="w-full">
            {t('auth.emailVerification.resendEmail')}
          </Button>
        </div>

        <div className="pt-2">
          <Link to="/auth/login" className="font-label-bold text-xs text-outline hover:underline">
            {t('auth.emailVerification.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
};
