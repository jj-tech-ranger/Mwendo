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
  // SEC-002: Consent must be an affirmative, un-prechecked action
  terms: z.boolean().refine((val) => val === true, 'You must agree to the Terms and Privacy Policy'),
  // SEC-003: Mandatory age confirmation gate
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

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-outline-variant' };
    if (pass.length < 6) return { score: 1, label: 'Too short', color: 'bg-error' };
    if (pass.length >= 6 && /[A-Z]/.test(pass) && /[0-9]/.test(pass)) {
      return { score: 3, label: 'Strong', color: 'bg-primary' };
    }
    return { score: 2, label: 'Medium', color: 'bg-amber-500' };
  };

  const strength = getPasswordStrength(passwordValue);

  const onSubmit = async (data: RegisterFormValues) => {
    setErrorMsg(null);
    try {
      await authService.registerWithEmail(data.email, data.password, data.fullName, 'passenger');
      navigate('/passenger');
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    }
  };

  const handleGoogleRegister = async () => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    try {
      await authService.signInWithGoogle();
      navigate('/passenger');
    } catch (err: any) {
      console.error('Google register error:', err);
      setErrorMsg('Failed to register with Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-center items-center p-margin-mobile">
      <div className="w-full max-w-sm space-y-lg">
        <div className="flex flex-col items-center text-center space-y-md">
          <PrimaryLogo className="h-12 w-auto mb-2" />
          <h1 className="font-headline-lg text-primary">{t('auth.register.title')}</h1>
          <p className="font-body-md text-on-surface-variant">
            {currentUser?.isAnonymous
              ? t('auth.register.guestUpgradeSubtitle')
              : t('auth.register.subtitle')}
          </p>
        </div>

        {errorMsg && (
          <div className="p-md rounded-xl bg-error-container text-on-error-container text-body-sm text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-md">
          <Input
            label={t('auth.register.fullNameLabel')}
            placeholder={t('auth.register.fullNamePlaceholder')}
            icon="person"
            error={errors.fullName?.message}
            {...register('fullName')}
          />

          <Input
            label={t('auth.register.emailLabel')}
            type="email"
            placeholder={t('auth.register.emailPlaceholder')}
            icon="mail"
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="space-y-1">
            <Input
              label={t('auth.register.passwordLabel')}
              type="password"
              placeholder={t('auth.register.passwordPlaceholder')}
              icon="lock"
              error={errors.password?.message}
              {...register('password')}
            />
            {passwordValue && (
              <div className="space-y-1 pt-1">
                <div className="h-1.5 w-full bg-outline-variant/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${(strength.score / 3) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-label-bold text-on-surface-variant">
                  <span>{t('auth.register.passwordStrength')}</span>
                  <span className="capitalize">{strength.label}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="terms"
              className="mt-1 h-4 w-4 rounded border-outline text-primary focus:ring-primary"
              {...register('terms')}
            />
            <label htmlFor="terms" className="text-xs text-on-surface-variant leading-tight">
              I agree to the Mwendo Salama{' '}
              <a href="/passenger/profile" className="text-primary font-label-bold underline">
                {t('auth.register.termsLink')}
              </a>{' '}
              and Privacy Policy.
            </label>
          </div>
          {errors.terms && (
            <p className="text-xs text-error font-body-sm">{errors.terms.message}</p>
          )}

          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="ageConfirmed"
              className="mt-1 h-4 w-4 rounded border-outline text-primary focus:ring-primary"
              {...register('ageConfirmed')}
            />
            <label htmlFor="ageConfirmed" className="text-xs text-on-surface-variant leading-tight">
              {t('auth.register.ageConfirmation')}
            </label>
          </div>
          {errors.ageConfirmed && (
            <p className="text-xs text-error font-body-sm">{errors.ageConfirmed.message}</p>
          )}

          <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
            {currentUser?.isAnonymous ? t('auth.register.upgradeButton') : t('auth.register.registerButton')}
          </Button>
        </form>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/40" />
          </div>
          <div className="relative flex justify-center text-xs font-label-mono">
            <span className="bg-surface px-2 text-on-surface-variant uppercase">
              {t('auth.login.orContinueWith')}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center justify-center gap-2"
          onClick={handleGoogleRegister}
          isLoading={isGoogleLoading}
        >
          <span className="material-symbols-outlined text-xl text-primary">account_circle</span>
          {t('auth.register.googleSignUp')}
        </Button>

        <div className="text-center pt-md border-t border-outline-variant/30">
          <p className="font-body-sm text-on-surface-variant">
            {t('auth.register.hasAccount')}{' '}
            <Link to="/auth/login" className="font-label-bold text-primary hover:underline">
              {t('auth.register.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
