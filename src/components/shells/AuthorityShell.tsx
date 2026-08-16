import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { BRAND_ASSETS } from '../assets/BrandAssets';
import { OfflineBanner } from '../common/OfflineBanner';
import { ThemeToggle } from '../common/ThemeToggle';
import { LanguageToggle } from '../common/LanguageToggle';
import { useThemeStore } from '../../store/useThemeStore';

export const AuthorityShell: React.FC = () => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const setVariant = useThemeStore((s) => s.setVariant);

  useEffect(() => {
    setVariant('authority');
    return () => setVariant('default');
  }, [setVariant]);

  const navItems = [
    { path: '/authority', label: t('nav.overview', 'Overview'), icon: 'policy' },
    { path: '/authority/compliance', label: t('nav.compliance', 'Compliance & Violations'), icon: 'verified' },
    { path: '/authority/black-spots', label: t('nav.blackSpots', 'Black Spots & Map'), icon: 'warning' },
    { path: '/authority/inspections', label: t('nav.inspections', 'Vehicle Inspections'), icon: 'fact_check' },
    { path: '/authority/emergency', label: t('nav.emergency', 'SOS & Emergency'), icon: 'e911_emergency' },
    { path: '/authority/complaints', label: t('nav.complaints', 'Complaints'), icon: 'rate_review' },
    { path: '/authority/reports', label: t('nav.reports', 'Reports & Downloads'), icon: 'analytics' },
    { path: '/authority/settings', label: t('nav.settings', 'Authority Settings'), icon: 'settings' },
  ];

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-body-md theme-authority">
      <OfflineBanner />

      <div className="flex-1 flex overflow-hidden">
        {/* Authority Persistent Sidebar */}
        <aside
          className={cn(
            'bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col justify-between transition-all duration-300 z-30 select-none',
            isCollapsed ? 'w-20' : 'w-64'
          )}
        >
          {/* Header */}
          <div className="p-md flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={BRAND_ASSETS.appIcon} alt="NTSA Authority" className="w-9 h-9 rounded-lg" />
              {!isCollapsed && (
                <div>
                  <h1 className="font-headline-lg-mobile text-sm text-primary leading-tight">
                    NTSA Authority
                  </h1>
                  <span className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
                    National Safety
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-xl">
                {isCollapsed ? 'chevron_right' : 'chevron_left'}
              </span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="p-sm space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/authority'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-bold text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  )
                }
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Footer Controls */}
          <div className="p-md border-t border-outline-variant/20 space-y-md">
            <div className={cn('flex items-center gap-2', isCollapsed && 'flex-col')}>
              <ThemeToggle />
              <LanguageToggle />
            </div>
            {!isCollapsed && (
              <div className="text-center font-label-mono text-[10px] text-outline">
                NTSA REGULATORY CONSOLE
              </div>
            )}
          </div>
        </aside>

        {/* Content Container */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <header className="h-16 border-b border-outline-variant/20 bg-surface-container-lowest px-lg flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-md">
              <span className="font-headline-lg-mobile text-on-surface">National PSV Safety Monitor</span>
              <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-label-mono text-xs">
                NTSA LIVE
              </span>
            </div>
          </header>

          <main className="p-lg sm:p-xl max-w-7xl w-full mx-auto flex-1">
            <React.Suspense
              fallback={
                <div className="min-h-[400px] flex items-center justify-center p-8">
                  <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-3xl animate-spin">
                      progress_activity
                    </span>
                    <span className="font-label-mono text-xs text-on-surface-variant uppercase tracking-wider">
                      Loading Authority module...
                    </span>
                  </div>
                </div>
              }
            >
              <Outlet />
            </React.Suspense>
          </main>
        </div>
      </div>
    </div>
  );
};
