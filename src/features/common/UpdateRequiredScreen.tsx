import React from 'react';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';

export const UpdateRequiredScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-on-background/60 backdrop-blur-xs p-margin-mobile">
      <div className="bg-surface-bright w-full max-w-sm rounded-2xl p-lg text-center shadow-2xl space-y-md border border-outline-variant/30">
        <img src={BRAND_ASSETS.appIcon} alt="App Icon" className="w-16 h-16 rounded-xl mx-auto shadow-sm" />
        <h2 className="font-headline-lg-mobile text-on-surface">Update required to continue</h2>
        <p className="font-body-md text-on-surface-variant leading-relaxed">
          This version of <span className="font-bold text-on-surface">Mwendo Salama</span> can no longer track trips safely. Please update to the latest version to continue.
        </p>

        <Button variant="primary" className="w-full" onClick={() => window.location.reload()}>
          <span className="material-symbols-outlined text-lg mr-1">system_update</span>
          Update Now
        </Button>

        <p className="font-label-mono text-[10px] text-outline uppercase tracking-wider">
          VERSION 2.4.0 • REQUIRED
        </p>
      </div>
    </div>
  );
};
