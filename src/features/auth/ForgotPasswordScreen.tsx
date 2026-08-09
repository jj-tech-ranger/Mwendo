import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PrimaryLogo } from '../../components/assets/BrandAssets';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export const ForgotPasswordScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-center items-center p-margin-mobile">
      <div className="w-full max-w-sm space-y-lg text-center">
        <PrimaryLogo className="h-12 w-auto mx-auto mb-2" />
        <h1 className="font-headline-lg text-primary">Reset Your Password</h1>

        {submitted ? (
          <div className="space-y-md bg-surface-container-lowest p-lg rounded-2xl border border-outline-variant/30">
            <span className="material-symbols-outlined text-4xl text-secondary">mark_email_read</span>
            <p className="font-body-md text-on-surface">
              Password reset link sent to <span className="font-bold">{email}</span>. Please check your inbox.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setSubmitted(false)}>
              Try Another Email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-md text-left">
            <p className="font-body-md text-on-surface-variant text-center mb-md">
              Enter your registered email address to receive password reset instructions.
            </p>
            <Input
              label="Email Address"
              type="email"
              placeholder="juma@example.com"
              icon="mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" className="w-full">
              Send Reset Link
            </Button>
          </form>
        )}

        <div>
          <Link to="/auth/login" className="font-label-bold text-xs text-outline hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
