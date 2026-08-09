import React from 'react';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';

export const LoadingAuthScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-md bg-on-background/60 backdrop-blur-md">
      <div className="bg-surface-bright w-full max-w-[280px] rounded-2xl p-lg flex flex-col items-center text-center shadow-2xl border border-outline-variant/20 animate-in zoom-in-95 duration-300">
        <img src={BRAND_ASSETS.appIcon} alt="App Icon" className="w-12 h-12 mb-6 rounded-xl shadow-sm" />

        <div className="relative w-12 h-12 mb-6 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-secondary animate-spin">
            progress_activity
          </span>
        </div>

        <h2 className="font-body-md text-on-surface font-medium mb-1">Checking for updates…</h2>
        <p className="font-label-mono text-on-surface-variant/70 text-[10px] tracking-wider uppercase">
          VERIFYING SYSTEM INTEGRITY
        </p>
      </div>
    </div>
  );
};
