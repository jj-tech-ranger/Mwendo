import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { auth } from '../../lib/firebase';

export const EmailVerificationScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setEmail(auth.currentUser?.email || '');
  }, []);

  const handleResend = async () => {
    const user = auth.currentUser;
    if (!user) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    setSending(true);
    setError('');
    try {
      await sendEmailVerification(user);
      setSent(true);
    } catch (err) {
      console.error('[EmailVerificationScreen] Failed to resend verification email:', err);
      setError('We could not send the verification email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleCheckVerification = async () => {
    const user = auth.currentUser;
    if (!user) {
      navigate('/auth/login');
      return;
    }

    setChecking(true);
    setError('');
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        navigate('/');
      } else {
        setError('Your email is not verified yet. Check your inbox and try again.');
      }
    } catch (err) {
      console.error('[EmailVerificationScreen] Failed to check verification status:', err);
      setError('We could not check your verification status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-on-background overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative min-h-screen grid lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:flex flex-col justify-between bg-primary p-12 xl:p-16 text-on-primary relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" aria-hidden="true">
            <div className="absolute -right-20 top-20 h-72 w-72 rounded-full border-[3rem] border-on-primary" />
            <div className="absolute right-24 bottom-16 h-44 w-44 rounded-full border-[1.5rem] border-on-primary" />
          </div>

          <div className="relative z-10">
            <img src="/brand/logo-dark.png" alt="Mwendo Salama" className="h-11 w-auto" />
          </div>

          <div className="relative z-10 max-w-lg">
            <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-on-primary/10 border border-on-primary/15 backdrop-blur-sm">
              <span className="material-symbols-outlined text-5xl" aria-hidden="true">mark_email_read</span>
            </div>
            <p className="font-label-bold text-sm uppercase tracking-[0.18em] opacity-70 mb-4">Almost there</p>
            <h1 className="font-headline-xl leading-tight mb-5">One small step to a safer journey.</h1>
            <p className="font-body-lg opacity-80 max-w-md">
              Verify your email to protect your account and keep your Mwendo Salama safety information secure.
            </p>
          </div>

          <p className="relative z-10 text-sm opacity-60">Mwendo Salama · Safer journeys across Kenya</p>
        </section>

        <section className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
          <div className="w-full max-w-xl">
            <div className="lg:hidden mb-8">
              <PrimaryLogo className="h-10 w-auto" />
            </div>

            <div className="rounded-[2rem] bg-surface-container-lowest border border-outline-variant/25 shadow-xl shadow-primary/5 p-6 sm:p-9 md:p-11">
              <div className="flex items-center gap-4 mb-8">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
                  <span className="material-symbols-outlined text-3xl" aria-hidden="true">mail</span>
                </div>
                <div>
                  <p className="font-label-bold text-xs uppercase tracking-wider text-primary">Account verification</p>
                  <h2 className="font-headline-lg text-on-surface">{t('auth.emailVerification.title')}</h2>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-container-low p-5 mb-7">
                <p className="font-body-md text-on-surface-variant mb-2">We sent a verification link to</p>
                <p className="font-label-bold text-on-surface break-all">{email || 'your email address'}</p>
              </div>

              <p className="font-body-md text-on-surface-variant leading-relaxed mb-7">
                {t('auth.emailVerification.checkInbox')}
              </p>

              {error && (
                <div role="alert" className="mb-5 rounded-xl bg-error-container text-on-error-container px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              {sent && !error && (
                <div role="status" className="mb-5 rounded-xl bg-secondary-container text-on-secondary-container px-4 py-3 text-sm">
                  Verification email sent. Check your inbox and spam folder.
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <Button variant="primary" className="w-full" onClick={handleCheckVerification} disabled={checking}>
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    {checking ? 'progress_activity' : 'verified'}
                  </span>
                  {checking ? 'Checking…' : 'I verified my email'}
                </Button>
                <Button variant="outline" className="w-full" onClick={handleResend} disabled={sending}>
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    {sending ? 'progress_activity' : 'refresh'}
                  </span>
                  {sending ? 'Sending…' : t('auth.emailVerification.resendEmail')}
                </Button>
              </div>

              <div className="mt-8 pt-6 border-t border-outline-variant/20 text-center">
                <Link to="/auth/login" className="inline-flex items-center gap-2 font-label-bold text-sm text-primary hover:underline">
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_back</span>
                  {t('auth.emailVerification.backToLogin')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
