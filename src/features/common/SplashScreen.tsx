import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';

type SplashFrame = 1 | 2 | 3 | 4 | 5;

const STEP_DURATION = 1050;
const TOTAL_DURATION = STEP_DURATION * 5 + 300;

export const SplashScreen: React.FC = () => {
  const [frame, setFrame] = useState<SplashFrame>(1);
  const navigate = useNavigate();

  useEffect(() => {
    const timers = [1, 2, 3, 4].map((step) =>
      setTimeout(() => setFrame((step + 1) as SplashFrame), STEP_DURATION * step),
    );
    const navigationTimer = setTimeout(() => navigate('/onboarding'), TOTAL_DURATION);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(navigationTimer);
    };
  }, [navigate]);

  const isDark = frame !== 2 && frame !== 4;
  const progress = frame / 5;
  const textColor = isDark ? 'text-white' : 'text-primary';
  const mutedColor = isDark ? 'text-white/65' : 'text-on-surface-variant';
  const surface = isDark
    ? 'bg-gradient-to-br from-primary via-primary-container to-secondary'
    : 'bg-gradient-to-br from-surface via-surface-container-low to-secondary-container/40';

  return (
    <main
      className={`relative min-h-screen w-full overflow-hidden ${surface} transition-colors duration-700`}
      aria-label="Mwendo Salama loading"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-24 h-80 w-80 rounded-full bg-secondary/20 blur-3xl motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-on-primary-container/15 blur-3xl motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="absolute left-1/2 top-1/2 h-[min(76vw,560px)] w-[min(76vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 motion-safe:animate-ping motion-reduce:animate-none" />
        <div className="absolute left-1/2 top-1/2 h-[min(58vw,430px)] w-[min(58vw,430px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col px-6 py-8 sm:px-10 sm:py-10">
        <header className="flex items-center justify-between">
          <div className={`font-label-bold text-[10px] uppercase tracking-[0.28em] ${mutedColor}`}>
            Premium Civic Mobility
          </div>
          <div className={`font-label-mono text-xs ${mutedColor}`} aria-hidden="true">
            0{frame} / 05
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-xl text-center">
            <div className="relative mx-auto mb-10 flex h-56 w-56 items-center justify-center sm:mb-12 sm:h-72 sm:w-72">
              <div className="absolute inset-0 rounded-full border border-white/15" />
              <div className="absolute inset-5 rounded-full border border-white/15" />
              <div className="absolute inset-10 rounded-full bg-white/10 shadow-2xl backdrop-blur-sm" />

              {frame === 1 && (
                <div className="relative flex h-32 w-32 items-center justify-center motion-safe:animate-pulse motion-reduce:animate-none sm:h-40 sm:w-40">
                  <img src={BRAND_ASSETS.darkRoundFavicon} alt="" className="h-full w-full object-contain" />
                </div>
              )}

              {frame === 2 && (
                <div className="relative h-36 w-36 rounded-full border-[10px] border-primary-container/15 border-t-primary motion-safe:animate-spin motion-reduce:animate-none sm:h-44 sm:w-44" />
              )}

              {frame === 3 && (
                <div className="relative flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40">
                  <div className="absolute inset-0 rounded-full border-2 border-white/30 motion-safe:animate-ping motion-reduce:animate-none" />
                  <img src={BRAND_ASSETS.darkRoundFavicon} alt="" className="relative h-28 w-28 object-contain sm:h-36 sm:w-36" />
                  <span className="absolute right-1 top-2 h-4 w-4 rounded-full bg-on-primary-container shadow-lg" />
                </div>
              )}

              {frame === 4 && (
                <div className="relative h-36 w-48 overflow-hidden rounded-[2rem] border border-primary/10 bg-white/65 p-4 shadow-xl backdrop-blur-md sm:h-44 sm:w-56">
                  <div className="absolute left-5 top-1/2 h-1 w-[85%] -translate-y-1/2 rotate-[24deg] rounded-full bg-primary/15" />
                  <div className="absolute left-8 top-[58%] h-2 w-2 rounded-full bg-secondary" />
                  <div className="absolute left-[44%] top-[39%] h-3 w-3 rounded-full border-2 border-secondary bg-white" />
                  <div className="absolute right-8 top-[24%] h-3 w-3 rounded-full bg-primary" />
                  <div className="absolute inset-x-8 bottom-5 h-1 overflow-hidden rounded-full bg-primary/10">
                    <div className="h-full w-2/3 rounded-full bg-secondary motion-safe:animate-pulse motion-reduce:animate-none" />
                  </div>
                </div>
              )}

              {frame === 5 && (
                <div className="relative flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
                  <div className="absolute inset-0 rounded-full border-2 border-on-primary-container/40" />
                  <div className="absolute inset-5 rounded-full border border-on-primary-container/25" />
                  <img src={BRAND_ASSETS.darkRoundLogo} alt="Mwendo Salama" className="relative h-36 w-36 object-contain sm:h-44 sm:w-44" />
                </div>
              )}
            </div>

            <div className="min-h-[128px]">
              <p className={`mb-3 font-label-bold text-[10px] uppercase tracking-[0.3em] ${mutedColor}`}>
                Mwendo Salama
              </p>
              <h1 className={`font-headline-lg-mobile text-3xl font-extrabold tracking-tight sm:text-5xl ${textColor}`}>
                {frame === 1 && 'Premium Civic Mobility'}
                {frame === 2 && 'Mwendo Salama'}
                {frame === 3 && 'Securing Every Journey'}
                {frame === 4 && 'Securing Every Journey'}
                {frame === 5 && 'Travel safer. Arrive safer.'}
              </h1>
              <p className={`mt-3 font-body-md text-sm sm:text-base ${mutedColor}`}>
                {frame === 1 && 'A safer way to move through Kenya.'}
                {frame === 2 && 'Your journey, connected to a safer road network.'}
                {frame === 3 && 'Real-time awareness for every journey.'}
                {frame === 4 && 'From the road beneath you to the people around you.'}
                {frame === 5 && 'Welcome to a safer way to travel.'}
              </p>
            </div>
          </div>
        </section>

        <footer className="mx-auto w-full max-w-xl">
          <div className="mb-5 flex items-center justify-between">
            <span className={`font-label-mono text-[10px] uppercase tracking-[0.22em] ${mutedColor}`}>
              Ensuring your safety
            </span>
            <span className={`font-label-mono text-[10px] ${mutedColor}`}>{Math.round(progress * 100)}%</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-label="Loading Mwendo Salama"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className="h-full rounded-full bg-on-primary-container shadow-[0_0_18px_rgba(174,243,182,0.45)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((step) => (
              <span
                key={step}
                className={`h-1.5 rounded-full transition-all duration-500 motion-reduce:transition-none ${
                  step === frame
                    ? 'w-8 bg-on-primary-container'
                    : step < frame
                      ? 'w-2 bg-on-primary-container/55'
                      : 'w-2 bg-white/20'
                }`}
              />
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
};
