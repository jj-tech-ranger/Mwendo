import React from 'react';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';

export const MaintenanceModeScreen: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#00431b] text-on-primary flex flex-col items-center justify-center p-md relative overflow-hidden font-body-md text-center">
      <div className="relative z-10 max-w-md w-full space-y-lg">
        <div className="mb-xl">
          <img src={BRAND_ASSETS.primaryLogo} alt="Mwendo Salama" className="h-16 w-auto mx-auto object-contain" />
        </div>

        <div className="bg-surface-container-lowest/10 backdrop-blur-md rounded-2xl p-lg border border-white/10 shadow-2xl">
          <img
            src={BRAND_ASSETS.maintenanceIllustration}
            alt="Maintenance"
            className="w-full h-auto max-w-[260px] mx-auto mb-lg"
          />
          <div className="space-y-md px-md">
            <h1 className="font-headline-lg-mobile sm:font-headline-lg text-on-primary">
              We're making things safer
            </h1>
            <p className="font-body-md text-on-primary/80 leading-relaxed">
              Mwendo Salama is temporarily unavailable while we perform system upgrades. We'll be back shortly to help you travel safer.
            </p>
          </div>
        </div>

        <div className="pt-xl w-full space-y-3">
          <button
            disabled
            className="w-full bg-on-primary/10 border border-on-primary/20 text-on-primary/40 font-label-bold text-xs py-4 rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Check Again
          </button>
          <p className="font-label-mono text-[10px] text-on-primary/50 uppercase tracking-widest">
            ESTIMATED UPTIME: 15 MINUTES
          </p>
        </div>
      </div>
    </main>
  );
};
