import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { PassengerShell } from '../components/shells/PassengerShell';
import { SaccoShell } from '../components/shells/SaccoShell';
import { AuthorityShell } from '../components/shells/AuthorityShell';
import { AdminShell } from '../components/shells/AdminShell';
import { RoleGuard } from '../components/common/RoleGuard';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

// Route-based Code Splitting (React.lazy)
const SplashScreen = lazy(() =>
  import('../features/common/SplashScreen').then((m) => ({ default: m.SplashScreen }))
);
const WelcomeScreen = lazy(() =>
  import('../features/auth/WelcomeScreen').then((m) => ({ default: m.WelcomeScreen }))
);
const LocationPermissionPromptScreen = lazy(() =>
  import('../features/common/LocationPermissionPromptScreen').then((m) => ({
    default: m.LocationPermissionPromptScreen,
  }))
);

// Auth Screens
const LoginScreen = lazy(() =>
  import('../features/auth/LoginScreen').then((m) => ({ default: m.LoginScreen }))
);
const RegisterScreen = lazy(() =>
  import('../features/auth/RegisterScreen').then((m) => ({ default: m.RegisterScreen }))
);
const ForgotPasswordScreen = lazy(() =>
  import('../features/auth/ForgotPasswordScreen').then((m) => ({ default: m.ForgotPasswordScreen }))
);
const EmailVerificationScreen = lazy(() =>
  import('../features/auth/EmailVerificationScreen').then((m) => ({ default: m.EmailVerificationScreen }))
);
const OtpVerificationScreen = lazy(() =>
  import('../features/auth/OtpVerificationScreen').then((m) => ({ default: m.OtpVerificationScreen }))
);
const LoadingAuthScreen = lazy(() =>
  import('../features/auth/LoadingAuthScreen').then((m) => ({ default: m.LoadingAuthScreen }))
);
const SessionExpiredScreen = lazy(() =>
  import('../features/auth/SessionExpiredScreen').then((m) => ({ default: m.SessionExpiredScreen }))
);
const AccountSuspendedScreen = lazy(() =>
  import('../features/auth/AccountSuspendedScreen').then((m) => ({ default: m.AccountSuspendedScreen }))
);
const UnauthorizedScreen = lazy(() =>
  import('../features/auth/UnauthorizedScreen').then((m) => ({ default: m.UnauthorizedScreen }))
);

// System Error & Full-Page Layouts
const ComponentShowcaseScreen = lazy(() =>
  import('../features/dev/ComponentShowcaseScreen').then((m) => ({ default: m.ComponentShowcaseScreen }))
);
const MaintenanceModeScreen = lazy(() =>
  import('../features/common/MaintenanceModeScreen').then((m) => ({ default: m.MaintenanceModeScreen }))
);
const ScheduledMaintenanceScreen = lazy(() =>
  import('../features/common/ScheduledMaintenanceScreen').then((m) => ({
    default: m.ScheduledMaintenanceScreen,
  }))
);
const ServerUnavailableScreen = lazy(() =>
  import('../features/common/ServerUnavailableScreen').then((m) => ({
    default: m.ServerUnavailableScreen,
  }))
);
const UpdateRequiredScreen = lazy(() =>
  import('../features/common/UpdateRequiredScreen').then((m) => ({ default: m.UpdateRequiredScreen }))
);
const UpdateAvailableScreen = lazy(() =>
  import('../features/common/UpdateAvailableScreen').then((m) => ({ default: m.UpdateAvailableScreen }))
);
const NotFound404Screen = lazy(() =>
  import('../features/common/NotFound404Screen').then((m) => ({ default: m.NotFound404Screen }))
);

// Permissions & Onboarding
const PermissionsWizardScreen = lazy(() =>
  import('../features/common/PermissionsWizardScreen').then((m) => ({
    default: m.PermissionsWizardScreen,
  }))
);

