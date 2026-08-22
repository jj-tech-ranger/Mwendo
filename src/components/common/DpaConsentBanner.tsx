import React, { useState, useEffect } from 'react';
import { analyticsService } from '../../services/analyticsService';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../ui/Button';

interface DpaConsentBannerProps {
  forceVisible?: boolean;
  onClose?: () => void;
}

export const DpaConsentBanner: React.FC<DpaConsentBannerProps> = ({
  forceVisible = false,
  onClose,
}) => {
  const user = useAuthStore((s) => s.user);
  const [isVisible, setIsVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (forceVisible) {
      setIsVisible(true);
      return;
    }

    // Check if consent has already been chosen
    const hasChosen = analyticsService.hasConsentChoice();
    if (!hasChosen) {
      // Show prompt if no decision recorded
      setIsVisible(true);
    }
  }, [forceVisible, user?.analyticsConsent]);

  if (!isVisible) return null;

  const handleChoice = async (granted: boolean) => {
    setIsSaving(true);
    try {
      await analyticsService.setDpaConsent(granted, user?.uid || user?.id);
    } catch (err) {
      console.warn('[DpaConsentBanner] Failed to save consent:', err);
    } finally {
      setIsSaving(false);
      setIsVisible(false);
      if (onClose) onClose();
    }
  };

  return (
    <aside
      aria-label="Privacy and Data Protection Consent"
      className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 bg-surface-container-high/95 backdrop-blur-md border-t border-outline-variant/50 shadow-2xl animate-in slide-in-from-bottom duration-300"
    >
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-xl">verified_user</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-on-surface">
                Kenya Data Protection Act (DPA 2019) Consent
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-primary/15 text-primary font-bold">
                Privacy
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed max-w-2xl">
              Mwendo Salama collects anonymized speed telemetry and route performance data to improve road safety across Kenyan PSV corridors. In compliance with the Kenya Data Protection Act 2019, you may grant or withhold consent for analytical data collection. Essential service operations remain unaffected.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => handleChoice(false)}
            className="flex-1 md:flex-initial text-xs h-9 px-4 border-outline-variant/60 font-semibold"
          >
            Decline (Essential Only)
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isSaving}
            onClick={() => handleChoice(true)}
            className="flex-1 md:flex-initial text-xs h-9 px-5 font-bold shadow-md shadow-primary/20"
          >
            Accept Analytics
          </Button>
        </div>
      </div>
    </aside>
  );
};
