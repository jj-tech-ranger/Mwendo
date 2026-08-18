import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { mfaService } from '../../services/mfaService';

export const MfaChallengeScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuthStore();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resolver = (location.state as any)?.resolver || null;

  async function handleVerifyChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await mfaService.verifyChallenge(code, resolver);

      if (user) {
        setUser({ ...user, isMfaVerified: true });
      }

      const role = user?.activeRole || user?.role;
      if (role === 'admin') navigate('/admin');
      else if (role === 'authority') navigate('/authority');
      else if (role === 'sacco_manager') navigate('/sacco');
      else navigate('/passenger');
    } catch (err: any) {
      console.error('MFA Verification failed:', err);
      setErrorMsg(err.message || t('auth.mfa.invalidCode'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-center items-center p-margin-mobile">
      <div className="w-full max-w-md space-y-lg bg-surface-container-lowest border border-outline-variant/30 p-xl rounded-3xl shadow-2xl">
        <div className="flex flex-col items-center text-center space-y-xs">
          <PrimaryLogo className="h-10 w-auto mb-2" />
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2">
            <span className="material-symbols-outlined text-2xl">security</span>
          </div>
          <h1 className="font-headline-lg text-lg text-primary font-bold">
            {t('auth.mfa.challengeTitle')}
          </h1>
          <p className="font-body-sm text-xs text-on-surface-variant max-w-sm">
            {t('auth.mfa.challengeSubtitle')}
          </p>
        </div>

        {errorMsg && (
          <div className="p-md rounded-xl bg-error-container text-on-error-container text-xs font-body-sm text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleVerifyChallenge} className="space-y-md">
          <div className="space-y-2">
            <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant block text-center">
              {t('auth.mfa.codeLabel')}
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-surface-container border border-outline-variant/40 rounded-xl p-3 text-center text-xl font-mono tracking-widest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3"
            isLoading={isSubmitting}
          >
            {t('auth.mfa.verifyButton')}
          </Button>
        </form>

        <div className="text-center pt-md border-t border-outline-variant/20">
          <button
            onClick={() => navigate('/auth/login')}
            className="font-label-bold text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            {t('auth.forgotPassword.backToLogin')}
          </button>
        </div>
      </div>
    </div>
  );
};
