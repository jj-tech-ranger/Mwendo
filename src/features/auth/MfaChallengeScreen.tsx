import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { mfaService } from '../../services/mfaService';
import { MultiFactorResolver } from 'firebase/auth';

export const MfaChallengeScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuthStore();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resolver = (location.state as { resolver?: MultiFactorResolver } | null)?.resolver;

  async function handleVerifyChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await mfaService.verifyChallenge(code, resolver);
      if (user) setUser({ ...user, isMfaVerified: true });

      const role = user?.activeRole || user?.role;
      if (role === 'admin') navigate('/admin');
      else if (role === 'authority') navigate('/authority');
      else if (role === 'sacco_manager') navigate('/sacco');
      else navigate('/passenger');
    } catch (err: unknown) {
      console.error('MFA Verification failed:', err);
      setErrorMsg(err instanceof Error ? err.message : String(err) || t('auth.mfa.invalidCode'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-on-background relative overflow-hidden flex items-center justify-center p-4 sm:p-8">
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-outline-variant/30 bg-surface-container-lowest shadow-2xl md:grid md:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden md:flex bg-primary p-10 text-on-primary flex-col justify-between min-h-[560px]">
          <div>
            <img src="/brand/logo-dark.png" alt="Mwendo Salama" className="h-10 w-auto" />
            <div className="mt-20 h-20 w-20 rounded-3xl bg-white/10 border border-white/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl">verified_user</span>
            </div>
            <h2 className="mt-7 font-headline-lg text-3xl font-bold leading-tight">One more step to keep your account secure.</h2>
            <p className="mt-4 text-sm leading-6 text-on-primary/80 max-w-sm">Enter the six-digit code from your authenticator app. Your verification stays private and helps protect your Mwendo Salama account.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-on-primary/70">
            <span className="material-symbols-outlined text-base">lock</span>
            Secure two-factor verification
          </div>
        </section>

        <section className="p-6 sm:p-10 lg:p-14 flex flex-col justify-center">
          <div className="md:hidden mb-8"><PrimaryLogo className="h-9 w-auto" /></div>
          <div className="max-w-md mx-auto w-full">
            <div className="flex items-center gap-3 mb-7">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">shield_lock</span>
              </div>
              <div>
                <p className="font-label-mono text-[10px] uppercase tracking-wider text-primary font-bold">Step 2 of 2</p>
                <h1 className="font-headline-lg text-2xl font-bold text-on-surface">{t('auth.mfa.challengeTitle')}</h1>
              </div>
            </div>
            <p className="font-body-sm text-on-surface-variant leading-6 mb-8">{t('auth.mfa.challengeSubtitle')}</p>

            {errorMsg && (
              <div role="alert" className="mb-6 p-4 rounded-2xl bg-error-container text-on-error-container text-sm flex gap-3 items-start">
                <span className="material-symbols-outlined text-lg shrink-0">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifyChallenge} className="space-y-6">
              <div>
                <label htmlFor="mfa-code" className="block font-label-mono text-[11px] uppercase tracking-wider font-bold text-on-surface-variant mb-2">{t('auth.mfa.codeLabel')}</label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-2xl px-5 py-4 text-center text-2xl font-mono tracking-[0.45em] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow"
                  aria-describedby="mfa-help"
                />
                <p id="mfa-help" className="mt-2 text-xs text-on-surface-variant text-center">Enter the current code shown in your authenticator app.</p>
              </div>

              <Button type="submit" variant="primary" className="w-full py-3.5" isLoading={isSubmitting} disabled={code.length !== 6}>
                {t('auth.mfa.verifyButton')}
              </Button>
            </form>

            <button onClick={() => navigate('/auth/login')} className="mt-7 w-full text-center font-label-bold text-sm text-on-surface-variant hover:text-primary transition-colors">
              {t('auth.forgotPassword.backToLogin')}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
};
