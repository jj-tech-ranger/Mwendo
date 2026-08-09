import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { BRAND_ASSETS } from '../assets/BrandAssets';
import { OfflineBanner } from '../common/OfflineBanner';
import { ThemeToggle } from '../common/ThemeToggle';
import { LanguageToggle } from '../common/LanguageToggle';
import { useAuthStore } from '../../store/useAuthStore';

export const SaccoShell: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const { user, setUser } = useAuthStore();

  const currentSaccoId = user?.saccoId || 'sacco_metrolink';
  const currentSaccoName = currentSaccoId === 'sacco_greenline' ? 'GreenLine SACCO' : 'MetroLink SACCO';

  const handleSwitchSacco = (newSaccoId: string) => {
    if (!user) return;
    setUser({
      ...user,
      saccoId: newSaccoId,
    });
  };

  const navItems = [
    { path: '/sacco', label: 'Dashboard', icon: 'dashboard' },
    { path: '/sacco/fleet', label: 'Fleet', icon: 'directions_bus' },
    { path: '/sacco/vehicles', label: 'Vehicles', icon: 'minor_crash' },
    { path: '/sacco/drivers', label: 'Drivers', icon: 'badge' },
    { path: '/sacco/live-trips', label: 'Live Trips', icon: 'alt_route' },
    { path: '/sacco/violations', label: 'Violations', icon: 'speed' },
    { path: '/sacco/black-spots', label: 'Black Spots', icon: 'warning' },
    { path: '/sacco/reports', label: 'Reports', icon: 'analytics' },
    { path: '/sacco/analytics', label: 'Analytics', icon: 'insights' },
    { path: '/sacco/notifications', label: 'Notifications', icon: 'notifications' },
    { path: '/sacco/users', label: 'Users', icon: 'group' },
    { path: '/sacco/settings', label: 'Settings', icon: 'settings' },
  ];

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/sacco') return 'Dashboard Overview';
    if (path.includes('/fleet')) return 'Fleet Overview';
    if (path.includes('/vehicles')) return 'Vehicle Management';
    if (path.includes('/drivers')) return 'Driver Directory';
    if (path.includes('/live-trips')) return 'Live Operations Monitor';
    if (path.includes('/violations')) return 'Violation Management';
    if (path.includes('/black-spots')) return 'Black Spot Moderation';
    if (path.includes('/reports')) return 'Reports Hub';
    if (path.includes('/analytics')) return 'Safety & Fleet Analytics';
    if (path.includes('/notifications')) return 'Notifications Center';
    if (path.includes('/users')) return 'User & Role Management';
    if (path.includes('/settings')) return 'Organization Settings';
    return 'SACCO Operations';
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-body-md">
      <OfflineBanner />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (Fixed left ~260px) */}
        <aside
          className={cn(
            'bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col justify-between transition-all duration-300 z-30 select-none',
            isCollapsed ? 'w-20' : 'w-64'
          )}
        >
          {/* Sidebar Top Header */}
          <div className="p-4 flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={BRAND_ASSETS.appIcon} alt="Mwendo Salama" className="w-9 h-9 rounded-lg" />
              {!isCollapsed && (
                <div>
                  <h1 className="font-headline-lg-mobile text-sm text-primary leading-tight font-black">
                    Mwendo Salama
                  </h1>
                  <span className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider block">
                    SACCO Manager
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

          {/* SACCO Active Switcher Badge */}
          {!isCollapsed && (
            <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="material-symbols-outlined text-primary text-base">domain</span>
                <span className="font-bold text-primary truncate">{currentSaccoName}</span>
              </div>
              <select
                value={currentSaccoId}
                onChange={(e) => handleSwitchSacco(e.target.value)}
                className="text-[10px] bg-surface text-on-surface border border-outline-variant/40 rounded px-1 py-0.5 cursor-pointer font-mono"
              >
                <option value="sacco_metrolink">MetroLink</option>
                <option value="sacco_greenline">GreenLine</option>
              </select>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="p-2 space-y-0.5 flex-1 overflow-y-auto">
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

          {/* Sidebar Footer Controls */}
          <div className="p-3 border-t border-outline-variant/20 space-y-2">
            <div className={cn('flex items-center justify-between gap-2', isCollapsed && 'flex-col')}>
              <ThemeToggle />
              <LanguageToggle />
            </div>
            {!isCollapsed && (
              <div className="text-center font-mono text-[9px] text-on-surface-variant/70 uppercase">
                {currentSaccoId} • SACCO Portal
              </div>
            )}
          </div>
        </aside>

        {/* Main Content View Container */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Header Bar */}
          <header className="h-16 border-b border-outline-variant/20 bg-surface px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">
                {currentSaccoName}
              </span>
              <span className="text-on-surface-variant/40">/</span>
              <span className="font-black text-sm text-on-surface">{getBreadcrumb()}</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-on-surface-variant text-sm">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search vehicles, drivers, plates..."
                  className="pl-8 pr-3 py-1.5 bg-surface-container text-xs rounded-lg border border-outline-variant/40 w-64 focus:outline-hidden focus:border-primary"
                />
              </div>

              {/* Notification Bell */}
              <button className="relative p-2 rounded-lg hover:bg-surface-container text-on-surface-variant">
                <span className="material-symbols-outlined text-xl">notifications</span>
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error" />
              </button>

              <div className="h-6 w-px bg-outline-variant/30" />

              {/* Manager User Profile Avatar */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                  {user?.displayName ? user.displayName.charAt(0) : 'M'}
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-bold text-on-surface leading-none">
                    {user?.displayName || 'SACCO Manager'}
                  </div>
                  <div className="text-[10px] text-on-surface-variant font-mono">
                    {currentSaccoName}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="p-6 max-w-7xl w-full mx-auto flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

