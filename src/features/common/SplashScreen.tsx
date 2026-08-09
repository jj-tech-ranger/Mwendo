import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';

export const SplashScreen: React.FC = () => {
  const [frame, setFrame] = useState<1 | 2 | 3>(1);
  const navigate = useNavigate();

  useEffect(() => {
    const timer1 = setTimeout(() => setFrame(2), 1200);
    const timer2 = setTimeout(() => setFrame(3), 2400);
    const timer3 = setTimeout(() => navigate('/onboarding'), 3800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [navigate]);

  if (frame === 1) {
    return (
      <main className="relative h-screen w-screen bg-gradient-to-br from-[#1A5C2E] to-[#0F6E56] flex flex-col justify-between items-center overflow-hidden p-margin-mobile py-xl">
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
        <div />
        <div className="flex flex-col items-center justify-center z-10">
          <img
            src={BRAND_ASSETS.primaryLogo}
            alt="Mwendo Salama"
            className="w-48 h-auto object-contain mix-blend-screen opacity-50 grayscale brightness-200 animate-pulse"
          />
        </div>
        <div className="w-full flex justify-between items-end z-10 pb-8">
          <div>
            <span className="font-headline-lg-mobile text-white/40 block">Mwendo Salama</span>
            <span className="font-label-bold text-xs text-white/20 uppercase tracking-widest">
              Premium Civic Mobility
            </span>
          </div>
          <div className="w-10 h-10 border border-white/20 rounded-full flex items-center justify-center">
            <span className="font-label-mono text-xs text-white/60">1</span>
          </div>
        </div>
      </main>
    );
  }

  if (frame === 2) {
    return (
      <main className="relative h-screen w-screen bg-gradient-to-br from-[#fcf9f8] to-[#e1f5ee] flex flex-col justify-center items-center overflow-hidden p-margin-mobile">
        <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />
        <div className="flex flex-col items-center z-10">
          <img src={BRAND_ASSETS.primaryLogo} alt="Mwendo Salama" className="w-48 h-auto object-contain mb-6" />
          <div className="w-64 h-1 overflow-hidden relative mt-2">
            <div className="w-full h-0.5 bg-primary-container animate-pulse rounded-full" />
          </div>
          <div className="mt-8 text-center">
            <h1 className="font-headline-lg-mobile text-primary">Mwendo Salama</h1>
            <p className="font-label-bold text-xs text-outline uppercase tracking-widest mt-1">
              Securing Every Journey
            </p>
          </div>
        </div>
        <div className="fixed bottom-6 right-6 z-20 bg-primary text-on-primary font-label-mono text-xs px-3 py-1 rounded-full shadow-sm">
          2
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen w-screen bg-[#00431b] flex flex-col items-center justify-between overflow-hidden p-margin-mobile py-xl">
      <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />
      <div />
      <div className="flex flex-col items-center z-10 text-center space-y-6">
        <img src={BRAND_ASSETS.primaryLogo} alt="Mwendo Salama" className="w-56 h-auto object-contain drop-shadow-2xl" />
        <h1 className="font-headline-lg-mobile text-sage-light">Travel safer. Arrive safer.</h1>
      </div>
      <div className="w-full flex flex-col items-center pb-8 z-10">
        <span className="material-symbols-outlined text-sage-light text-3xl animate-spin">
          progress_activity
        </span>
        <div className="absolute bottom-6 right-6 font-label-mono text-xs text-sage-light/40">3</div>
      </div>
    </main>
  );
};
