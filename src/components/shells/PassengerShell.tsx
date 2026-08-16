import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { OfflineBanner } from '../common/OfflineBanner';

interface PassengerShellProps {
  hideBottomNav?: boolean;
}

export const PassengerShell: React.FC<PassengerShellProps> = ({ hideBottomNav = false }) => {
  const { t } = useTranslation();
  const location = useLocation();

  // Route-level check if bottom nav should be hidden (e.g. for onboarding, full-bleed maps, auth screens)
  const isImmersiveRoute =
    hideBottomNav ||
    location.pathname.startsWith('/onboarding') ||
    location.pathname.startsWith('/splash') ||
    location.pathname.startsWith('/auth') ||
    location.pathname.includes('/start-trip') ||
    location.pathname.includes('/report-blackspot') ||
    location.pathname.includes('/sos');

  const navItems = [
    { path: '/passenger', label: t('nav.home'), icon: 'home' },
    { path: '/passenger/trips', label: t('nav.trips'), icon: 'directions_bus' },
    { path: '/passenger/map', label: t('nav.map'), icon: 'map' },
    { path: '/passenger/alerts', label: t('nav.alerts'), icon: 'warning' },
    { path: '/passenger/profile', label: t('nav.profile'), icon: 'person' },
  ];

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col relative selection:bg-primary-container selection:text-on-primary-container">
      <OfflineBanner />

      {/* Main Content View Container */}
      <main className={cn('flex-1 w-full max-w-lg mx-auto', !isImmersiveRoute && 'pb-20')}>
        <React.Suspense
          fallback={
            <div className="min-h-[50vh] flex items-center justify-center p-8">
              <div className="flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-primary text-3xl animate-spin">
                  progress_activity
                </span>
                <span className="font-label-mono text-xs text-on-surface-variant uppercase tracking-wider">
                  Loading...
                </span>
              </div>
            </div>
          }
        >
          <Outlet />
        </React.Suspense>
      </main>

      {/* Persistent Bottom Nav Bar */}
      {!isImmersiveRoute && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest border-t border-outline-variant/20 shadow-[0px_-4px_20px_rgba(0,0,0,0.04)] px-margin-mobile safe-area-bottom">
          <div className="max-w-lg mx-auto flex justify-around items-center h-16">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/passenger'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-all duration-200 active:scale-95',
                    isActive
                      ? 'text-on-secondary-container font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        'w-10 h-7 rounded-full flex items-center justify-center transition-colors',
                        isActive && 'bg-secondary-container'
                      )}
                    >
                      <span className="material-symbols-outlined text-xl">{item.icon}</span>
                    </div>
                    <span className="text-[10px] font-label-bold tracking-tight mt-0.5">
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};
