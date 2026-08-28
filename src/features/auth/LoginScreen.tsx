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

const JourneyVisual: React.FC = () => (
  <div className="relative h-full min-h-[520px] overflow-hidden rounded-[36px] bg-primary p-8 text-on-primary lg:min-h-[680px]">
    <style>{`
      @keyframes routeFlow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -420; } }
      @keyframes beaconPulse { 0%,100% { transform: scale(.72); opacity: .18; } 50% { transform: scale(1.18); opacity: .72; } }
      @keyframes orbit { from { transform: rotate(0deg) translateX(88px) rotate(0deg); } to { transform: rotate(360deg) translateX(88px) rotate(-360deg); } }
      @keyframes floatCard { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
      @keyframes signal { 0%,100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1); } }
      @keyframes sweep { 0% { transform: translateX(-130%); opacity: 0; } 15%,75% { opacity: .5; } 100% { transform: translateX(130%); opacity: 0; } }
      .mw-route-flow { animation: routeFlow 7s linear infinite; }
      .mw-beacon { transform-box: fill-box; transform-origin: center; animation: beaconPulse 3.2s ease-in-out infinite; }
      .mw-orbit { transform-box: fill-box; transform-origin: center; animation: orbit 8s linear infinite; }
      .mw-float { animation: floatCard 5s ease-in-out infinite; }
      .mw-signal { animation: signal 2.2s ease-in-out infinite; }
      .mw-sweep { animation: sweep 5s ease-in-out infinite; }
      @media(prefers-reduced-motion:reduce){.mw-route-flow,.mw-beacon,.mw-orbit,.mw-float,.mw-signal,.mw-sweep{animation:none!important}}
    `}</style>

    <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full border border-on-primary/10" />
    <div className="absolute -bottom-40 -left-28 h-[28rem] w-[28rem] rounded-full border border-on-primary/10" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_42%,rgba(255,255,255,.12),transparent_30%)]" />

    <div className="relative z-10 flex h-full flex-col justify-between">
      <div className="flex items-center justify-between gap-4">
        <img src="/brand/logo-dark.png" alt="Mwendo Salama" className="h-11 w-auto" />
        <span className="rounded-full border border-on-primary/10 bg-on-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em]">Kenya safety network</span>
      </div>

      <div className="relative flex flex-1 items-center justify-center py-8">
        <svg viewBox="0 0 520 460" className="h-full w-full max-w-xl" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="login-route" x1="70" y1="385" x2="470" y2="45" gradientUnits="userSpaceOnUse">
              <stop stopColor="rgba(255,255,255,.2)" />
              <stop offset=".55" stopColor="rgba(255,255,255,.65)" />
              <stop offset="1" stopColor="rgba(255,255,255,.95)" />
            </linearGradient>
          </defs>

          <path d="M70 385 C145 340 130 260 215 240 S315 205 345 130 S425 85 470 45" stroke="rgba(255,255,255,.09)" strokeWidth="38" strokeLinecap="round" />
          <path d="M70 385 C145 340 130 260 215 240 S315 205 345 130 S425 85 470 45" stroke="url(#login-route)" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 17" className="mw-route-flow" />

          <circle cx="70" cy="385" r="10" fill="white" />
          <circle cx="470" cy="45" r="10" fill="white" />
          <circle cx="70" cy="385" r="22" stroke="rgba(255,255,255,.18)" className="mw-signal" />
          <circle cx="470" cy="45" r="22" stroke="rgba(255,255,255,.18)" className="mw-signal" style={{ animationDelay: '1s' }} />

          <g transform="translate(260 220)">
            <circle r="78" fill="rgba(255,255,255,.055)" className="mw-beacon" />
            <circle r="48" stroke="rgba(255,255,255,.13)" strokeWidth="1" strokeDasharray="3 8" />
            <g className="mw-orbit">
              <circle cx="0" cy="0" r="5" fill="#a7f3b0" />
            </g>
            <circle r="34" fill="white" />
            <circle r="13" fill="#1A5C2E" />
          </g>

          <g transform="translate(92 100)" className="mw-float">
            <rect width="142" height="54" rx="17" fill="rgba(255,255,255,.105)" stroke="rgba(255,255,255,.08)" />
            <circle cx="23" cy="27" r="7" fill="#86efac" />
            <text x="40" y="24" fill="white" fontSize="11" fontWeight="700">SAFE ROUTE</text>
            <text x="40" y="39" fill="rgba(255,255,255,.62)" fontSize="9">Live monitoring</text>
          </g>

          <g transform="translate(336 306)" className="mw-float" style={{ animationDelay: '1.2s' }}>
            <rect width="132" height="54" rx="17" fill="rgba(255,255,255,.105)" stroke="rgba(255,255,255,.08)" />
            <circle cx="23" cy="27" r="7" fill="#fde68a" />
            <text x="40" y="24" fill="white" fontSize="11" fontWeight="700">ROAD ALERT</text>
            <text x="40" y="39" fill="rgba(255,255,255,.62)" fontSize="9">Ready when needed</text>
          </g>

          <rect x="0" y="0" width="160" height="460" fill="url(#login-route)" opacity=".06" className="mw-sweep" />
        </svg>
      </div>

      <div className="max-w-lg">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-on-primary/60">
          <span className="h-1.5 w-1.5 rounded-full bg-on-primary/70" />
          Mwendo Salama
        </div>
        <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">Every journey deserves a safer route.</h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-on-primary/70">Track journeys, understand road risks, and help make public transport safer across Kenya.</p>
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
    <main className="min-h-screen bg-surface text-on-surface lg:p-5 xl:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-[1500px] gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,.95fr)] xl:gap-7">
        <section className="hidden lg:block"><JourneyVisual /></section>
        <section className="flex items-center justify-center px-5 py-8 sm:px-8 lg:rounded-[36px] lg:bg-surface-container-low lg:px-10 xl:px-14">
          <div className="w-full max-w-lg">
            <div className="mb-8 flex items-center justify-between">
              <PrimaryLogo className="h-9 w-auto lg:hidden" />
              <Link to="/" className="text-xs font-bold text-on-surface-variant hover:text-primary">← Back to home</Link>
            </div>
            <div className="mb-8">
              <div className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-primary">Welcome back</div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('auth.login.title')}</h1>
              <p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant">{t('auth.login.subtitle')}</p>
            </div>
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
