import React, { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';
import { useAuthStore } from '../../store/useAuthStore';
import { MfaEnrollmentScreen } from '../auth/MfaEnrollmentScreen';

export const AdminSettingsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'settings' | 'profile' | 'docs'>('settings');
  const [showMfaModal, setShowMfaModal] = useState(false);

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Platform Configuration, Documentation & Operational Runbooks
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            System parameters, in-app documentation, and profile settings.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-surface-container border border-outline-variant/30 rounded-xl p-1 font-label-mono text-xs">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'settings'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'profile'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'docs'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Runbooks
          </button>
        </div>
      </div>

      {/* Tab 1: Settings */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg space-y-md shadow-sm">
            <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface border-b border-outline-variant/20 pb-sm">
              Platform Branding Assets
            </h3>

            <div className="space-y-md text-xs font-body-sm">
              <div className="flex items-center gap-3">
                <img src={BRAND_ASSETS.appIcon} alt="App Icon" className="w-12 h-12 rounded-xl shadow-md border border-outline-variant/20" />
                <div>
                  <p className="font-bold text-on-surface">App Icon Logo</p>
                  <p className="font-label-mono text-[10px] text-outline">assets/app-icon.png</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <img src={BRAND_ASSETS.primaryLogo} alt="Primary Logo" className="h-8 object-contain" />
                <div>
                  <p className="font-bold text-on-surface">Primary Brand Logo</p>
                  <p className="font-label-mono text-[10px] text-outline">assets/logo-primary.svg</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg space-y-md shadow-sm">
            <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface border-b border-outline-variant/20 pb-sm">
              Regional & Timezone Settings
            </h3>

            <div className="space-y-sm text-xs font-body-sm">
              <div className="p-md rounded-xl bg-surface-container-low flex justify-between">
                <span>Default Timezone</span>
                <span className="font-label-mono font-bold text-primary">Africa/Nairobi (EAT +03:00)</span>
              </div>
              <div className="p-md rounded-xl bg-surface-container-low flex justify-between">
                <span>Primary Currency</span>
                <span className="font-label-mono font-bold text-primary">KES (Kenyan Shilling)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Profile */}
      {activeTab === 'profile' && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg space-y-md shadow-sm max-w-xl mx-auto">
          <div className="flex items-center gap-md border-b border-outline-variant/20 pb-md">
            <div className="w-16 h-16 rounded-full bg-emerald-600/30 text-emerald-600 dark:text-emerald-300 font-bold flex items-center justify-center text-2xl border border-emerald-500/30">
              {user?.displayName ? user.displayName.charAt(0) : 'A'}
            </div>
            <div>
              <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">
                {user?.displayName || 'System Administrator'}
              </h3>
              <p className="font-label-mono text-xs text-outline">{user?.email}</p>
              <Badge variant="success" className="mt-1">
                Badge ID: SA-001 (Unrestricted Access)
              </Badge>
            </div>
          </div>

          <div className="space-y-2 text-xs font-body-sm">
            <div className="p-md rounded-xl bg-surface-container-low flex items-center justify-between">
              <div>
                <span className="block font-bold">Security Status</span>
                {user?.isMfaEnrolled ? (
                  <span className="text-[10px] text-emerald-600 font-mono font-bold">MFA: Configured (TOTP)</span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-mono font-bold">MFA: Mandatory (Pending)</span>
                )}
              </div>
              {user?.isMfaEnrolled ? (
                <Button size="sm" variant="outline" onClick={() => setShowMfaModal(true)} className="text-[10px] py-1 px-2">
                  Reconfigure
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={() => setShowMfaModal(true)} className="text-[10px] py-1 px-2">
                  Set up MFA
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Runbooks */}
      {activeTab === 'docs' && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg space-y-md shadow-sm">
          <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface border-b border-outline-variant/20 pb-sm">
            Operational Guides & Incident Runbooks
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md text-xs font-body-sm">
            <div className="p-md rounded-xl bg-surface-container-low space-y-2 border border-outline-variant/20">
              <span className="font-label-mono text-xs font-bold text-primary">RUNBOOK #1: SACCO Suspension Workflow</span>
              <p className="text-on-surface-variant">
                1. Review violation history under /admin/saccos. 2. Verify formal NTSA legal order attachment. 3. Suspend SACCO to revoke portal access.
              </p>
            </div>

            <div className="p-md rounded-xl bg-surface-container-low space-y-2 border border-outline-variant/20">
              <span className="font-label-mono text-xs font-bold text-primary">RUNBOOK #2: High Ingestion Traffic</span>
              <p className="text-on-surface-variant">
                1. Inspect latency under /admin/monitoring. 2. Scale processing server capacity if queue volume exceeds thresholds.
              </p>
            </div>
          </div>
        </div>
      )}

      {showMfaModal && (
        <MfaEnrollmentScreen isModal onClose={() => setShowMfaModal(false)} />
      )}
    </div>
  );
};
