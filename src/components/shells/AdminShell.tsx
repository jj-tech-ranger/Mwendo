import React, { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { BRAND_ASSETS } from '../assets/BrandAssets';
import { OfflineBanner } from '../common/OfflineBanner';
import { LanguageToggle } from '../common/LanguageToggle';
import { useThemeStore } from '../../store/useThemeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BrandLoader } from '../ui/LoadingIndicators';

interface NavGroup {
  label: string;
  items: Array<{
    path: string;
    label: string;
    icon: string;
    end?: boolean;
  }>;
}

export const AdminShell: React.FC = () => {
  const { t } = useTranslation();
  const setVariant = useThemeStore((s) => s.setVariant);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    setVariant('admin');
    return () => setVariant('default');
  }, [setVariant]);

  const navGroups: NavGroup[] = [
    { label: t('admin.navGroup.overview', 'OVERVIEW'), items: [{ path: '/admin', label: t('admin.nav.dashboard', 'Dashboard'), icon: 'dashboard', end: true }] },
    { label: t('admin.navGroup.peopleOrgs', 'PEOPLE & ORGANIZATIONS'), items: [{ path: '/admin/users', label: t('admin.nav.users', 'Users'), icon: 'manage_accounts' }, { path: '/admin/roles', label: t('admin.nav.roles', 'Roles'), icon: 'admin_panel_settings' }, { path: '/admin/saccos', label: t('admin.nav.saccos', 'SACCOs'), icon: 'domain' }, { path: '/admin/authorities', label: t('admin.nav.authorities', 'Authorities'), icon: 'policy' }] },
    { label: t('admin.navGroup.fleetTrips', 'FLEET & TRIPS'), items: [{ path: '/admin/vehicles', label: t('admin.nav.vehicles', 'Vehicles'), icon: 'directions_bus' }, { path: '/admin/trips', label: t('admin.nav.trips', 'Trips'), icon: 'route' }] },
    { label: t('admin.navGroup.insights', 'INSIGHTS'), items: [{ path: '/admin/analytics', label: t('admin.nav.analytics', 'Analytics'), icon: 'analytics' }, { path: '/admin/reports', label: t('admin.nav.reports', 'Reports'), icon: 'assessment' }] },
    { label: t('admin.navGroup.trustSafety', 'TRUST & SAFETY'), items: [{ path: '/admin/moderation', label: t('admin.nav.moderation', 'Moderation'), icon: 'gavel' }] },
    { label: t('admin.navGroup.governance', 'GOVERNANCE'), items: [{ path: '/admin/audit-logs', label: t('admin.nav.auditLogs', 'Audit Logs'), icon: 'receipt_long' }] },
    { label: t('admin.navGroup.operations', 'OPERATIONS'), items: [{ path: '/admin/monitoring', label: t('admin.nav.monitoring', 'Monitoring'), icon: 'insights' }, { path: '/admin/integrations', label: t('admin.nav.integrations', 'Integrations'), icon: 'extension' }, { path: '/admin/feature-flags', label: t('admin.nav.featureFlags', 'Feature Flags'), icon: 'toggle_on' }, { path: '/admin/system-health', label: t('admin.nav.systemHealth', 'System Health'), icon: 'monitor_heart' }] },
    { label: t('admin.navGroup.settingsRunbooks', 'SETTINGS & RUNBOOKS'), items: [{ path: '/admin/settings', label: t('admin.nav.settings', 'Settings'), icon: 'settings' }, { path: '/admin/maintenance', label: t('admin.nav.maintenance', 'Maintenance Mode'), icon: 'build_circle' }, { path: '/admin/docs', label: t('admin.nav.documentation', 'Documentation'), icon: 'menu_book' }, { path: '/admin/profile', label: t('admin.nav.profile', 'Admin Profile'), icon: 'account_circle' }] },
  ];

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/admin') return t('admin.breadcrumbs.dashboard');
    if (path.includes('/users')) return t('admin.breadcrumbs.users');
    if (path.includes('/roles')) return t('admin.breadcrumbs.roles');
    if (path.includes('/saccos')) return t('admin.breadcrumbs.saccos');
    if (path.includes('/authorities')) return t('admin.breadcrumbs.authorities');
    if (path.includes('/vehicles')) return t('admin.breadcrumbs.vehicles');
    if (path.includes('/trips')) return t('admin.breadcrumbs.trips');
    if (path.includes('/analytics')) return t('admin.breadcrumbs.analytics');
    if (path.includes('/reports')) return t('admin.breadcrumbs.reports');
    if (path.includes('/moderation')) return t('admin.breadcrumbs.moderation');
    if (path.includes('/audit-logs')) return t('admin.breadcrumbs.auditLogs');
    if (path.includes('/monitoring')) return t('admin.breadcrumbs.monitoring');
    if (path.includes('/integrations')) return t('admin.breadcrumbs.integrations');
    if (path.includes('/feature-flags')) return t('admin.breadcrumbs.featureFlags');
    if (path.includes('/system-health')) return t('admin.breadcrumbs.systemHealth');
    if (path.includes('/settings')) return t('admin.breadcrumbs.settings');
    if (path.includes('/maintenance')) return t('admin.breadcrumbs.maintenance');
    if (path.includes('/docs')) return t('admin.breadcrumbs.docs');
    if (path.includes('/profile')) return t('admin.breadcrumbs.profile');
    return t('admin.breadcrumbs.adminConsole');
  };

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/admin/users?search=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-body-md theme-admin dark">
      <OfflineBanner />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-[#1A2E1A] text-emerald-100 border-r border-emerald-900/40 flex flex-col justify-between z-30 select-none overflow-y-auto">
          <div>
            <div className="p-md flex items-center gap-3 border-b border-emerald-800/40 bg-[#142414]">
              <img src={BRAND_ASSETS.appIcon} alt="Mwendo Salama" className="w-9 h-9 rounded-xl shadow-md border border-emerald-700/30" />
              <div><h1 className="font-headline-lg-mobile text-sm text-emerald-400 font-bold leading-tight">Mwendo Salama</h1><div className="flex items-center gap-1.5 mt-0.5"><span className="material-symbols-outlined text-[13px] text-amber-400">vpn_key</span><span className="font-label-mono text-[10px] text-emerald-300 uppercase tracking-wider font-semibold">{t('admin.shell.console')}</span></div></div>
            </div>
            <nav className="p-sm space-y-md">{navGroups.map((group) => <div key={group.label} className="space-y-1"><p className="px-3 pt-2 pb-1 font-label-mono text-[10px] uppercase text-emerald-400/70 tracking-widest font-bold">{group.label}</p>{group.items.map((item) => <NavLink key={item.path} to={item.path} end={item.end ?? false} className={({ isActive }) => cn('flex items-center gap-3 px-3 py-2 rounded-xl font-label-mono text-xs uppercase tracking-wider transition-all duration-150', isActive ? 'bg-emerald-700/60 text-white font-bold border border-emerald-500/40 shadow-sm' : 'text-emerald-200/80 hover:bg-emerald-800/40 hover:text-white')}><span className="material-symbols-outlined text-base">{item.icon}</span><span>{item.label}</span></NavLink>)}</div>)}</nav>
          </div>
          <div className="p-md border-t border-emerald-800/40 bg-[#142414] space-y-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-emerald-600/40 border border-emerald-400/30 text-emerald-200 font-bold flex items-center justify-center text-xs">SA</div><div><p className="font-body-sm text-xs font-bold text-emerald-100 leading-tight">{user?.displayName || t('admin.shell.systemAdmin')}</p><span className="inline-flex items-center gap-1 font-label-mono text-[9px] text-emerald-400"><span className="material-symbols-outlined text-[10px]">key</span>{t('admin.shell.unrestricted')}</span></div></div><span className="bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded font-label-mono text-[9px] uppercase">PROD</span></div><div className="pt-1 border-t border-emerald-800/30 flex items-center justify-between"><LanguageToggle /><span className="font-label-mono text-[9px] text-emerald-400/60 uppercase">{t('admin.shell.ops')}</span></div></div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <header className="h-16 border-b border-outline-variant/20 bg-surface-container-lowest px-md sm:px-lg flex items-center justify-between sticky top-0 z-20 shadow-xs">
            <div className="flex items-center gap-2"><span className="font-label-mono text-xs text-on-surface-variant uppercase tracking-wider">{t('admin.shell.platformAdmin')}</span><span className="text-outline text-xs">/</span><span className="font-headline-lg-mobile text-sm text-on-surface font-bold">{getBreadcrumb()}</span></div>
            <form onSubmit={handleGlobalSearchSubmit} className="hidden md:flex items-center relative w-72 lg:w-96"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('admin.shell.searchPlaceholder')} className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-9 pr-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-sm" /></form>
            <div className="flex items-center gap-sm"><div className="hidden lg:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-full font-label-mono text-[10px] font-bold"><span className="material-symbols-outlined text-sm">public</span><span>{t('admin.shell.allScope')}</span></div><div className="relative"><button onClick={() => setShowNotifications(!showNotifications)} className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container relative" title={t('admin.shell.systemNotifications')} aria-label={t('admin.shell.systemNotifications')}><span className="material-symbols-outlined text-xl">notifications</span><span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" /></button>{showNotifications && <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl p-md z-50 text-xs space-y-2"><div className="flex items-center justify-between border-b border-outline-variant/20 pb-2"><span className="font-headline-lg-mobile text-xs font-bold text-on-surface">{t('admin.shell.systemNotifications')}</span><span className="font-label-mono text-[10px] text-primary">{t('admin.shell.unreadCount', { count: 2 })}</span></div><div className="space-y-2 max-h-60 overflow-y-auto"><div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 space-y-1"><p className="font-bold text-on-surface text-[11px]">{t('admin.shell.pendingSaccoVerification')}</p><p className="text-on-surface-variant text-[10px]">{t('admin.shell.pendingSaccoDesc')}</p><span className="font-label-mono text-[9px] text-outline">10m ago</span></div><div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 space-y-1"><p className="font-bold text-rose-600 text-[11px]">{t('admin.shell.cloudFunctionLatency')}</p><p className="text-on-surface-variant text-[10px]">{t('admin.shell.cloudFunctionDesc')}</p><span className="font-label-mono text-[9px] text-outline">25m ago</span></div></div></div>}</div><div className="relative"><button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 p-1 rounded-xl hover:bg-surface-container"><div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs">{user?.displayName ? user.displayName.charAt(0) : 'A'}</div><span className="material-symbols-outlined text-sm text-on-surface-variant">arrow_drop_down</span></button>{showUserMenu && <div className="absolute right-0 mt-2 w-52 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl p-sm z-50 text-xs space-y-1"><div className="p-2 border-b border-outline-variant/20"><p className="font-bold text-on-surface">{user?.displayName || t('admin.shell.systemAdmin')}</p><p className="font-label-mono text-[10px] text-outline">{user?.email}</p></div><button onClick={() => { setShowUserMenu(false); navigate('/admin/profile'); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-container flex items-center gap-2 font-label-mono"><span className="material-symbols-outlined text-base">account_circle</span><span>{t('admin.shell.menuProfile')}</span></button><button onClick={() => { setShowUserMenu(false); navigate('/admin/settings'); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-container flex items-center gap-2 font-label-mono"><span className="material-symbols-outlined text-base">settings</span><span>{t('admin.shell.menuSettings')}</span></button><button onClick={() => { setShowUserMenu(false); logout(); navigate('/login'); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-600 flex items-center gap-2 font-label-mono"><span className="material-symbols-outlined text-base">logout</span><span>{t('admin.shell.menuSignOut')}</span></button></div>}</div></div>
          </header>
          <main className="p-lg sm:p-xl max-w-7xl w-full mx-auto flex-1 space-y-lg"><Suspense fallback={<div className="min-h-[400px] flex items-center justify-center p-8" aria-live="polite"><BrandLoader size="lg" /></div>}><Outlet /></Suspense></main>
        </div>
      </div>
    </div>
  );
};
