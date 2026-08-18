import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND_ASSETS, PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';

export const ServerUnavailableScreen: React.FC = () => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setIsRetrying(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col justify-between font-body-md">
      <header className="w-full flex justify-center py-6">
        <PrimaryLogo className="h-10 w-auto" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-margin-mobile text-center max-w-md mx-auto space-y-md">
        <div className="relative w-64 h-64 bg-surface-container-low rounded-2xl overflow-hidden flex items-center justify-center border border-outline-variant/30 mb-2">
          <img
            src={BRAND_ASSETS.disconnectedIllustration}
            alt="Server Unavailable"
            className="w-48 h-48 object-contain"
          />
        </div>

        <h1 className="font-headline-lg-mobile sm:font-headline-lg text-primary tracking-tight">
          Can't reach Mwendo Salama right now
        </h1>
        <p className="font-body-md text-on-surface-variant leading-relaxed">
          We're having trouble connecting to our servers. Don't worry—any trip data saved locally is safe and will sync once you're back online.
        </p>

        <div className="w-full space-y-md pt-4">
          <Button
            variant="primary"
            className="w-full"
            onClick={handleRetry}
            isLoading={isRetrying}
          >
            Retry
          </Button>
          <Link
            to="/passenger"
            className="block font-label-bold text-xs text-secondary uppercase tracking-widest hover:underline"
          >
            View Offline Mode
          </Link>
        </div>

        <div className="pt-4 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-error-container/40 rounded-full border border-error/10 text-on-error-container font-label-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
            <span>Connectivity lost</span>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center">
        <p className="font-label-mono text-xs text-outline opacity-60 uppercase">
          Mwendo Salama Safe Transit Network
        </p>
      </footer>
    </div>
  );
};
