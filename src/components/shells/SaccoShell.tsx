import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { BRAND_ASSETS } from '../assets/BrandAssets';
import { OfflineBanner } from '../common/OfflineBanner';
import { ThemeToggle } from '../common/ThemeToggle';
import { LanguageToggle } from '../common/LanguageToggle';
import { useAuthStore } from '../../store/useAuthStore';
import { getSaccoName, getEffectiveSaccoId } from '../../lib/saccoUtils';
import { AnimatedOutlet } from '../common/AnimatedOutlet';

export const SaccoShell: React.FC = () => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const currentSaccoId = getEffectiveSaccoId(user?.saccoId);
  const currentSaccoName = currentSaccoId ? getSaccoName(currentSaccoId) : null;

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: '/sacco', label: t('sacco.nav.dashboard'), icon: 'dashboard' },
    { path: '/sacco/fleet', label: t('sacco.nav.fleet'), icon: 'directions_bus' },
    { path: '/sacco/vehicles', label: t('sacco.nav.vehicles'), icon: 'minor_crash' },
    { path: '/sacco/drivers', label: t('sacco.nav.drivers'), icon: 'badge' },
    { path: '/sacco/live-trips', label: t('sacco.nav.liveTrips'), icon: 'alt_route' },
    { path: '/sacco/violations', label: t('sacco.nav.violations'), icon: 'speed' },
    { path: '/sacco/black-spots', label: t('sacco.nav.blackSpots'), icon: 'warning' },
    { path: '/sacco/reports', label: t('sacco.nav.reports'), icon: 'analytics' },
    { path: '/sacco/analytics', label: t('sacco.nav.analytics'), icon: 'insights' },
    { path: '/sacco/notifications', label: t('sacco.nav.notifications'), icon: 'notifications' },
    { path: '/sacco/users', label: t('sacco.nav.users'), icon: 'group' },
    { path: '/sacco/settings', label: t('sacco.nav.settings'), icon: 'settings' },
  ];

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/sacco') return t('sacco.breadcrumbs.dashboard');
    if (path.includes('/fleet')) return t('sacco.breadcrumbs.fleet');
    if (path.includes('/vehicles')) return t('sacco.breadcrumbs.vehicles');
    if (path.includes('/drivers')) return t('sacco.breadcrumbs.drivers');
    if (path.includes('/live-trips')) return t('sacco.breadcrumbs.liveTrips');
    if (path.includes('/violations')) return t('sacco.breadcrumbs.violations');
    if (path.includes('/black-spots')) return t('sacco.breadcrumbs.blackSpots');
    if (path.includes('/reports')) return t('sacco.breadcrumbs.reports');
    if (path.includes('/analytics')) return t('sacco.breadcrumbs.analytics');
    if (path.includes('/notifications')) return t('sacco.breadcrumbs.notifications');
    if (path.includes('/users')) return t('sacco.breadcrumbs.users');
    if (path.includes('/settings')) return t('sacco.breadcrumbs.settings');
    return t('sacco.breadcrumbs.operations');
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-body-md">
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
          aria-label={t('sacco.shell.mobileNav', 'Mobile Navigation')}
        >
          <div className="p-4 flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={BRAND_ASSETS.appIcon} alt="Mwendo Salama" className="w-9 h-9 rounded-lg" />
              <div>
                <h1 className="font-headline-lg-mobile text-sm text-primary leading-tight font-black">Mwendo Salama</h1>
                <span className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider block">
                  {t('sacco.shell.manager')}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label={t('sacco.shell.closeMenu', 'Close navigation menu')}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          {currentSaccoName && (
            <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-1.5 text-xs overflow-hidden">
              <span className="material-symbols-outlined text-primary text-base">domain</span>
              <span className="font-bold text-primary truncate">{currentSaccoName}</span>
            </div>
          )}
          <nav
            aria-label={t('sacco.shell.mobileNavLabel', 'Mobile navigation')}
            className="p-2 space-y-0.5 flex-1 overflow-y-auto"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/sacco'}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-colors min-h-[44px]',
                    isActive
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-outline-variant/20 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <ThemeToggle />
              <LanguageToggle />
            </div>
            <div className="text-center font-mono text-[9px] text-on-surface-variant/70 uppercase">
              {currentSaccoId} • {t('sacco.shell.portal')}
            </div>
          </div>
        </aside>

        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'hidden lg:flex bg-surface-container-lowest border-r border-outline-variant/30 flex-col justify-between transition-all duration-300 z-30 select-none shrink-0',
            isCollapsed ? 'w-20' : 'w-64'
          )}
          aria-label={t('sacco.shell.desktopNav', 'Desktop Navigation')}
        >
          <div className="p-4 flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={BRAND_ASSETS.appIcon} alt="Mwendo Salama" className="w-9 h-9 rounded-lg" />
              {!isCollapsed && (
                <div>
                  <h1 className="font-headline-lg-mobile text-sm text-primary leading-tight font-black">Mwendo Salama</h1>
                  <span className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider block">
                    {t('sacco.shell.manager')}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? t('sacco.shell.expandSidebar') : t('sacco.shell.collapseSidebar')}
              className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-xl">{isCollapsed ? 'chevron_right' : 'chevron_left'}</span>
            </button>
          </div>
          {currentSaccoName && !isCollapsed && (
            <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-1.5 text-xs overflow-hidden">
              <span className="material-symbols-outlined text-primary text-base">domain</span>
              <span className="font-bold text-primary truncate">{currentSaccoName}</span>
            </div>
          )}
          <nav
            aria-label={t('sacco.shell.primaryNavLabel', 'Primary navigation')}
            className="p-2 space-y-0.5 flex-1 overflow-y-auto"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/sacco'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-xs transition-colors',
                    isActive
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-outline-variant/20 space-y-2">
            <div className={cn('flex items-center justify-between gap-2', isCollapsed && 'flex-col')}>
              <ThemeToggle />
              <LanguageToggle />
            </div>
            {!isCollapsed && (
              <div className="text-center font-mono text-[9px] text-on-surface-variant/70 uppercase">
                {currentSaccoId} • {t('sacco.shell.portal')}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <header className="h-16 border-b border-outline-variant/20 bg-surface px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-1 rounded-lg text-on-surface-variant hover:bg-surface-container min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t('sacco.shell.toggleMenu', 'Open navigation menu')}
              >
                <span className="material-symbols-outlined text-2xl">menu</span>
              </button>
              <span className="hidden sm:inline text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider truncate">
                {currentSaccoName}
              </span>
              <span className="hidden sm:inline text-on-surface-variant/40">/</span>
              <span className="font-black text-xs sm:text-sm text-on-surface truncate">{getBreadcrumb()}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <div className="relative hidden md:block">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-on-surface-variant text-sm">search</span>
                <input
                  type="text"
                  placeholder={t('sacco.shell.searchPlaceholder')}
                  className="pl-8 pr-3 py-1.5 bg-surface-container text-xs rounded-lg border border-outline-variant/40 w-64 focus:outline-hidden focus:border-primary"
                />
              </div>
              <button
                className="relative p-2 rounded-lg hover:bg-surface-container text-on-surface-variant min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t('sacco.shell.notifications')}
                title={t('sacco.shell.notifications')}
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-error" />
              </button>
              <div className="h-6 w-px bg-outline-variant/30" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                  {user?.displayName ? user.displayName.charAt(0) : 'M'}
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-bold text-on-surface leading-none">{user?.displayName || t('sacco.shell.defaultUser')}</div>
                  <div className="text-[10px] text-on-surface-variant font-mono">{currentSaccoName}</div>
                </div>
              </div>
            </div>
          </header>
          <main className="p-3 sm:p-6 max-w-7xl w-full mx-auto flex-1 min-w-0">
            <AnimatedOutlet />
          </main>
        </div>
      </div>
    </div>
  );
};
