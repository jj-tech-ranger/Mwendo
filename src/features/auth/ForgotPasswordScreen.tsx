import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PrimaryLogo } from '../../components/assets/BrandAssets';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export const ForgotPasswordScreen: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-center items-center p-margin-mobile">
      <div className="w-full max-w-sm space-y-lg text-center">
        <PrimaryLogo className="h-12 w-auto mx-auto mb-2" />
        <h1 className="font-headline-lg text-primary">{t('auth.forgotPassword.title')}</h1>

        {submitted ? (
          <div className="space-y-md bg-surface-container-lowest p-lg rounded-2xl border border-outline-variant/30">
            <span className="material-symbols-outlined text-4xl text-secondary">mark_email_read</span>
            <p className="font-body-md text-on-surface">
              {t('auth.forgotPassword.successMessage')} (<span className="font-bold">{email}</span>)
            </p>
            <Button variant="outline" className="w-full" onClick={() => setSubmitted(false)}>
              {t('common.retry')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-md text-left">
            <p className="font-body-md text-on-surface-variant text-center mb-md">
              {t('auth.forgotPassword.subtitle')}
            </p>
            <Input
              label={t('auth.forgotPassword.emailLabel')}
              type="email"
              placeholder={t('auth.forgotPassword.emailPlaceholder')}
              icon="mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" className="w-full">
              {t('auth.forgotPassword.sendResetLink')}
            </Button>
          </form>
        )}

        <div>
          <Link to="/auth/login" className="font-label-bold text-xs text-outline hover:underline">
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
};
