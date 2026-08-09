import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrimaryLogo, BRAND_ASSETS } from '../../components/assets/BrandAssets';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authService } from '../../services/authService';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginScreen: React.FC = () => {
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
      await authService.signInWithEmail(data.email, data.password);
      navigate('/passenger');
    } catch (err: any) {
      console.error('Sign in error:', err);
      setErrorMsg(err.message || 'Invalid email or password');
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    try {
      await authService.signInWithGoogle();
      navigate('/passenger');
    } catch (err: any) {
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
      setErrorMsg('Please enter your email above to receive a login link.');
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
          <h1 className="font-headline-lg text-primary">Welcome back</h1>
          <p className="font-body-md text-on-surface-variant">
            Sign in to access your safety dashboard and trip history.
          </p>
        </div>

        {errorMsg && (
          <div className="p-md rounded-xl bg-error-container text-on-error-container text-body-sm text-center">
            {errorMsg}
          </div>
        )}

        {magicLinkSent && (
          <div className="p-md rounded-xl bg-sage-light text-primary text-body-sm text-center">
            Magic login link sent to your email! Please check your inbox.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-md">
          <Input
            label="Email Address"
            type="email"
            placeholder="Enter your email"
            icon="mail"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            icon="lock"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex justify-end">
            <Link
              to="/auth/forgot-password"
              className="font-label-bold text-xs text-secondary hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
            Log In
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/40" />
          </div>
          <div className="relative flex justify-center text-xs font-label-mono">
            <span className="bg-surface px-2 text-on-surface-variant uppercase">
              or continue with
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
            Sign in with Google
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full text-xs"
            onClick={handleSendMagicLink}
          >
            Email me a magic login link
          </Button>

          <button
            type="button"
            onClick={handleGuestSignIn}
            disabled={isGuestLoading}
            className="w-full py-2 text-center text-xs font-label-bold text-on-surface-variant hover:text-primary transition-colors"
          >
            {isGuestLoading ? 'Loading Guest Mode...' : 'Continue as Anonymous Guest'}
          </button>
        </div>

        <div className="text-center pt-md border-t border-outline-variant/30">
          <p className="font-body-sm text-on-surface-variant">
            Don't have an account?{' '}
            <Link to="/auth/register" className="font-label-bold text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
