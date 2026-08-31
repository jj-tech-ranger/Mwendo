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

const AuthPhotoHero: React.FC = () => (
  <div className="relative h-full min-h-[520px] overflow-hidden rounded-[36px] border border-outline-variant/20 bg-surface-container-high p-8 text-on-primary shadow-2xl lg:min-h-[680px]">
    {/* High-Resolution Transit Photo */}
    <img
      src="https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1200&q=80"
      alt="Modern passenger transit journey in Kenya"
      referrerPolicy="no-referrer"
      className="absolute inset-0 h-full w-full object-cover object-center"
    />

    {/* Brand Green Dark Gradient Overlay for Crisp Text Contrast */}
    <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/75 to-black/40" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_60%)]" />

    <div className="relative z-10 flex h-full flex-col justify-between">
      {/* Header with Logo and Badge */}
      <div className="flex items-center justify-between gap-4">
        <img src="/brand/logo-dark.png" alt="Mwendo Salama" className="h-11 w-auto" />
        <span className="rounded-full border border-white/20 bg-black/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-white backdrop-blur-md">
          Kenya Safety Network
        </span>
      </div>

      {/* Center Verified Stats Card */}
      <div className="my-auto py-8">
        <div className="max-w-md rounded-3xl border border-white/20 bg-slate-950/70 p-6 text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
              <span className="material-symbols-outlined text-2xl">shield_with_heart</span>
            </span>
            <div>
              <p className="text-sm font-extrabold text-white">Verified Safety Platform</p>
              <p className="text-xs text-white/70">Protecting passengers & fleet crews</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-2xl font-black text-white">48+</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/70">Partner SACCOs</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-2xl font-black text-emerald-300">18k+</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/70">Safe Trips Logged</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-200">
            <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
            <span>Real-time speed & hazard protection</span>
          </div>
        </div>
      </div>

      {/* Footer Title */}
      <div className="max-w-lg">
        <div className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Mwendo Salama
        </div>
        <h2 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">
          Every journey deserves a safer route.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-white/80">
          Track journeys, understand road risks, and help make public transport safer across Kenya.
        </p>
      </div>
    </div>
  </div>
);

export const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const routeProfile = (profile: RouteProfile) => {
    const role = profile.activeRole || profile.role;
    if (role === 'admin' || role === 'authority') navigate(profile.isMfaEnrolled ? '/auth/mfa-challenge' : '/auth/mfa-enrollment');
    else if (role === 'sacco_manager') navigate('/sacco');
    else navigate('/passenger');
  };

  const onSubmit = async (data: LoginFormValues) => {
    setErrorMsg(null);
    try { routeProfile(await authService.signInWithEmail(data.email, data.password)); }
    catch (err: unknown) {
      const authErr = err as { code?: string; message?: string; resolver?: unknown };
      if (authErr.code === 'auth/multi-factor-auth-required') { navigate('/auth/mfa-challenge', { state: { resolver: authErr.resolver } }); return; }
      console.error('Sign in error:', err); setErrorMsg(authErr.message || t('auth.login.invalidCredentials'));
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null); setIsGoogleLoading(true);
    try { routeProfile(await authService.signInWithGoogle()); }
    catch (err: unknown) {
      const authErr = err as { code?: string; resolver?: unknown };
      if (authErr.code === 'auth/multi-factor-auth-required') { navigate('/auth/mfa-challenge', { state: { resolver: authErr.resolver } }); return; }
      console.error('Google sign in error:', err); setErrorMsg('Failed to sign in with Google');
    } finally { setIsGoogleLoading(false); }
  };

  const handleGuestSignIn = async () => {
    setErrorMsg(null); setIsGuestLoading(true);
    try { await authService.signInGuest(); navigate('/passenger'); }
    catch (err: unknown) { console.error('Guest sign in error:', err); setErrorMsg('Failed to sign in as guest'); }
    finally { setIsGuestLoading(false); }
  };

  const handleSendMagicLink = async () => {
    const email = getValues('email');
    if (!email) { setErrorMsg(t('auth.login.emailPlaceholder')); return; }
    setErrorMsg(null);
    try { await authService.sendMagicLink(email); setMagicLinkSent(true); }
    catch (err: unknown) { console.error('Magic link error:', err); setErrorMsg('Failed to send magic link'); }
  };

  return (
    <main className="min-h-screen bg-surface text-on-surface lg:p-5 xl:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-[1500px] gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,.95fr)] xl:gap-7">
        <section className="hidden lg:block"><AuthPhotoHero /></section>
        <section className="flex items-center justify-center px-5 py-8 sm:px-8 lg:rounded-[36px] lg:bg-surface-container-low lg:px-10 xl:px-14">
          <div className="w-full max-w-lg">
            <div className="mb-8 flex items-center justify-between"><PrimaryLogo className="h-9 w-auto lg:hidden" /><Link to="/" className="text-xs font-bold text-on-surface-variant hover:text-primary">← Back to home</Link></div>
            <div className="mb-8"><div className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-primary">Welcome back</div><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('auth.login.title')}</h1><p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant">{t('auth.login.subtitle')}</p></div>
            {errorMsg && <div role="alert" className="mb-5 rounded-2xl bg-error-container p-4 text-sm text-on-error-container">{errorMsg}</div>}
            {magicLinkSent && <div role="status" className="mb-5 rounded-2xl bg-sage-light p-4 text-sm text-primary">{t('auth.login.magicLinkSent')}</div>}
            <div className="rounded-[28px] bg-surface p-5 shadow-sm ring-1 ring-outline-variant/30 sm:p-7">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input label={t('auth.login.emailLabel')} type="email" placeholder={t('auth.login.emailPlaceholder')} icon="mail" error={errors.email?.message} {...register('email')} />
                <Input label={t('auth.login.passwordLabel')} type="password" placeholder={t('auth.login.passwordPlaceholder')} icon="lock" error={errors.password?.message} {...register('password')} />
                <div className="flex justify-end"><Link to="/auth/forgot-password" className="text-sm font-bold text-primary hover:underline">{t('auth.login.forgotPassword')}</Link></div>
                <Button type="submit" variant="primary" className="min-h-12 w-full rounded-2xl" isLoading={isSubmitting}>{t('auth.login.signInButton')}</Button>
              </form>
              <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-outline-variant/50"/><span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t('auth.login.orContinueWith')}</span><div className="h-px flex-1 bg-outline-variant/50"/></div>
              <div className="space-y-2.5">
                <Button type="button" variant="outline" className="min-h-12 w-full rounded-2xl" onClick={handleGoogleSignIn} isLoading={isGoogleLoading}><span className="material-symbols-outlined text-xl text-primary">account_circle</span>{t('auth.login.googleSignIn')}</Button>
                <Button type="button" variant="outline" className="min-h-12 w-full rounded-2xl" onClick={handleSendMagicLink}>{t('auth.login.magicLink')}</Button>
                <button type="button" onClick={handleGuestSignIn} disabled={isGuestLoading} className="min-h-11 w-full rounded-2xl px-4 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container hover:text-primary disabled:opacity-60">{isGuestLoading ? t('common.loading') : t('auth.login.continueAsGuest')}</button>
              </div>
            </div>
            <div className="mt-6 text-center"><p className="text-sm text-on-surface-variant">{t('auth.login.noAccount')} <Link to="/auth/register" className="font-bold text-primary hover:underline">{t('auth.login.createOne')}</Link></p></div>
            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"><span className="material-symbols-outlined text-sm text-primary">verified_user</span>Secure sign-in · Your account is protected</div>
          </div>
        </section>
      </div>
    </main>
  );
};