// Passenger Feature Screens
const PassengerDashboard = lazy(() =>
  import('../features/passenger/PassengerDashboard').then((m) => ({ default: m.PassengerDashboard }))
);
const ActiveTripScreen = lazy(() =>
  import('../features/passenger/ActiveTripScreen').then((m) => ({ default: m.ActiveTripScreen }))
);
const TripHistoryScreen = lazy(() =>
  import('../features/passenger/TripHistoryScreen').then((m) => ({ default: m.TripHistoryScreen }))
);
const SafetyMapScreen = lazy(() =>
  import('../features/passenger/SafetyMapScreen').then((m) => ({ default: m.SafetyMapScreen }))
);
const ReportBlackSpotScreen = lazy(() =>
  import('../features/passenger/ReportBlackSpotScreen').then((m) => ({ default: m.ReportBlackSpotScreen }))
);
const EmergencySosScreen = lazy(() =>
  import('../features/passenger/EmergencySosScreen').then((m) => ({ default: m.EmergencySosScreen }))
);
const PassengerAlertsScreen = lazy(() =>
  import('../features/passenger/PassengerAlertsScreen').then((m) => ({ default: m.PassengerAlertsScreen }))
);
const PassengerProfileScreen = lazy(() =>
  import('../features/passenger/PassengerProfileScreen').then((m) => ({ default: m.PassengerProfileScreen }))
);
const SaccoDashboard = lazy(() =>
  import('../features/sacco/SaccoDashboard').then((m) => ({ default: m.SaccoDashboard }))
);
const SaccoFleetScreen = lazy(() =>
  import('../features/sacco/SaccoFleetScreen').then((m) => ({ default: m.SaccoFleetScreen }))
);
const SaccoDriversScreen = lazy(() =>
  import('../features/sacco/SaccoDriversScreen').then((m) => ({ default: m.SaccoDriversScreen }))
);
const SaccoLiveTripsScreen = lazy(() =>
  import('../features/sacco/SaccoLiveTripsScreen').then((m) => ({ default: m.SaccoLiveTripsScreen }))
);
const SaccoViolationsScreen = lazy(() =>
  import('../features/sacco/SaccoViolationsScreen').then((m) => ({ default: m.SaccoViolationsScreen }))
);
const SaccoBlackSpotsScreen = lazy(() =>
  import('../features/sacco/SaccoBlackSpotsScreen').then((m) => ({ default: m.SaccoBlackSpotsScreen }))
);
const SaccoReportsScreen = lazy(() =>
  import('../features/sacco/SaccoReportsScreen').then((m) => ({ default: m.SaccoReportsScreen }))
);
const SaccoAnalyticsScreen = lazy(() =>
  import('../features/sacco/SaccoAnalyticsScreen').then((m) => ({ default: m.SaccoAnalyticsScreen }))
);
const SaccoNotificationsScreen = lazy(() =>
  import('../features/sacco/SaccoNotificationsScreen').then((m) => ({ default: m.SaccoNotificationsScreen }))
);
const SaccoUsersScreen = lazy(() =>
  import('../features/sacco/SaccoUsersScreen').then((m) => ({ default: m.SaccoUsersScreen }))
);
const SaccoSettingsScreen = lazy(() =>
  import('../features/sacco/SaccoSettingsScreen').then((m) => ({ default: m.SaccoSettingsScreen }))
);

