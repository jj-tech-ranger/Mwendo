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
  ageConfirmed: z.boolean().refine(
    (val) => val === true,
    'You must confirm you are 18 years or older, or a parent/guardian has provided consent'
  ),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: currentUser?.displayName && !currentUser?.isAnonymous ? currentUser.displayName : '',
      email: currentUser?.email || '',
      terms: false,
      ageConfirmed: false,
    },
  });

  const passwordValue = watch('password', '');
  const strength = !passwordValue
    ? { score: 0, label: '', color: 'bg-outline-variant' }
    : passwordValue.length < 6
      ? { score: 1, label: 'Too short', color: 'bg-error' }
      : passwordValue.length >= 6 && /[A-Z]/.test(passwordValue) && /[0-9]/.test(passwordValue)
        ? { score: 3, label: 'Strong', color: 'bg-primary' }
        : { score: 2, label: 'Medium', color: 'bg-amber-500' };

  const onSubmit = async (data: RegisterFormValues) => {
    setErrorMsg(null);
    try {
      await authService.registerWithEmail(data.email, data.password, data.fullName, 'passenger');
      navigate('/passenger');
    } catch (err: unknown) {
      console.error('Registration error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMsg(errMsg || 'Registration failed. Please try again.');
    }
  };

  const handleGoogleRegister = async () => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    try {
      await authService.signInWithGoogle();
      navigate('/passenger');
    } catch (err: unknown) {
      console.error('Google register error:', err);
      setErrorMsg('Failed to register with Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface text-on-surface lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
      <section className="relative hidden overflow-hidden bg-primary px-12 py-12 text-on-primary lg:flex lg:min-h-screen lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-24 top-16 h-72 w-72 rounded-full border border-on-primary/10" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full border border-on-primary/10" />
        <img src="/brand/logo-dark.png" alt="Mwendo Salama" className="relative z-10 h-12 w-auto object-contain self-start" />
        <div className="relative z-10 max-w-xl space-y-6">
          <p className="font-label-bold text-sm uppercase tracking-[0.18em] text-on-primary/70">Join Mwendo Salama</p>
          <h1 className="font-headline-xl max-w-lg leading-tight">Make every journey safer, one trip at a time.</h1>
          <p className="max-w-md text-base leading-7 text-on-primary/80">Create your passenger account to track journeys, understand road risks, and contribute trusted safety information across Kenya.</p>
          <div className="grid max-w-md grid-cols-2 gap-3 pt-2 text-sm">
            <div className="rounded-2xl border border-on-primary/10 bg-on-primary/5 p-4"><div className="font-label-bold text-on-primary">Track trips</div><div className="mt-1 text-on-primary/65">Follow your journey in real time.</div></div>
            <div className="rounded-2xl border border-on-primary/10 bg-on-primary/5 p-4"><div className="font-label-bold text-on-primary">Report risks</div><div className="mt-1 text-on-primary/65">Help others spot road hazards.</div></div>
          </div>
        </div>
        <p className="relative z-10 text-xs text-on-primary/60">Built for safer public transport in Kenya.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12 xl:px-20">
        <div className="w-full max-w-md space-y-7">
          <header className="text-center lg:text-left">
            <PrimaryLogo className="mx-auto mb-7 h-10 w-auto lg:hidden" />
            <div className="mb-2 text-xs font-label-bold uppercase tracking-[0.16em] text-primary">Create your account</div>
            <h2 className="font-headline-lg text-on-surface">{t('auth.register.title')}</h2>
            <p className="mt-2 font-body-md text-on-surface-variant">{currentUser?.isAnonymous ? t('auth.register.guestUpgradeSubtitle') : t('auth.register.subtitle')}</p>
          </header>

          {errorMsg && <div role="alert" className="rounded-2xl bg-error-container p-4 text-sm text-on-error-container">{errorMsg}</div>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input label={t('auth.register.fullNameLabel')} placeholder={t('auth.register.fullNamePlaceholder')} icon="person" error={errors.fullName?.message} {...register('fullName')} />
            <Input label={t('auth.register.emailLabel')} type="email" placeholder={t('auth.register.emailPlaceholder')} icon="mail" error={errors.email?.message} {...register('email')} />

            <div className="space-y-1">
              <Input label={t('auth.register.passwordLabel')} type="password" placeholder={t('auth.register.passwordPlaceholder')} icon="lock" error={errors.password?.message} {...register('password')} />
              {passwordValue && (
                <div className="space-y-1 pt-1" aria-live="polite">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-outline-variant/30">
                    <div className={`h-full transition-all duration-300 ${strength.color}`} style={{ width: `${(strength.score / 3) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] font-label-bold text-on-surface-variant">
                    <span>{t('auth.register.passwordStrength')}</span><span className="capitalize">{strength.label}</span>
                  </div>
                </div>
              )}
            </div>

            <fieldset className="space-y-4 rounded-2xl bg-surface-container-low p-4">
              <legend className="px-1 text-xs font-label-bold uppercase tracking-[0.12em] text-on-surface-variant">Account consent</legend>
              <label htmlFor="terms" className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-on-surface-variant">
                <input id="terms" type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline text-primary focus:ring-primary" {...register('terms')} />
                <span>I agree to the Mwendo Salama <a href="/passenger/profile" className="font-label-bold text-primary underline">{t('auth.register.termsLink')}</a> and Privacy Policy.</span>
              </label>
              {errors.terms && <p className="text-xs text-error" role="alert">{errors.terms.message}</p>}
              <label htmlFor="ageConfirmed" className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-on-surface-variant">
                <input id="ageConfirmed" type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline text-primary focus:ring-primary" {...register('ageConfirmed')} />
                <span>{t('auth.register.ageConfirmation')}</span>
              </label>
              {errors.ageConfirmed && <p className="text-xs text-error" role="alert">{errors.ageConfirmed.message}</p>}
            </fieldset>

            <Button type="submit" variant="primary" className="min-h-12 w-full" isLoading={isSubmitting}>{currentUser?.isAnonymous ? t('auth.register.upgradeButton') : t('auth.register.registerButton')}</Button>
          </form>

          <div className="relative py-1"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/50" /></div><div className="relative flex justify-center"><span className="bg-surface px-3 text-xs font-label-mono uppercase text-on-surface-variant">{t('auth.login.orContinueWith')}</span></div></div>

          <Button type="button" variant="outline" className="min-h-12 w-full" onClick={handleGoogleRegister} isLoading={isGoogleLoading}><span className="material-symbols-outlined text-xl text-primary">account_circle</span>{t('auth.register.googleSignUp')}</Button>

          <div className="border-t border-outline-variant/40 pt-6 text-center lg:text-left">
            <p className="font-body-sm text-on-surface-variant">{t('auth.register.hasAccount')}{' '}<Link to="/auth/login" className="font-label-bold text-primary hover:underline">{t('auth.register.signIn')}</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
};
