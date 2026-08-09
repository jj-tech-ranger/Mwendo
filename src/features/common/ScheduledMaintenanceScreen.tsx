import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';

export const ScheduledMaintenanceScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-md relative">
      <div className="fixed inset-0 bg-on-background/40 backdrop-blur-md z-40" />

      <div className="relative z-50 w-full max-w-md bg-surface rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-300">
        <div className="bg-secondary-container/30 flex items-center justify-center p-8">
          <img
            src={BRAND_ASSETS.calendarClockIllustration}
            alt="Scheduled Maintenance"
            className="w-32 h-32 object-contain"
          />
        </div>

        <div className="p-lg text-center space-y-md">
          <h1 className="font-headline-lg-mobile sm:font-headline-lg text-on-surface">
            Scheduled maintenance tonight
          </h1>
          <p className="font-body-md text-on-surface-variant leading-relaxed">
            We'll be updating our tracking systems tonight from <span className="font-bold text-on-surface">11:00 PM to 1:00 AM EAT</span>. Live alerts may be briefly affected.
          </p>

          <Button variant="primary" className="w-full" onClick={() => navigate('/passenger')}>
            Got it
          </Button>

          <div className="flex items-center justify-center gap-1.5 text-primary text-xs font-label-bold uppercase tracking-wider pt-2">
            <span className="material-symbols-outlined text-base">security</span>
            <span>Ensuring your safety</span>
          </div>
        </div>
      </div>
    </div>
  );
};
