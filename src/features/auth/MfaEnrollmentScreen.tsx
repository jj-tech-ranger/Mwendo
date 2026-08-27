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

  if (code || message) {
    return `Failed to initialize TOTP MFA setup${code ? ` (${code})` : ''}. ${message || 'Please try again.'}`;
  }

  if (error instanceof Error && error.message) {
    return `Failed to initialize TOTP MFA setup. ${error.message}`;
  }

  return 'Failed to initialize TOTP MFA setup. Please try again.';
}

export const MfaEnrollmentScreen: React.FC<MfaEnrollmentProps> = ({
  isModal = false,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(true);
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    initTotp();
  }, []);

  async function initTotp() {
    setLoadingSecret(true);
    setErrorMsg(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        if (!isModal) navigate('/auth/login');
        return;
      }
      const data = await mfaService.getEnrollmentSecret(currentUser);
      setSetupData(data);
    } catch (err: unknown) {
      console.error('[MfaEnrollmentScreen] Failed to generate TOTP secret:', err);
      setErrorMsg(formatMfaInitializationError(err));
    } finally {
      setLoadingSecret(false);
    }
  }

  async function handleVerifyAndEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!setupData || !code) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Session expired. Please log in again.');

      await mfaService.enrollTotp(currentUser, code, setupData);

      if (user) {
        setUser({ ...user, isMfaEnrolled: true, isMfaVerified: true });
      }

      if (onSuccess) {
        onSuccess();
      } else if (isModal) {
        if (onClose) onClose();
      } else {
        const role = user?.activeRole || user?.role;
        if (role === 'admin') navigate('/admin');
        else if (role === 'authority') navigate('/authority');
        else navigate('/passenger');
      }
    } catch (err: unknown) {
      console.error('MFA Enrollment error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMsg(errMsg || t('auth.mfa.invalidCode'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCopySecret() {
    if (setupData?.secretKey) {
      navigator.clipboard.writeText(setupData.secretKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  }

  const content = (
    <div className="w-full max-w-md space-y-lg bg-surface-container-lowest border border-outline-variant/30 p-xl rounded-3xl shadow-2xl">
      {!isModal && (
        <div className="flex flex-col items-center text-center space-y-xs">
          <PrimaryLogo className="h-10 w-auto mb-2" />
          <h1 className="font-headline-lg text-lg text-primary font-bold">
            {t('auth.mfa.enrollmentTitle')}
          </h1>
          <p className="font-body-sm text-xs text-on-surface-variant max-w-sm">
            {t('auth.mfa.mandatoryNote')}
          </p>
        </div>
      )}

      {isModal && (
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-md">
          <div>
            <h2 className="font-headline-lg text-base text-on-surface font-bold">
              {t('auth.mfa.enrollmentTitle')}
            </h2>
            <p className="font-body-sm text-xs text-on-surface-variant">
              {t('auth.mfa.enrollmentSubtitle')}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="p-md rounded-xl bg-error-container text-on-error-container text-xs font-body-sm text-center">
          {errorMsg}
        </div>
      )}

      {loadingSecret ? (
        <div className="flex flex-col items-center justify-center py-xl space-y-md">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">
            sync
          </span>
          <span className="font-label-mono text-xs text-on-surface-variant">
            {t('common.loading')}
          </span>
        </div>
      ) : setupData ? (
        <form onSubmit={handleVerifyAndEnroll} className="space-y-md">
          <div className="space-y-sm bg-surface-container-low p-md rounded-2xl border border-outline-variant/20">
            <span className="font-label-mono text-[10px] uppercase font-bold text-primary block">
              {t('auth.mfa.step1')}
            </span>

            <div className="flex flex-col sm:flex-row items-center gap-md">
              {setupData.qrCodeUrl && (
                <div className="bg-white p-2 rounded-xl shadow-xs border border-slate-200">
                  <img
                    src={setupData.qrCodeUrl}
                    alt="TOTP MFA QR Code"
                    className="w-32 h-32 object-contain"
                  />
                </div>
              )}

              <div className="flex-1 space-y-1 text-xs">
                <p className="font-body-sm text-on-surface-variant text-[11px]">
                  {t('auth.mfa.secretKeyLabel')}
                </p>
                <div className="flex items-center gap-1">
                  <code className="bg-surface-container border border-outline-variant/30 px-2 py-1 rounded-lg font-mono text-xs font-bold text-primary tracking-wider select-all">
                    {setupData.secretKey}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                    title={t('auth.mfa.copied')}
                  >
                    <span className="material-symbols-outlined text-base">
                      {copiedKey ? 'check' : 'content_copy'}
                    </span>
                  </button>
                </div>
                {copiedKey && (
                  <span className="font-label-mono text-[10px] text-emerald-600 font-bold block">
                    {t('auth.mfa.copied')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant block">
              {t('auth.mfa.step2')}
            </label>
            <input
              type="text"
              required
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-surface-container border border-outline-variant/40 rounded-xl p-3 text-center text-lg font-mono tracking-widest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="pt-sm space-y-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full py-3"
              isLoading={isSubmitting}
            >
              {t('auth.mfa.verifyButton')}
            </Button>

            {isModal && onClose && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onClose}
              >
                {t('common.cancel')}
              </Button>
            )}
          </div>
        </form>
      ) : null}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-md">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-center items-center p-margin-mobile">
      {content}
    </div>
  );
};
