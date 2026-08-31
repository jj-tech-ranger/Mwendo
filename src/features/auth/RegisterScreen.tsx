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
import { useAuthStore } from '../../store/useAuthStore';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Please enter your display or full name'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  terms: z.boolean().refine((val) => val === true, 'You must agree to the Terms and Privacy Policy'),
  ageConfirmed: z.boolean().refine((val) => val === true, 'You must confirm you are 18 years or older, or a parent/guardian has provided consent'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const RegisterPhotoHero: React.FC = () => (
  <section className="relative hidden min-h-screen overflow-hidden bg-surface-container-high text-on-primary lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-16">
    {/* High-Resolution Transit & Highway Photo */}
    <img
      src="https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=1200&q=80"
      alt="Scenic highway journey across Kenya"
      referrerPolicy="no-referrer"
      className="absolute inset-0 h-full w-full object-cover object-center"
    />

    {/* Brand Gradient Overlay for Maximum Visual Depth & Legibility */}
    <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/75 to-black/45" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_60%)]" />

    {/* Header */}
    <div className="relative z-10 flex items-center justify-between gap-4">
      <img src="/brand/logo-dark.png" alt="Mwendo Salama" className="h-11 w-auto" />
      <span className="rounded-full border border-white/20 bg-black/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-white backdrop-blur-md">
        Safer Journeys
      </span>
    </div>

    {/* Center Feature Card */}
    <div className="relative z-10 my-auto py-8">
      <div className="max-w-md rounded-3xl border border-white/20 bg-slate-950/70 p-6 text-white shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
            <span className="material-symbols-outlined text-2xl">verified_user</span>
          </span>
          <div>
            <p className="text-sm font-extrabold text-white">What You Get as a Passenger</p>
            <p className="text-xs text-white/70">Continuous on-trip safety guardian</p>
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
              <span className="material-symbols-outlined text-base">speed</span>
            </span>
            <div className="text-xs">
              <p className="font-bold text-white">Live Speed Awareness</p>
              <p className="text-white/65">Automatic detection when vehicle exceeds 80 km/h</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
              <span className="material-symbols-outlined text-base">report_problem</span>
            </span>
            <div className="text-xs">
              <p className="font-bold text-white">Community Black Spot Alerts</p>
              <p className="text-white/65">Real-time alerts when approaching dangerous sectors</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-300">
              <span className="material-symbols-outlined text-base">emergency</span>
            </span>
            <div className="text-xs">
              <p className="font-bold text-white">Rapid SOS Emergency Response</p>
              <p className="text-white/65">Instant location and vehicle broadcast to responders</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Footer Callout */}
    <div className="relative z-10 max-w-xl">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-emerald-300">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        Join Mwendo Salama
      </div>
      <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">
        Turn every trip into better safety data.
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-6 text-white/80">
        Track journeys, understand road risks, and help make public transport safer across Kenya.
      </p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-white/90">
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
          Live trip safety
        </span>
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
          Hazard reporting
        </span>
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
          Emergency support
        </span>
      </div>
    </div>
  </section>
);

