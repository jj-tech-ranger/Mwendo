import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';

export const EmailVerificationScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-center items-center p-margin-mobile text-center">
      <div className="w-full max-w-sm space-y-lg bg-surface-container-lowest p-lg sm:p-xl rounded-2xl border border-outline-variant/30 shadow-sm">
        <PrimaryLogo className="h-10 w-auto mx-auto mb-2" />
        <span className="material-symbols-outlined text-5xl text-primary">mark_email_unread</span>
        <h1 className="font-headline-lg text-on-surface">Verify Your Email</h1>
        <p className="font-body-md text-on-surface-variant leading-relaxed">
          We’ve sent a verification link to your email address. Please click the link in the email to activate your account.
        </p>

        <div className="space-y-md pt-2">
          <Button variant="primary" className="w-full" onClick={() => navigate('/auth/login')}>
            Proceed to Login
          </Button>
          <Button variant="ghost" className="w-full">
            Resend Email
          </Button>
        </div>

        <div className="pt-2">
          <Link to="/auth/login" className="font-label-bold text-xs text-outline hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
