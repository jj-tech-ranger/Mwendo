import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { BRAND_ASSETS } from '../assets/BrandAssets';
import { OfflineBanner } from '../common/OfflineBanner';
import { LanguageToggle } from '../common/LanguageToggle';
import { useThemeStore } from '../../store/useThemeStore';
import { useAuthStore } from '../../store/useAuthStore';

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
  const setVariant = useThemeStore((s) => s.setVariant);
  const { user, logout } = useAuthStore();
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
    {
      label: 'OVERVIEW',
      items: [
        { path: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
      ],
    },
    {
      label: 'PEOPLE & ORGANIZATIONS',
      items: [
        { path: '/admin/users', label: 'Users', icon: 'manage_accounts' },
        { path: '/admin/roles', label: 'Roles', icon: 'admin_panel_settings' },
        { path: '/admin/saccos', label: 'SACCOs', icon: 'domain' },
        { path: '/admin/authorities', label: 'Authorities', icon: 'policy' },
      ],
    },
    {
      label: 'FLEET & TRIPS',
      items: [
        { path: '/admin/vehicles', label: 'Vehicles', icon: 'directions_bus' },
        { path: '/admin/trips', label: 'Trips', icon: 'route' },
      ],
    },
    {
      label: 'INSIGHTS',
      items: [
        { path: '/admin/analytics', label: 'Analytics', icon: 'analytics' },
        { path: '/admin/reports', label: 'Reports', icon: 'assessment' },
      ],
    },
    {
      label: 'TRUST & SAFETY',
      items: [
        { path: '/admin/moderation', label: 'Moderation', icon: 'gavel' },
      ],
    },
    {
      label: 'GOVERNANCE',
      items: [
        { path: '/admin/audit-logs', label: 'Audit Logs', icon: 'receipt_long' },
      ],
    },
    {
      label: 'OPERATIONS',
      items: [
        { path: '/admin/monitoring', label: 'Monitoring', icon: 'insights' },
        { path: '/admin/integrations', label: 'Integrations', icon: 'extension' },
        { path: '/admin/feature-flags', label: 'Feature Flags', icon: 'toggle_on' },
        { path: '/admin/system-health', label: 'System Health', icon: 'monitor_heart' },
      ],
    },
    {
      label: 'SETTINGS & RUNBOOKS',
      items: [
        { path: '/admin/settings', label: 'Settings', icon: 'settings' },
        { path: '/admin/maintenance', label: 'Maintenance Mode', icon: 'build_circle' },
        { path: '/admin/docs', label: 'Documentation', icon: 'menu_book' },
        { path: '/admin/profile', label: 'Admin Profile', icon: 'account_circle' },
      ],
    },
  ];

  // Helper to determine breadcrumb title
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/admin') return 'Dashboard Overview';
    if (path.includes('/users')) return 'User Management';
    if (path.includes('/roles')) return 'Role Management';
    if (path.includes('/saccos')) return 'SACCO Management';
    if (path.includes('/authorities')) return 'Authority Accounts';
    if (path.includes('/vehicles')) return 'Vehicle Management';
    if (path.includes('/trips')) return 'Trip Explorer';
    if (path.includes('/analytics')) return 'Platform Analytics';
    if (path.includes('/reports')) return 'Reports & Digests';
    if (path.includes('/moderation')) return 'Moderation Queue & Trust Engine';
    if (path.includes('/audit-logs')) return 'Governance Audit Logs';
    if (path.includes('/monitoring')) return 'API Health & Error Monitoring';
    if (path.includes('/integrations')) return 'System Integrations';
    if (path.includes('/feature-flags')) return 'Feature Flags & System Config';
    if (path.includes('/system-health')) return 'System Health & Telemetry';
    if (path.includes('/settings')) return 'Platform Settings & Security';
    if (path.includes('/maintenance')) return 'Maintenance Mode Controls';
    if (path.includes('/docs')) return 'System Documentation & Runbooks';
    if (path.includes('/profile')) return 'System Administrator Profile';
    return 'Admin Console';
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
        {/* Admin Ops Console Sidebar (264px width, Trip Dark #1A2E1A style) */}
        <aside className="w-64 bg-[#1A2E1A] text-emerald-100 border-r border-emerald-900/40 flex flex-col justify-between z-30 select-none overflow-y-auto">
          <div>
            {/* Header / Logo */}
            <div className="p-md flex items-center gap-3 border-b border-emerald-800/40 bg-[#142414]">
              <img src={BRAND_ASSETS.appIcon} alt="Mwendo Salama" className="w-9 h-9 rounded-xl shadow-md border border-emerald-700/30" />
              <div>
                <h1 className="font-headline-lg-mobile text-sm text-emerald-400 font-bold leading-tight">
                  Mwendo Salama
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="material-symbols-outlined text-[13px] text-amber-400">vpn_key</span>
                  <span className="font-label-mono text-[10px] text-emerald-300 uppercase tracking-wider font-semibold">
                    SYS_ADMIN CONSOLE
                  </span>
                </div>
              </div>
            </div>

            {/* Nav Groups */}
            <nav className="p-sm space-y-md">
              {navGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <p className="px-3 pt-2 pb-1 font-label-mono text-[10px] uppercase text-emerald-400/70 tracking-widest font-bold">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.end ?? false}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-xl font-label-mono text-xs uppercase tracking-wider transition-all duration-150',
                          isActive
                            ? 'bg-emerald-700/60 text-white font-bold border border-emerald-500/40 shadow-sm'
                            : 'text-emerald-200/80 hover:bg-emerald-800/40 hover:text-white'
                        )
                      }
                    >
                      <span className="material-symbols-outlined text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
          </div>

          {/* User Snippet & Footer Controls at Sidebar Bottom */}
          {/* Note: Admin Ops Console is intentionally permanently dark per system design specs for 24/7 high-contrast operational monitoring */}
          <div className="p-md border-t border-emerald-800/40 bg-[#142414] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-600/40 border border-emerald-400/30 text-emerald-200 font-bold flex items-center justify-center text-xs">
                  SA
                </div>
                <div>
                  <p className="font-body-sm text-xs font-bold text-emerald-100 leading-tight">
                    {user?.displayName || 'System Admin'}
                  </p>
                  <span className="inline-flex items-center gap-1 font-label-mono text-[9px] text-emerald-400">
                    <span className="material-symbols-outlined text-[10px]">key</span>
                    Unrestricted
                  </span>
                </div>
              </div>

              <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded font-label-mono text-[9px] uppercase">
                PROD
              </span>
            </div>

            <div className="pt-1 border-t border-emerald-800/30 flex items-center justify-between">
              <LanguageToggle />
              <span className="font-label-mono text-[9px] text-emerald-400/60 uppercase">
                24/7 OPS
              </span>
            </div>
          </div>
        </aside>

        {/* Content Container */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Bar Scaffolding */}
          <header className="h-16 border-b border-outline-variant/20 bg-surface-container-lowest px-md sm:px-lg flex items-center justify-between sticky top-0 z-20 shadow-xs">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
              <span className="font-label-mono text-xs text-on-surface-variant uppercase tracking-wider">
                Platform Admin
              </span>
              <span className="text-outline text-xs">/</span>
              <span className="font-headline-lg-mobile text-sm text-on-surface font-bold">
                {getBreadcrumb()}
              </span>
            </div>

            {/* Center Search Input */}
            <form onSubmit={handleGlobalSearchSubmit} className="hidden md:flex items-center relative w-72 lg:w-96">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users, SACCOs, vehicles, trips, logs..."
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-9 pr-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-sm"
              />
            </form>

            {/* Right Header Actions */}
            <div className="flex items-center gap-sm">
              {/* Unrestricted Scope Chip */}
              <div className="hidden lg:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-full font-label-mono text-[10px] font-bold">
                <span className="material-symbols-outlined text-sm">public</span>
                <span>All SACCOs · All Counties</span>
              </div>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container relative"
                  title="Notifications"
                >
                  <span className="material-symbols-outlined text-xl">notifications</span>
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl p-md z-50 text-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                      <span className="font-headline-lg-mobile text-xs font-bold text-on-surface">
                        System Notifications
                      </span>
                      <span className="font-label-mono text-[10px] text-primary">2 Unread</span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      <div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 space-y-1">
                        <p className="font-bold text-on-surface text-[11px]">
                          Pending SACCO Verification
                        </p>
                        <p className="text-on-surface-variant text-[10px]">
                          MetroLink Express submitted compliance documents.
                        </p>
                        <span className="font-label-mono text-[9px] text-outline">10m ago</span>
                      </div>

                      <div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 space-y-1">
                        <p className="font-bold text-rose-600 text-[11px]">
                          Cloud Function Latency Elevated
                        </p>
                        <p className="text-on-surface-variant text-[10px]">
                          p95 latency spike detected on GPS ingestion pipeline.
                        </p>
                        <span className="font-label-mono text-[9px] text-outline">25m ago</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User Avatar & Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1 rounded-xl hover:bg-surface-container"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs">
                    {user?.displayName ? user.displayName.charAt(0) : 'A'}
                  </div>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">
                    arrow_drop_down
                  </span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-52 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl p-sm z-50 text-xs space-y-1">
                    <div className="p-2 border-b border-outline-variant/20">
                      <p className="font-bold text-on-surface">{user?.displayName || 'System Admin'}</p>
                      <p className="font-label-mono text-[10px] text-outline">{user?.email}</p>
                    </div>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/admin/profile');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-container flex items-center gap-2 font-label-mono"
                    >
                      <span className="material-symbols-outlined text-base">account_circle</span>
                      <span>Admin Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/admin/settings');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-container flex items-center gap-2 font-label-mono"
                    >
                      <span className="material-symbols-outlined text-base">settings</span>
                      <span>Platform Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                        navigate('/login');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-600 flex items-center gap-2 font-label-mono"
                    >
                      <span className="material-symbols-outlined text-base">logout</span>
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Workspace Area */}
          <main className="p-lg sm:p-xl max-w-7xl w-full mx-auto flex-1 space-y-lg">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