export const RegisterScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { register, handleSubmit, watch, trigger, getValues, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: currentUser?.displayName && !currentUser?.isAnonymous ? currentUser.displayName : '', email: currentUser?.email || '', terms: false, ageConfirmed: false },
  });
  const passwordValue = watch('password', '');
  const strength = !passwordValue ? { score: 0, label: '' } : passwordValue.length < 6 ? { score: 1, label: 'Too short' } : passwordValue.length >= 10 && /[A-Z]/.test(passwordValue) && /[0-9]/.test(passwordValue) && /[^A-Za-z0-9]/.test(passwordValue) ? { score: 3, label: 'Strong' } : { score: 2, label: 'Medium' };

  const onSubmit = async (data: RegisterFormValues) => {
    setErrorMsg(null);
    try {
      await authService.registerWithEmail(data.email, data.password, data.fullName, 'passenger', {
        termsAccepted: data.terms,
        ageConfirmed: data.ageConfirmed,
      });
      navigate('/passenger');
    } catch (err: unknown) {
      console.error('Registration error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    }
  };

  const handleGoogleRegister = async () => {
    setErrorMsg(null);
    const validConsent = await trigger(['terms', 'ageConfirmed']);
    if (!validConsent) return;
    setIsGoogleLoading(true);
    try {
      const values = getValues();
      await authService.signInWithGoogle({ termsAccepted: values.terms, ageConfirmed: values.ageConfirmed });
      navigate('/passenger');
    } catch (err: unknown) {
      console.error('Google register error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to register with Google');
    } finally { setIsGoogleLoading(false); }
  };

  return (
    <main className="min-h-screen bg-surface text-on-surface lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(480px,.9fr)]">
      <RegisterPhotoHero />
      <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-10 xl:px-16">
        <div className="w-full max-w-xl">
          <div className="mb-7 flex items-center justify-between"><PrimaryLogo className="h-9 w-auto lg:hidden" /><Link to="/auth/login" className="ml-auto text-xs font-bold text-on-surface-variant hover:text-primary">Already have an account? Sign in</Link></div>
          <header className="mb-7"><div className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-primary">Create your account</div><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('auth.register.title')}</h2><p className="mt-2 max-w-lg text-sm leading-6 text-on-surface-variant">{currentUser?.isAnonymous ? t('auth.register.guestUpgradeSubtitle') : 'Set up your passenger account and start your safer journey.'}</p></header>
          {errorMsg && <div role="alert" className="mb-5 rounded-2xl bg-error-container p-4 text-sm text-on-error-container">{errorMsg}</div>}
          <div className="rounded-[30px] bg-surface-container-low p-4 sm:p-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-[24px] bg-surface p-5 shadow-sm ring-1 ring-outline-variant/20 sm:p-7">
              <div className="grid gap-4 sm:grid-cols-2"><Input label={t('auth.register.fullNameLabel')} placeholder={t('auth.register.fullNamePlaceholder')} icon="person" error={errors.fullName?.message} {...register('fullName')} /><Input label={t('auth.register.emailLabel')} type="email" placeholder={t('auth.register.emailPlaceholder')} icon="mail" error={errors.email?.message} {...register('email')} /></div>
              <div className="space-y-1"><Input label={t('auth.register.passwordLabel')} type="password" placeholder={t('auth.register.passwordPlaceholder')} icon="lock" error={errors.password?.message} {...register('password')} />{passwordValue && <div className="space-y-1 pt-1" aria-live="polite"><div className="grid grid-cols-3 gap-1"><span className={`h-1.5 rounded-full ${strength.score >= 1 ? 'bg-error' : 'bg-outline-variant/30'}`} /><span className={`h-1.5 rounded-full ${strength.score >= 2 ? 'bg-amber-500' : 'bg-outline-variant/30'}`} /><span className={`h-1.5 rounded-full ${strength.score >= 3 ? 'bg-primary' : 'bg-outline-variant/30'}`} /></div><div className="flex justify-between text-[11px] font-bold text-on-surface-variant"><span>Password strength</span><span>{strength.label}</span></div></div>}</div>
              <fieldset className="space-y-3 rounded-2xl bg-surface-container-low p-4"><legend className="px-1 text-xs font-bold uppercase tracking-[.12em] text-on-surface-variant">Account consent</legend><label htmlFor="terms" className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-on-surface-variant"><input id="terms" type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline text-primary focus:ring-primary" {...register('terms')} /><span>I agree to the Mwendo Salama <a href="/passenger/profile" className="font-bold text-primary underline">{t('auth.register.termsLink')}</a> and Privacy Policy.</span></label>{errors.terms && <p className="text-xs text-error" role="alert">{errors.terms.message}</p>}<label htmlFor="ageConfirmed" className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-on-surface-variant"><input id="ageConfirmed" type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline text-primary focus:ring-primary" {...register('ageConfirmed')} /><span>{t('auth.register.ageConfirmation')}</span></label>{errors.ageConfirmed && <p className="text-xs text-error" role="alert">{errors.ageConfirmed.message}</p>}</fieldset>
              <Button type="submit" variant="primary" className="min-h-12 w-full rounded-2xl" isLoading={isSubmitting}>{currentUser?.isAnonymous ? t('auth.register.upgradeButton') : t('auth.register.registerButton')}</Button>
            </form>
          </div>
          <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-outline-variant/50"/><span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t('auth.login.orContinueWith')}</span><div className="h-px flex-1 bg-outline-variant/50"/></div>
          <Button type="button" variant="outline" className="min-h-12 w-full rounded-2xl" onClick={handleGoogleRegister} isLoading={isGoogleLoading}><span className="material-symbols-outlined text-xl text-primary">account_circle</span>{t('auth.register.googleSignUp')}</Button>
          <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"><span className="material-symbols-outlined text-sm text-primary">verified_user</span>Secure account creation · Kenya-first safety platform</div>
        </div>
      </section>
    </main>
  );
};
