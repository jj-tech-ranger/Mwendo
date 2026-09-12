import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { BRAND_ASSETS } from '../assets/BrandAssets';
import { OfflineBanner } from '../common/OfflineBanner';
import { ThemeToggle } from '../common/ThemeToggle';
import { LanguageToggle } from '../common/LanguageToggle';
import { useThemeStore } from '../../store/useThemeStore';
import { AnimatedOutlet } from '../common/AnimatedOutlet';

export const AuthorityShell: React.FC = () => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const setVariant = useThemeStore((s) => s.setVariant);

  useEffect(() => {
    setVariant('authority');
    return () => setVariant('default');
  }, [setVariant]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: '/authority', label: t('authority.nav.overview', 'National Overview'), icon: 'policy' },
    { path: '/authority/compliance', label: t('authority.nav.compliance', 'Compliance & Violations'), icon: 'verified' },
    { path: '/authority/black-spots', label: t('authority.nav.blackSpots', 'Black Spots & Map'), icon: 'warning' },
    { path: '/authority/inspections', label: t('authority.nav.inspections', 'Vehicle Inspections'), icon: 'fact_check' },
    { path: '/authority/emergency', label: t('authority.nav.emergency', 'SOS & Emergency'), icon: 'e911_emergency' },
    { path: '/authority/complaints', label: t('authority.nav.complaints', 'Complaints'), icon: 'rate_review' },
    { path: '/authority/reports', label: t('authority.nav.reports', 'Reports & Downloads'), icon: 'analytics' },
    { path: '/authority/settings', label: t('authority.nav.settings', 'Authority Settings'), icon: 'settings' },
  ];

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-body-md theme-authority">
      <OfflineBanner />
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile slide-over drawer backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile Navigation Drawer */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 w-72 bg-surface-container-lowest z-50 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out lg:hidden border-r border-outline-variant/30 select-none',
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          aria-label={t('authority.shell.mobileNav', 'Mobile Navigation')}
        >
          <div className="p-md flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={BRAND_ASSETS.appIcon} alt="NTSA Authority" className="w-9 h-9 rounded-lg" />
              <div>
                <h1 className="font-headline-lg-mobile text-sm text-primary leading-tight">{t('authority.shell.title')}</h1>
                <span className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider">{t('authority.shell.subtitle')}</span>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label={t('authority.shell.closeMenu', 'Close navigation menu')}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <nav className="p-sm space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/authority'}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-bold text-sm transition-colors min-h-[44px]',
                    isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  )
                }
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="p-md border-t border-outline-variant/20 space-y-md">
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageToggle />
            </div>
            <div className="text-center font-label-mono text-[10px] text-outline">{t('authority.shell.consoleTag')}</div>
          </div>
        </aside>

        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'hidden lg:flex bg-surface-container-lowest border-r border-outline-variant/30 flex-col justify-between transition-all duration-300 z-30 select-none shrink-0',
            isCollapsed ? 'w-20' : 'w-64'
          )}
          aria-label={t('authority.shell.desktopNav', 'Desktop Navigation')}
        >
          <div className="p-md flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={BRAND_ASSETS.appIcon} alt="NTSA Authority" className="w-9 h-9 rounded-lg" />
              {!isCollapsed && (
                <div>
                  <h1 className="font-headline-lg-mobile text-sm text-primary leading-tight">{t('authority.shell.title')}</h1>
                  <span className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider">{t('authority.shell.subtitle')}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? t('authority.shell.expandSidebar') : t('authority.shell.collapseSidebar')}
              className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-xl">{isCollapsed ? 'chevron_right' : 'chevron_left'}</span>
            </button>
          </div>
          <nav className="p-sm space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/authority'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-bold text-sm transition-colors',
                    isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  )
                }
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="p-md border-t border-outline-variant/20 space-y-md">
            <div className={cn('flex items-center gap-2', isCollapsed && 'flex-col')}>
              <ThemeToggle />
              <LanguageToggle />
            </div>
            {!isCollapsed && <div className="text-center font-label-mono text-[10px] text-outline">{t('authority.shell.consoleTag')}</div>}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <header className="h-16 border-b border-outline-variant/20 bg-surface-container-lowest px-3 sm:px-lg flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-2 sm:gap-md min-w-0">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-1 rounded-lg text-on-surface-variant hover:bg-surface-container min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t('authority.shell.toggleMenu', 'Open navigation menu')}
              >
                <span className="material-symbols-outlined text-2xl">menu</span>
              </button>
              <span className="font-headline-lg-mobile text-xs sm:text-sm font-bold text-on-surface truncate">
                {t('authority.shell.monitorTitle')}
              </span>
              <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-label-mono text-[10px] sm:text-xs shrink-0">
                {t('authority.shell.liveBadge')}
              </span>
            </div>
          </header>
          <main className="p-3 sm:p-lg lg:p-xl max-w-7xl w-full mx-auto flex-1 min-w-0">
            <AnimatedOutlet />
          </main>
        </div>
      </div>
    </div>
  );
};
