import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BRAND_ASSETS, PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';

export const WelcomeScreen: React.FC = () => {
  const [step, setFrameStep] = useState<0 | 1 | 2>(0);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const slides = [
    {
      title: t('onboarding.screen1Title'),
      desc: t('onboarding.screen1Desc'),
      image: BRAND_ASSETS.speedometerIllustration,
    },
    {
      title: t('onboarding.screen2Title'),
      desc: t('onboarding.screen2Desc'),
      image: BRAND_ASSETS.mapIllustration,
    },
    {
      title: t('onboarding.screen3Title'),
      desc: t('onboarding.screen3Desc'),
      image: BRAND_ASSETS.aiNetworkIllustration,
    },
  ];

  const current = slides[step]!;

  const handleNext = () => {
    if (step < 2) {
      setFrameStep((s) => (s + 1) as 1 | 2);
    } else {
      navigate('/location-permission');
    }
  };

  return (
    <div className="h-screen w-screen bg-surface text-on-surface flex flex-col font-body-md overflow-hidden">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-margin-mobile py-4 bg-transparent">
        <PrimaryLogo className="h-8 w-auto" />
        {step < 2 && (
          <button
            onClick={() => navigate('/auth/login')}
            className="font-label-bold text-xs text-outline hover:opacity-80 transition-opacity"
          >
            {t('common.skip')}
          </button>
        )}
      </header>

      {/* Upper 60%: Illustration */}
      <section className="h-[60%] w-full bg-sage-light relative flex items-center justify-center p-xl overflow-hidden dot-grid">
        <div className="relative z-10 max-w-sm w-full h-full flex items-center justify-center">
          <img
            src={current.image}
            alt={current.title}
            className="max-h-[85%] w-auto object-contain drop-shadow-lg transition-all duration-500 transform scale-100"
          />
        </div>
      </section>

      {/* Lower 40%: Content */}
      <section className="h-[40%] w-full bg-surface rounded-t-[24px] -mt-6 z-10 relative px-margin-mobile pt-lg pb-xl flex flex-col justify-between shadow-[0_-8px_24px_rgba(0,0,0,0.04)]">
        <div className="space-y-3">
          <h1 className="font-headline-lg-mobile sm:font-headline-lg text-on-surface">
            {current.title}
          </h1>
          <p className="font-body-md text-on-surface-variant leading-relaxed">
            {current.desc}
          </p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-4">
          {/* Pagination Indicators */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-primary-container' : 'w-2 bg-outline-variant'
                }`}
              />
            ))}
          </div>

          <Button onClick={handleNext} variant="primary">
            {step === 2 ? t('common.getStarted') : t('common.next')}
            <span className="material-symbols-outlined text-lg ml-1">arrow_forward</span>
          </Button>
        </div>
      </section>
    </div>
  );
};
