import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrimaryLogo } from '../../components/assets/BrandAssets';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authService } from '../../services/authService';
import type { UserProfile } from '../../types';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RouteProfile = Pick<UserProfile, 'activeRole' | 'role' | 'isMfaEnrolled'>;

export const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const routeProfile = (profile: RouteProfile) => {
    const role = profile.activeRole || profile.role;
    if (role === 'admin' || role === 'authority') {
      navigate(profile.isMfaEnrolled ? '/auth/mfa-challenge' : '/auth/mfa-enrollment');
    } else if (role === 'sacco_manager') {
      navigate('/sacco');
    } else {
      navigate('/passenger');
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setErrorMsg(null);
    try {
      routeProfile(await authService.signInWithEmail(data.email, data.password));
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string; resolver?: unknown };
      if (authErr.code === 'auth/multi-factor-auth-required') {
        navigate('/auth/mfa-challenge', { state: { resolver: authErr.resolver } });
        return;
      }
      console.error('Sign in error:', err);
      setErrorMsg(authErr.message || t('auth.login.invalidCredentials'));
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    try {
      routeProfile(await authService.signInWithGoogle());
    } catch (err: unknown) {
      const authErr = err as { code?: string; resolver?: unknown };
      if (authErr.code === 'auth/multi-factor-auth-required') {
        navigate('/auth/mfa-challenge', { state: { resolver: authErr.resolver } });
        return;
      }
      console.error('Google sign in error:', err);
      setErrorMsg('Failed to sign in with Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setErrorMsg(null);
    setIsGuestLoading(true);
    try {
      await authService.signInGuest();
      navigate('/passenger');
    } catch (err: unknown) {
      console.error('Guest sign in error:', err);
      setErrorMsg('Failed to sign in as guest');
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    const email = getValues('email');
    if (!email) {
      setErrorMsg(t('auth.login.emailPlaceholder'));
      return;
    }
    setErrorMsg(null);
    try {
      await authService.sendMagicLink(email);
      setMagicLinkSent(true);
    } catch (err: unknown) {
      console.error('Magic link error:', err);
      setErrorMsg('Failed to send magic link');
    }
  };

  return (
    <main className="min-h-screen bg-surface text-on-surface lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <section className="relative hidden overflow-hidden bg-primary px-12 py-12 text-on-primary lg:flex lg:min-h-screen lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-24 top-16 h-72 w-72 rounded-full border border-on-primary/10" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full border border-on-primary/10" />
        <div className="relative z-10">
          <img src="/brand/logo-dark.png" alt="Mwendo Salama" className="h-12 w-auto object-contain" />
        </div>
        <div className="relative z-10 max-w-xl space-y-6">
          <p className="font-label-bold text-sm uppercase tracking-[0.18em] text-on-primary/70">Mwendo Salama</p>
          <h2 className="font-headline-xl max-w-lg leading-tight">Safer journeys, powered by better road intelligence.</h2>
          <p className="max-w-md text-base leading-7 text-on-primary/80">Track your journey, understand road risks, and help make public transport safer across Kenya.</p>
          <div className="flex flex-wrap gap-3 pt-2 text-sm text-on-primary/80">
            <span className="rounded-full border border-on-primary/15 bg-on-primary/5 px-4 py-2">Real-time safety</span>
            <span className="rounded-full border border-on-primary/15 bg-on-primary/5 px-4 py-2">Kenya-focused</span>
          </div>
        </div>
        <p className="relative z-10 text-xs text-on-primary/60">Your safety journey starts here.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12 xl:px-20">
        <div className="w-full max-w-md space-y-7">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <PrimaryLogo className="mb-7 h-10 w-auto lg:hidden" />
            <div className="mb-2 text-xs font-label-bold uppercase tracking-[0.16em] text-primary">Welcome back</div>
            <h1 className="font-headline-lg text-on-surface">{t('auth.login.title')}</h1>
            <p className="mt-2 max-w-sm font-body-md text-on-surface-variant">{t('auth.login.subtitle')}</p>
          </div>

          {errorMsg && <div role="alert" className="rounded-2xl bg-error-container p-4 text-sm text-on-error-container">{errorMsg}</div>}
          {magicLinkSent && <div role="status" className="rounded-2xl bg-sage-light p-4 text-sm text-primary">{t('auth.login.magicLinkSent')}</div>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input label={t('auth.login.emailLabel')} type="email" placeholder={t('auth.login.emailPlaceholder')} icon="mail" error={errors.email?.message} {...register('email')} />
            <Input label={t('auth.login.passwordLabel')} type="password" placeholder={t('auth.login.passwordPlaceholder')} icon="lock" error={errors.password?.message} {...register('password')} />
            <div className="flex justify-end">
              <Link to="/auth/forgot-password" className="font-label-bold text-sm text-primary hover:underline">{t('auth.login.forgotPassword')}</Link>
            </div>
            <Button type="submit" variant="primary" className="w-full min-h-12" isLoading={isSubmitting}>{t('auth.login.signInButton')}</Button>
          </form>

          <div className="relative py-1"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/50" /></div><div className="relative flex justify-center"><span className="bg-surface px-3 text-xs font-label-mono uppercase text-on-surface-variant">{t('auth.login.orContinueWith')}</span></div></div>

          <div className="space-y-3">
            <Button type="button" variant="outline" className="min-h-12 w-full" onClick={handleGoogleSignIn} isLoading={isGoogleLoading}><span className="material-symbols-outlined text-xl text-primary">account_circle</span>{t('auth.login.googleSignIn')}</Button>
            <Button type="button" variant="outline" className="min-h-12 w-full" onClick={handleSendMagicLink}>{t('auth.login.magicLink')}</Button>
            <button type="button" onClick={handleGuestSignIn} disabled={isGuestLoading} className="min-h-11 w-full rounded-xl px-4 text-sm font-label-bold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary disabled:opacity-60">{isGuestLoading ? t('common.loading') : t('auth.login.continueAsGuest')}</button>
          </div>

          <div className="border-t border-outline-variant/40 pt-6 text-center lg:text-left">
            <p className="font-body-sm text-on-surface-variant">{t('auth.login.noAccount')}{' '}<Link to="/auth/register" className="font-label-bold text-primary hover:underline">{t('auth.login.createOne')}</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
};