const AuthorityDashboard = lazy(() =>
  import('../features/authority/AuthorityDashboard').then((m) => ({ default: m.AuthorityDashboard }))
);
const AuthorityComplianceScreen = lazy(() =>
  import('../features/authority/AuthorityComplianceScreen').then((m) => ({ default: m.AuthorityComplianceScreen }))
);
const AuthorityBlackSpotsScreen = lazy(() =>
  import('../features/authority/AuthorityBlackSpotsScreen').then((m) => ({ default: m.AuthorityBlackSpotsScreen }))
);
const AuthorityInspectionsScreen = lazy(() =>
  import('../features/authority/AuthorityInspectionsScreen').then((m) => ({ default: m.AuthorityInspectionsScreen }))
);
const AuthorityEmergencyScreen = lazy(() =>
  import('../features/authority/AuthorityEmergencyScreen').then((m) => ({ default: m.AuthorityEmergencyScreen }))
);
const AuthorityComplaintsScreen = lazy(() =>
  import('../features/authority/AuthorityComplaintsScreen').then((m) => ({ default: m.AuthorityComplaintsScreen }))
);
const AuthorityReportsScreen = lazy(() =>
  import('../features/authority/AuthorityReportsScreen').then((m) => ({ default: m.AuthorityReportsScreen }))
);
const AuthoritySettingsScreen = lazy(() =>
  import('../features/authority/AuthoritySettingsScreen').then((m) => ({ default: m.AuthoritySettingsScreen }))
);
const AdminDashboard = lazy(() =>
  import('../features/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const AdminUsersScreen = lazy(() =>
  import('../features/admin/AdminUsersScreen').then((m) => ({ default: m.AdminUsersScreen }))
);
const AdminRolesScreen = lazy(() =>
  import('../features/admin/AdminRolesScreen').then((m) => ({ default: m.AdminRolesScreen }))
);
const AdminSaccosScreen = lazy(() =>
  import('../features/admin/AdminSaccosScreen').then((m) => ({ default: m.AdminSaccosScreen }))
);
const AdminAuthoritiesScreen = lazy(() =>
  import('../features/admin/AdminAuthoritiesScreen').then((m) => ({ default: m.AdminAuthoritiesScreen }))
);
const AdminVehiclesScreen = lazy(() =>
  import('../features/admin/AdminVehiclesScreen').then((m) => ({ default: m.AdminVehiclesScreen }))
);
const AdminTripsScreen = lazy(() =>
  import('../features/admin/AdminTripsScreen').then((m) => ({ default: m.AdminTripsScreen }))
);
const AdminReportsScreen = lazy(() =>
  import('../features/admin/AdminReportsScreen').then((m) => ({ default: m.AdminReportsScreen }))
);
const AdminModerationScreen = lazy(() =>
  import('../features/admin/AdminModerationScreen').then((m) => ({ default: m.AdminModerationScreen }))
);
const AdminFeatureFlagsScreen = lazy(() =>
  import('../features/admin/AdminFeatureFlagsScreen').then((m) => ({ default: m.AdminFeatureFlagsScreen }))
);
const AdminSystemHealthScreen = lazy(() =>
  import('../features/admin/AdminSystemHealthScreen').then((m) => ({ default: m.AdminSystemHealthScreen }))
);
const AdminMonitoringScreen = lazy(() =>
  import('../features/admin/AdminMonitoringScreen').then((m) => ({ default: m.AdminMonitoringScreen }))
);
const AdminAuditLogsScreen = lazy(() =>
  import('../features/admin/AdminAuditLogsScreen').then((m) => ({ default: m.AdminAuditLogsScreen }))
);
const AdminAnalyticsScreen = lazy(() =>
  import('../features/admin/AdminAnalyticsScreen').then((m) => ({ default: m.AdminAnalyticsScreen }))
);
const AdminNotificationsScreen = lazy(() =>
  import('../features/admin/AdminNotificationsScreen').then((m) => ({ default: m.AdminNotificationsScreen }))
);
const AdminIntegrationsScreen = lazy(() =>
  import('../features/admin/AdminIntegrationsScreen').then((m) => ({ default: m.AdminIntegrationsScreen }))
);
const AdminSecurityScreen = lazy(() =>
  import('../features/admin/AdminSecurityScreen').then((m) => ({ default: m.AdminSecurityScreen }))
);
const AdminMaintenanceScreen = lazy(() =>
  import('../features/admin/AdminMaintenanceScreen').then((m) => ({ default: m.AdminMaintenanceScreen }))
);
const AdminSettingsScreen = lazy(() =>
  import('../features/admin/AdminSettingsScreen').then((m) => ({ default: m.AdminSettingsScreen }))
);

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-md">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">
        progress_activity
      </span>
      <span className="font-label-mono text-xs text-on-surface-variant uppercase tracking-wider">
        Mwendo Salama Loading...
      </span>
    </div>
  </div>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <WelcomeScreen />,
  },
  {
    path: '/onboarding',
    element: <WelcomeScreen />,
  },
  {
    path: '/location-permission',
    element: <PermissionsWizardScreen />,
  },
  {
    path: '/permissions-wizard',
    element: <PermissionsWizardScreen />,
  },

  // Auth Layouts
  {
    path: '/auth/login',
    element: <LoginScreen />,
  },
  {
    path: '/auth/register',
    element: <RegisterScreen />,
  },
  {
    path: '/auth/forgot-password',
    element: <ForgotPasswordScreen />,
  },
  {
    path: '/auth/verify-email',
    element: <EmailVerificationScreen />,
  },
  {
    path: '/auth/verify-otp',
    element: <OtpVerificationScreen />,
  },
  {
    path: '/auth/loading',
    element: <LoadingAuthScreen />,
  },
  {
    path: '/auth/session-expired',
    element: <SessionExpiredScreen />,
  },
  {
    path: '/auth/suspended',
    element: <AccountSuspendedScreen />,
  },
  {
    path: '/auth/unauthorized',
    element: <UnauthorizedScreen />,
  },

  // System Layouts
  {
    path: '/dev/components',
    element: <ComponentShowcaseScreen />,
  },
  {
    path: '/maintenance',
    element: <MaintenanceModeScreen />,
  },
  {
    path: '/scheduled-maintenance',
    element: <ScheduledMaintenanceScreen />,
  },
  {
    path: '/server-unavailable',
    element: <ServerUnavailableScreen />,
  },
  {
    path: '/update-required',
    element: <UpdateRequiredScreen />,
  },
  {
    path: '/update-available',
    element: <UpdateAvailableScreen />,
  },

  // Passenger Shell & Routes
  {
    element: <RoleGuard allowedRoles={['passenger']} />,
    children: [
      {
        path: '/passenger',
        element: <PassengerShell />,
        children: [
          {
            index: true,
            element: <PassengerDashboard />,
          },
          {
            path: 'start-trip',
            element: <ActiveTripScreen />,
          },
          {
            path: 'trips',
            element: <TripHistoryScreen />,
          },
          {
            path: 'map',
            element: <SafetyMapScreen />,
          },
          {
            path: 'report-blackspot',
            element: <ReportBlackSpotScreen />,
          },
          {
            path: 'sos',
            element: <EmergencySosScreen />,
          },
          {
            path: 'alerts',
            element: <PassengerAlertsScreen />,
          },
          {
            path: 'profile',
            element: <PassengerProfileScreen />,
          },
        ],
      },
    ],
  },

  // SACCO Shell & Routes
  {
    element: <RoleGuard allowedRoles={['sacco_official', 'sacco_manager']} />,
    children: [
      {
        path: '/sacco',
        element: <SaccoShell />,
        children: [
          {
            index: true,
            element: <SaccoDashboard />,
          },
          {
            path: 'fleet',
            element: <SaccoFleetScreen />,
          },
          {
            path: 'drivers',
            element: <SaccoDriversScreen />,
          },
          {
            path: 'trips',
            element: <SaccoLiveTripsScreen />,
          },
          {
            path: 'violations',
            element: <SaccoViolationsScreen />,
          },
          {
            path: 'reports',
            element: <SaccoReportsScreen />,
          },
          {
            path: 'analytics',
            element: <SaccoAnalyticsScreen />,
          },
          {
            path: 'blackspots',
            element: <SaccoBlackSpotsScreen />,
          },
          {
            path: 'notifications',
            element: <SaccoNotificationsScreen />,
          },
          {
            path: 'users',
            element: <SaccoUsersScreen />,
          },
          {
            path: 'settings',
            element: <SaccoSettingsScreen />,
          },
          {
            path: 'profile',
            element: <SaccoSettingsScreen />,
          },
        ],
      },
    ],
  },

  // Authority Shell & Routes
  {
    element: <RoleGuard allowedRoles={['authority']} />,
    children: [
      {
        path: '/authority',
        element: <AuthorityShell />,
        children: [
          {
            index: true,
            element: <AuthorityDashboard />,
          },
          {
            path: 'compliance',
            element: <AuthorityComplianceScreen />,
          },
          {
            path: 'black-spots',
            element: <AuthorityBlackSpotsScreen />,
          },
          {
            path: 'inspections',
            element: <AuthorityInspectionsScreen />,
          },
          {
            path: 'emergency',
            element: <AuthorityEmergencyScreen />,
          },
          {
            path: 'complaints',
            element: <AuthorityComplaintsScreen />,
          },
          {
            path: 'reports',
            element: <AuthorityReportsScreen />,
          },
          {
            path: 'settings',
            element: <AuthoritySettingsScreen />,
          },
          {
            path: 'profile',
            element: <AuthoritySettingsScreen />,
          },
        ],
      },
    ],
  },

  // Admin Shell & Routes
  {
    element: <RoleGuard allowedRoles={['admin']} />,
    children: [
      {
        path: '/admin',
        element: <AdminShell />,
        children: [
          {
            index: true,
            element: <AdminDashboard />,
          },
          {
            path: 'users',
            element: <AdminUsersScreen />,
          },
          {
            path: 'roles',
            element: <AdminRolesScreen />,
          },
          {
            path: 'saccos',
            element: <AdminSaccosScreen />,
          },
          {
            path: 'authorities',
            element: <AdminAuthoritiesScreen />,
          },
          {
            path: 'vehicles',
            element: <AdminVehiclesScreen />,
          },
          {
            path: 'trips',
            element: <AdminTripsScreen />,
          },
          {
            path: 'reports',
            element: <AdminReportsScreen />,
          },
          {
            path: 'moderation',
            element: <AdminModerationScreen />,
          },
          {
            path: 'feature-flags',
            element: <AdminFeatureFlagsScreen />,
          },
          {
            path: 'health',
            element: <AdminSystemHealthScreen />,
          },
          {
            path: 'monitoring',
            element: <AdminMonitoringScreen />,
          },
          {
            path: 'audit-logs',
            element: <AdminAuditLogsScreen />,
          },
          {
            path: 'analytics',
            element: <AdminAnalyticsScreen />,
          },
          {
            path: 'notifications',
            element: <AdminNotificationsScreen />,
          },
          {
            path: 'integrations',
            element: <AdminIntegrationsScreen />,
          },
          {
            path: 'security',
            element: <AdminSecurityScreen />,
          },
          {
            path: 'maintenance',
            element: <AdminMaintenanceScreen />,
          },
          {
            path: 'settings',
            element: <AdminSettingsScreen />,
          },
          {
            path: 'profile',
            element: <AdminSettingsScreen />,
          },
        ],
      },
    ],
  },

  // Fallback 404
  {
    path: '*',
    element: <NotFound404Screen />,
  },
]);

export const AppRoutes: React.FC = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <RouterProvider router={router} />
      </Suspense>
    </ErrorBoundary>
  );
};
