import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { BRAND_ASSETS } from '../assets/BrandAssets';
import { OfflineBanner } from '../common/OfflineBanner';
import { ThemeToggle } from '../common/ThemeToggle';
import { LanguageToggle } from '../common/LanguageToggle';
import { useAuthStore } from '../../store/useAuthStore';
import { getSaccoName, getEffectiveSaccoId } from '../../lib/saccoUtils';
import { BrandLoader } from '../ui/LoadingIndicators';

export const SaccoShell: React.FC = () => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const currentSaccoId = getEffectiveSaccoId(user?.saccoId);
  const currentSaccoName = currentSaccoId ? getSaccoName(currentSaccoId) : null;

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
      <div className="flex-1 flex overflow-hidden">
        <aside className={cn('bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col justify-between transition-all duration-300 z-30 select-none', isCollapsed ? 'w-20' : 'w-64')}>
          <div className="p-4 flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={BRAND_ASSETS.appIcon} alt="Mwendo Salama" className="w-9 h-9 rounded-lg" />
              {!isCollapsed && <div><h1 className="font-headline-lg-mobile text-sm text-primary leading-tight font-black">Mwendo Salama</h1><span className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider block">{t('sacco.shell.manager')}</span></div>}
            </div>
            <button onClick={() => setIsCollapsed(!isCollapsed)} aria-label={isCollapsed ? t('sacco.shell.expandSidebar') : t('sacco.shell.collapseSidebar')} className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"><span className="material-symbols-outlined text-xl">{isCollapsed ? 'chevron_right' : 'chevron_left'}</span></button>
          </div>
          {currentSaccoName && !isCollapsed && <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-1.5 text-xs overflow-hidden"><span className="material-symbols-outlined text-primary text-base">domain</span><span className="font-bold text-primary truncate">{currentSaccoName}</span></div>}
          <nav className="p-2 space-y-0.5 flex-1 overflow-y-auto">
            {navItems.map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/sacco'} className={({ isActive }) => cn('flex items-center gap-3 px-3 py-2 rounded-xl font-bold text-xs transition-colors', isActive ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface')}><span className="material-symbols-outlined text-lg">{item.icon}</span>{!isCollapsed && <span>{item.label}</span>}</NavLink>)}
          </nav>
          <div className="p-3 border-t border-outline-variant/20 space-y-2">
            <div className={cn('flex items-center justify-between gap-2', isCollapsed && 'flex-col')}><ThemeToggle /><LanguageToggle /></div>
            {!isCollapsed && <div className="text-center font-mono text-[9px] text-on-surface-variant/70 uppercase">{currentSaccoId} • {t('sacco.shell.portal')}</div>}
          </div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <header className="h-16 border-b border-outline-variant/20 bg-surface px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
            <div className="flex items-center gap-3"><span className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">{currentSaccoName}</span><span className="text-on-surface-variant/40">/</span><span className="font-black text-sm text-on-surface">{getBreadcrumb()}</span></div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block"><span className="material-symbols-outlined absolute left-2.5 top-2 text-on-surface-variant text-sm">search</span><input type="text" placeholder={t('sacco.shell.searchPlaceholder')} className="pl-8 pr-3 py-1.5 bg-surface-container text-xs rounded-lg border border-outline-variant/40 w-64 focus:outline-hidden focus:border-primary" /></div>
              <button className="relative p-2 rounded-lg hover:bg-surface-container text-on-surface-variant" aria-label={t('sacco.shell.notifications')} title={t('sacco.shell.notifications')}><span className="material-symbols-outlined text-xl">notifications</span><span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error" /></button>
              <div className="h-6 w-px bg-outline-variant/30" />
              <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">{user?.displayName ? user.displayName.charAt(0) : 'M'}</div><div className="hidden sm:block text-left text-xs"><div className="font-bold text-on-surface leading-none">{user?.displayName || t('sacco.shell.defaultUser')}</div><div className="text-[10px] text-on-surface-variant font-mono">{currentSaccoName}</div></div></div>
            </div>
          </header>
          <main className="p-6 max-w-7xl w-full mx-auto flex-1">
            <React.Suspense fallback={<div className="min-h-[400px] flex items-center justify-center p-8" aria-live="polite"><BrandLoader size="md" /></div>}><Outlet /></React.Suspense>
          </main>
        </div>
      </div>
    </div>
  );
};
