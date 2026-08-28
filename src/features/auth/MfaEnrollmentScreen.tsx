import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { auth } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { mfaService, TotpSetupData } from '../../services/mfaService';

interface MfaEnrollmentProps {
  isModal?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

interface FirebaseAuthErrorLike {
  code?: string;
  message?: string;
}

function formatMfaInitializationError(error: unknown): string {
  const firebaseError = error as FirebaseAuthErrorLike;
  const code = firebaseError?.code;
  const message = firebaseError?.message;
  if (code || message) return `Failed to initialize TOTP MFA setup${code ? ` (${code})` : ''}. ${message || 'Please try again.'}`;
  if (error instanceof Error && error.message) return `Failed to initialize TOTP MFA setup. ${error.message}`;
  return 'Failed to initialize TOTP MFA setup. Please try again.';
}

export const MfaEnrollmentScreen: React.FC<MfaEnrollmentProps> = ({ isModal = false, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(true);
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => { void initTotp(); }, []);

  async function initTotp() {
    setLoadingSecret(true);
    setErrorMsg(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        if (!isModal) navigate('/auth/login');
        return;
      }
      setSetupData(await mfaService.getEnrollmentSecret(currentUser));
    } catch (err: unknown) {
      console.error('[MfaEnrollmentScreen] Failed to generate TOTP secret:', err);
      setErrorMsg(formatMfaInitializationError(err));
    } finally {
      setLoadingSecret(false);
    }
  }

