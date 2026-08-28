import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PrimaryLogo } from '../../components/assets/BrandAssets';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authService } from '../../services/authService';

export const ForgotPasswordScreen: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await authService.sendPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      const code = typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
      setErrorMsg(
        code === 'auth/invalid-email'
          ? 'Please enter a valid email address.'
          : 'We could not send the reset email. Please check the address and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setErrorMsg(null);
  };

  return (
    <main className="min-h-screen bg-surface text-on-surface lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
      <section className="relative hidden overflow-hidden bg-primary px-12 py-12 text-on-primary lg:flex lg:min-h-screen lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-28 top-16 h-80 w-80 rounded-full border border-on-primary/10" />
        <div className="absolute right-10 top-32 h-40 w-40 rounded-full border border-on-primary/10" />
        <div className="absolute -bottom-44 -left-24 h-[28rem] w-[28rem] rounded-full border border-on-primary/10" />
        <img src="/brand/logo-dark.png" alt="Mwendo Salama" className="relative z-10 h-12 w-auto object-contain self-start" />

        <div className="relative z-10 max-w-xl">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-on-primary/10 ring-1 ring-on-primary/10">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">lock_reset</span>
          </div>
          <p className="mb-3 text-xs font-label-bold uppercase tracking-[0.18em] text-on-primary/70">Account recovery</p>
          <h1 className="font-headline-xl max-w-lg leading-tight">Get back on the road securely.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-on-primary/75">
            Reset your password through a secure email link and return to your Mwendo Salama account.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm text-on-primary/65">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">verified_user</span>
            <span>Your account credentials stay protected.</span>
          </div>
        </div>

        <p className="relative z-10 text-xs text-on-primary/60">Built for safer public transport in Kenya.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12 xl:px-20">
        <div className="w-full max-w-md">
          <header className="mb-8 text-center lg:text-left">
            <PrimaryLogo className="mx-auto mb-7 h-10 w-auto lg:hidden" />
            <div className="mb-2 text-xs font-label-bold uppercase tracking-[0.16em] text-primary">Secure recovery</div>
            <h2 className="font-headline-lg text-on-surface">{t('auth.forgotPassword.title')}</h2>
            <p className="mt-2 max-w-md font-body-md leading-6 text-on-surface-variant">
              {submitted ? 'Check your inbox for the next step.' : t('auth.forgotPassword.subtitle')}
            </p>
          </header>

          {errorMsg && (
            <div role="alert" className="mb-5 rounded-2xl bg-error-container p-4 text-sm text-on-error-container">
              {errorMsg}
            </div>
          )}

          {submitted ? (
            <div className="rounded-3xl bg-surface-container-low p-6 sm:p-7">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container text-primary">
                <span className="material-symbols-outlined text-3xl" aria-hidden="true">mark_email_read</span>
              </div>
              <h3 className="font-headline-md text-on-surface">Email sent</h3>
              <p className="mt-3 font-body-md leading-6 text-on-surface-variant">
                {t('auth.forgotPassword.successMessage')} <span className="font-label-bold text-on-surface">{email}</span>
              </p>
              <div className="mt-7 space-y-3">
                <Button variant="primary" className="min-h-12 w-full" onClick={resetForm}>
                  Send to another address
                </Button>
                <Link to="/auth/login" className="flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-label-bold text-primary transition-colors hover:bg-primary-container/50">
                  {t('auth.forgotPassword.backToLogin')}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-3xl bg-surface-container-low p-6 sm:p-7">
              <div className="mb-6 flex items-center gap-3 rounded-2xl bg-primary-container/50 p-4 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">info</span>
                <span>Use the email address connected to your Mwendo Salama account.</span>
              </div>
              <Input
                label={t('auth.forgotPassword.emailLabel')}
                type="email"
                placeholder={t('auth.forgotPassword.emailPlaceholder')}
                icon="mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Button type="submit" variant="primary" className="mt-5 min-h-12 w-full" isLoading={isSubmitting}>
                {t('auth.forgotPassword.sendResetLink')}
              </Button>
            </form>
          )}

          {!submitted && (
            <div className="mt-7 text-center lg:text-left">
              <Link to="/auth/login" className="inline-flex items-center gap-2 text-sm font-label-bold text-primary hover:underline">
                <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};
