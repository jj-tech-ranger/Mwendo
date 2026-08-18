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

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setErrorMsg(null);
    try {
      const profile = await authService.signInWithEmail(data.email, data.password);
      const role = profile.activeRole || profile.role;
      if (role === 'admin' || role === 'authority') {
        if (!profile.isMfaEnrolled) {
          navigate('/auth/mfa-enrollment');
        } else {
          navigate('/auth/mfa-challenge');
        }
      } else if (role === 'sacco_manager') {
        navigate('/sacco');
      } else {
        navigate('/passenger');
      }
    } catch (err: any) {
      if (err.code === 'auth/multi-factor-auth-required') {
        navigate('/auth/mfa-challenge', { state: { resolver: err.resolver } });
        return;
      }
      console.error('Sign in error:', err);
      setErrorMsg(err.message || t('auth.login.invalidCredentials'));
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    try {
      const profile = await authService.signInWithGoogle();
      const role = profile.activeRole || profile.role;
      if (role === 'admin' || role === 'authority') {
        if (!profile.isMfaEnrolled) {
          navigate('/auth/mfa-enrollment');
        } else {
          navigate('/auth/mfa-challenge');
        }
      } else if (role === 'sacco_manager') {
        navigate('/sacco');
      } else {
        navigate('/passenger');
      }
    } catch (err: any) {
      if (err.code === 'auth/multi-factor-auth-required') {
        navigate('/auth/mfa-challenge', { state: { resolver: err.resolver } });
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
    } catch (err: any) {
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
    } catch (err: any) {
      console.error('Magic link error:', err);
      setErrorMsg('Failed to send magic link');
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-center items-center p-margin-mobile">
      <div className="w-full max-w-sm space-y-lg">
        <div className="flex flex-col items-center text-center space-y-md">
          <PrimaryLogo className="h-12 w-auto mb-2" />
          <h1 className="font-headline-lg text-primary">{t('auth.login.title')}</h1>
          <p className="font-body-md text-on-surface-variant">
            {t('auth.login.subtitle')}
          </p>
        </div>

        {errorMsg && (
          <div className="p-md rounded-xl bg-error-container text-on-error-container text-body-sm text-center">
            {errorMsg}
          </div>
        )}

        {magicLinkSent && (
          <div className="p-md rounded-xl bg-sage-light text-primary text-body-sm text-center">
            {t('auth.login.magicLinkSent')}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-md">
          <Input
            label={t('auth.login.emailLabel')}
            type="email"
            placeholder={t('auth.login.emailPlaceholder')}
            icon="mail"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label={t('auth.login.passwordLabel')}
            type="password"
            placeholder={t('auth.login.passwordPlaceholder')}
            icon="lock"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex justify-end">
            <Link
              to="/auth/forgot-password"
              className="font-label-bold text-xs text-secondary hover:underline"
            >
              {t('auth.login.forgotPassword')}
            </Link>
          </div>

          <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
            {t('auth.login.signInButton')}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/40" />
          </div>
          <div className="relative flex justify-center text-xs font-label-mono">
            <span className="bg-surface px-2 text-on-surface-variant uppercase">
              {t('auth.login.orContinueWith')}
            </span>
          </div>
        </div>

        <div className="space-y-sm">
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            onClick={handleGoogleSignIn}
            isLoading={isGoogleLoading}
          >
            <span className="material-symbols-outlined text-xl text-primary">account_circle</span>
            {t('auth.login.googleSignIn')}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full text-xs"
            onClick={handleSendMagicLink}
          >
            {t('auth.login.magicLink')}
          </Button>

          <button
            type="button"
            onClick={handleGuestSignIn}
            disabled={isGuestLoading}
            className="w-full py-2 text-center text-xs font-label-bold text-on-surface-variant hover:text-primary transition-colors"
          >
            {isGuestLoading ? t('common.loading') : t('auth.login.continueAsGuest')}
          </button>
        </div>

        <div className="text-center pt-md border-t border-outline-variant/30">
          <p className="font-body-sm text-on-surface-variant">
            {t('auth.login.noAccount')}{' '}
            <Link to="/auth/register" className="font-label-bold text-primary hover:underline">
              {t('auth.login.createOne')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