  async function handleVerifyAndEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!setupData || code.length !== 6) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Session expired. Please log in again.');
      await mfaService.enrollTotp(currentUser, code, setupData);
      if (user) setUser({ ...user, isMfaEnrolled: true, isMfaVerified: true });
      if (onSuccess) onSuccess();
      else if (isModal) { if (onClose) onClose(); }
      else {
        const role = user?.activeRole || user?.role;
        if (role === 'admin') navigate('/admin');
        else if (role === 'authority') navigate('/authority');
        else if (role === 'sacco_manager') navigate('/sacco');
        else navigate('/passenger');
      }
    } catch (err: unknown) {
      console.error('MFA Enrollment error:', err);
      setErrorMsg(err instanceof Error ? err.message : String(err) || t('auth.mfa.invalidCode'));
    } finally { setIsSubmitting(false); }
  }

  async function handleCopySecret() {
    if (!setupData?.secretKey) return;
    try {
      await navigator.clipboard.writeText(setupData.secretKey);
      setCopiedKey(true);
      window.setTimeout(() => setCopiedKey(false), 2000);
    } catch { setErrorMsg('Unable to copy the setup key. You can select it manually.'); }
  }

  const content = (
    <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-outline-variant/30 bg-surface-container-lowest shadow-2xl md:grid md:grid-cols-[0.8fr_1.2fr]">
      <section className="hidden md:flex bg-primary text-on-primary p-10 lg:p-12 flex-col justify-between min-h-[650px] relative overflow-hidden">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-24 bottom-16 h-64 w-64 rounded-full bg-black/10 blur-3xl" />
        <div className="relative">
          <img src="/brand/logo-dark.png" alt="Mwendo Salama" className="h-10 w-auto" />
          <div className="mt-20 flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center"><span className="material-symbols-outlined">shield_lock</span></div>
            <span className="font-label-mono text-xs uppercase tracking-widest text-on-primary/75">Account security</span>
          </div>
          <h2 className="mt-6 text-4xl font-bold leading-tight max-w-sm">Protect your Mwendo Salama account.</h2>
          <p className="mt-5 text-sm leading-6 text-on-primary/80 max-w-sm">Set up an authenticator app once, then use a time-based code whenever your account needs an extra layer of protection.</p>
        </div>
        <div className="relative space-y-4 text-sm">
          <div className="flex gap-3 items-center"><span className="h-7 w-7 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">1</span><span>Scan the QR code</span></div>
          <div className="flex gap-3 items-center"><span className="h-7 w-7 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">2</span><span>Enter the six-digit code</span></div>
          <div className="flex gap-3 items-center"><span className="h-7 w-7 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">3</span><span>Your account is protected</span></div>
        </div>
      </section>

      <section className="p-6 sm:p-9 lg:p-12 flex flex-col justify-center">
        <div className="md:hidden mb-7"><PrimaryLogo className="h-9 w-auto" /></div>
        <div className="max-w-xl w-full mx-auto">
          <div className="flex items-center gap-3 mb-7">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><span className="material-symbols-outlined text-2xl">phonelink_lock</span></div>
            <div>
              <p className="font-label-mono text-[10px] uppercase tracking-widest text-primary font-bold">Step 1 of 2</p>
              <h1 className="text-2xl font-bold text-on-surface">{t('auth.mfa.enrollmentTitle')}</h1>
            </div>
          </div>
          <p className="text-sm leading-6 text-on-surface-variant mb-7">{t('auth.mfa.enrollmentSubtitle')}</p>

          {errorMsg && <div role="alert" className="mb-6 p-4 rounded-2xl bg-error-container text-on-error-container text-sm flex gap-3"><span className="material-symbols-outlined text-lg shrink-0">error</span><span>{errorMsg}</span></div>}

          {loadingSecret ? (
            <div className="rounded-3xl bg-surface-container-low p-10 flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-full border-4 border-primary/15 border-t-primary animate-spin" aria-hidden="true" />
              <p className="mt-5 text-sm font-medium text-on-surface">Preparing secure setup</p>
              <p className="mt-1 text-xs text-on-surface-variant">Generating your private authenticator configuration…</p>
            </div>
          ) : setupData ? (
            <form onSubmit={handleVerifyAndEnroll} className="space-y-6">
              <div className="rounded-3xl bg-surface-container-low border border-outline-variant/20 p-5 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                  <div><p className="font-label-mono text-[10px] uppercase tracking-widest text-primary font-bold">01 · Scan</p><h2 className="mt-1 text-base font-bold text-on-surface">Connect your authenticator</h2></div>
                  <span className="material-symbols-outlined text-primary">qr_code_2</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {setupData.qrCodeUrl && <div className="bg-white p-3 rounded-2xl shadow-sm border border-outline-variant/20 shrink-0"><img src={setupData.qrCodeUrl} alt="TOTP MFA setup QR code" className="w-40 h-40 object-contain" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-6 text-on-surface-variant">Open Google Authenticator, Microsoft Authenticator, or another compatible app and scan this code.</p>
                    <div className="mt-5">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant mb-2">{t('auth.mfa.secretKeyLabel')}</p>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 bg-surface-container border border-outline-variant/30 px-3 py-2.5 rounded-xl font-mono text-xs font-bold text-primary tracking-wider select-all break-all">{setupData.secretKey}</code>
                        <button type="button" onClick={handleCopySecret} className="h-10 w-10 shrink-0 rounded-xl hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center" title={t('auth.mfa.copied')} aria-label={t('auth.mfa.copied')}><span className="material-symbols-outlined text-lg">{copiedKey ? 'check' : 'content_copy'}</span></button>
                      </div>
                      {copiedKey && <p className="mt-2 text-xs font-semibold text-primary">{t('auth.mfa.copied')}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-outline-variant/20 p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-4"><span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">02</span><div><p className="font-label-mono text-[10px] uppercase tracking-widest text-primary font-bold">Verify setup</p><p className="text-xs text-on-surface-variant">Enter the current code from your app</p></div></div>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="[0-9]{6}" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full bg-surface-container border border-outline-variant/40 rounded-2xl px-5 py-4 text-center text-2xl font-mono tracking-[0.45em] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" aria-label={t('auth.mfa.codeLabel')} />
              </div>

              <Button type="submit" variant="primary" className="w-full py-3.5" isLoading={isSubmitting} disabled={code.length !== 6}>{t('auth.mfa.verifyButton')}</Button>
              {isModal && onClose && <Button type="button" variant="outline" className="w-full" onClick={onClose}>{t('common.cancel')}</Button>}
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );

  if (isModal) return <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">{content}</div>;
  return <main className="min-h-screen bg-background text-on-background relative overflow-hidden flex items-center justify-center p-4 sm:p-8"><div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" /><div className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />{content}</main>;
};
