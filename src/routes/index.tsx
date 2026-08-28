import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { PassengerShell } from '../components/shells/PassengerShell';
import { SaccoShell } from '../components/shells/SaccoShell';
import { AuthorityShell } from '../components/shells/AuthorityShell';
import { AdminShell } from '../components/shells/AdminShell';
import { RoleGuard } from '../components/common/RoleGuard';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { RouteErrorElement } from '../components/common/RouteErrorElement';
import { lazyWithRetry } from '../lib/lazyWithRetry';
import { BrandLoader } from '../components/ui/LoadingIndicators';

// Route-based Code Splitting with Auto-Retry
const WelcomeScreen = lazyWithRetry(() => import('../features/auth/WelcomeScreen').then((m) => ({ default: m.WelcomeScreen })));
const LoginScreen = lazyWithRetry(() => import('../features/auth/LoginScreen').then((m) => ({ default: m.LoginScreen })));
const RegisterScreen = lazyWithRetry(() => import('../features/auth/RegisterScreen').then((m) => ({ default: m.RegisterScreen })));
const ForgotPasswordScreen = lazyWithRetry(() => import('../features/auth/ForgotPasswordScreen').then((m) => ({ default: m.ForgotPasswordScreen })));
const EmailVerificationScreen = lazyWithRetry(() => import('../features/auth/EmailVerificationScreen').then((m) => ({ default: m.EmailVerificationScreen })));
const OtpVerificationScreen = lazyWithRetry(() => import('../features/auth/OtpVerificationScreen').then((m) => ({ default: m.OtpVerificationScreen })));
const LoadingAuthScreen = lazyWithRetry(() => import('../features/auth/LoadingAuthScreen').then((m) => ({ default: m.LoadingAuthScreen })));
const SessionExpiredScreen = lazyWithRetry(() => import('../features/auth/SessionExpiredScreen').then((m) => ({ default: m.SessionExpiredScreen })));
const AccountSuspendedScreen = lazyWithRetry(() => import('../features/auth/AccountSuspendedScreen').then((m) => ({ default: m.AccountSuspendedScreen })));
const UnauthorizedScreen = lazyWithRetry(() => import('../features/auth/UnauthorizedScreen').then((m) => ({ default: m.UnauthorizedScreen })));
const MfaEnrollmentScreen = lazyWithRetry(() => import('../features/auth/MfaEnrollmentScreen').then((m) => ({ default: m.MfaEnrollmentScreen })));
const MfaChallengeScreen = lazyWithRetry(() => import('../features/auth/MfaChallengeScreen').then((m) => ({ default: m.MfaChallengeScreen })));

// System Error & Full-Page Layouts
const MaintenanceModeScreen = lazyWithRetry(() => import('../features/common/MaintenanceModeScreen').then((m) => ({ default: m.MaintenanceModeScreen })));
const ScheduledMaintenanceScreen = lazyWithRetry(() => import('../features/common/ScheduledMaintenanceScreen').then((m) => ({ default: m.ScheduledMaintenanceScreen })));
const ServerUnavailableScreen = lazyWithRetry(() => import('../features/common/ServerUnavailableScreen').then((m) => ({ default: m.ServerUnavailableScreen })));
const UpdateRequiredScreen = lazyWithRetry(() => import('../features/common/UpdateRequiredScreen').then((m) => ({ default: m.UpdateRequiredScreen })));
const UpdateAvailableScreen = lazyWithRetry(() => import('../features/common/UpdateAvailableScreen').then((m) => ({ default: m.UpdateAvailableScreen })));
const NotFound404Screen = lazyWithRetry(() => import('../features/common/NotFound404Screen').then((m) => ({ default: m.NotFound404Screen })));

// Permissions & Onboarding
const PermissionsWizardScreen = lazyWithRetry(() => import('../features/common/PermissionsWizardScreen').then((m) => ({ default: m.PermissionsWizardScreen })));

// Passenger Feature Screens
const PassengerDashboard = lazyWithRetry(() => import('../features/passenger/PassengerDashboard').then((m) => ({ default: m.PassengerDashboard })));
const ActiveTripScreen = lazyWithRetry(() => import('../features/passenger/ActiveTripScreen').then((m) => ({ default: m.ActiveTripScreen })));
const TripHistoryScreen = lazyWithRetry(() => import('../features/passenger/TripHistoryScreen').then((m) => ({ default: m.TripHistoryScreen })));
const SafetyMapScreen = lazyWithRetry(() => import('../features/passenger/SafetyMapScreen').then((m) => ({ default: m.SafetyMapScreen })));
const ReportBlackSpotScreen = lazyWithRetry(() => import('../features/passenger/ReportBlackSpotScreen').then((m) => ({ default: m.ReportBlackSpotScreen })));
const EmergencySosScreen = lazyWithRetry(() => import('../features/passenger/EmergencySosScreen').then((m) => ({ default: m.EmergencySosScreen })));
const PassengerAlertsScreen = lazyWithRetry(() => import('../features/passenger/PassengerAlertsScreen').then((m) => ({ default: m.PassengerAlertsScreen })));
const PassengerProfileScreen = lazyWithRetry(() => import('../features/passenger/PassengerProfileScreen').then((m) => ({ default: m.PassengerProfileScreen })));

// SACCO Feature Screens
const SaccoDashboard = lazyWithRetry(() => import('../features/sacco/SaccoDashboard').then((m) => ({ default: m.SaccoDashboard })));
const SaccoFleetScreen = lazyWithRetry(() => import('../features/sacco/SaccoFleetScreen').then((m) => ({ default: m.SaccoFleetScreen })));
const SaccoDriversScreen = lazyWithRetry(() => import('../features/sacco/SaccoDriversScreen').then((m) => ({ default: m.SaccoDriversScreen })));
const SaccoLiveTripsScreen = lazyWithRetry(() => import('../features/sacco/SaccoLiveTripsScreen').then((m) => ({ default: m.SaccoLiveTripsScreen })));
const SaccoViolationsScreen = lazyWithRetry(() => import('../features/sacco/SaccoViolationsScreen').then((m) => ({ default: m.SaccoViolationsScreen })));
const SaccoBlackSpotsScreen = lazyWithRetry(() => import('../features/sacco/SaccoBlackSpotsScreen').then((m) => ({ default: m.SaccoBlackSpotsScreen })));
const SaccoReportsScreen = lazyWithRetry(() => import('../features/sacco/SaccoReportsScreen').then((m) => ({ default: m.SaccoReportsScreen })));
const SaccoAnalyticsScreen = lazyWithRetry(() => import('../features/sacco/SaccoAnalyticsScreen').then((m) => ({ default: m.SaccoAnalyticsScreen })));
const SaccoNotificationsScreen = lazyWithRetry(() => import('../features/sacco/SaccoNotificationsScreen').then((m) => ({ default: m.SaccoNotificationsScreen })));
const SaccoUsersScreen = lazyWithRetry(() => import('../features/sacco/SaccoUsersScreen').then((m) => ({ default: m.SaccoUsersScreen })));
const SaccoSettingsScreen = lazyWithRetry(() => import('../features/sacco/SaccoSettingsScreen').then((m) => ({ default: m.SaccoSettingsScreen })));

// Authority Feature Screens
const AuthorityDashboard = lazyWithRetry(() => import('../features/authority/AuthorityDashboard').then((m) => ({ default: m.AuthorityDashboard })));
const AuthorityComplianceScreen = lazyWithRetry(() => import('../features/authority/AuthorityComplianceScreen').then((m) => ({ default: m.AuthorityComplianceScreen })));
const AuthorityBlackSpotsScreen = lazyWithRetry(() => import('../features/authority/AuthorityBlackSpotsScreen').then((m) => ({ default: m.AuthorityBlackSpotsScreen })));
const AuthorityInspectionsScreen = lazyWithRetry(() => import('../features/authority/AuthorityInspectionsScreen').then((m) => ({ default: m.AuthorityInspectionsScreen })));
const AuthorityEmergencyScreen = lazyWithRetry(() => import('../features/authority/AuthorityEmergencyScreen').then((m) => ({ default: m.AuthorityEmergencyScreen })));
const AuthorityComplaintsScreen = lazyWithRetry(() => import('../features/authority/AuthorityComplaintsScreen').then((m) => ({ default: m.AuthorityComplaintsScreen })));
const AuthorityReportsScreen = lazyWithRetry(() => import('../features/authority/AuthorityReportsScreen').then((m) => ({ default: m.AuthorityReportsScreen })));
const AuthoritySettingsScreen = lazyWithRetry(() => import('../features/authority/AuthoritySettingsScreen').then((m) => ({ default: m.AuthoritySettingsScreen })));

// Admin Feature Screens
const AdminDashboard = lazyWithRetry(() => import('../features/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminUsersScreen = lazyWithRetry(() => import('../features/admin/AdminUsersScreen').then((m) => ({ default: m.AdminUsersScreen })));
const AdminRolesScreen = lazyWithRetry(() => import('../features/admin/AdminRolesScreen').then((m) => ({ default: m.AdminRolesScreen })));
const AdminSaccosScreen = lazyWithRetry(() => import('../features/admin/AdminSaccosScreen').then((m) => ({ default: m.AdminSaccosScreen })));
const AdminAuthoritiesScreen = lazyWithRetry(() => import('../features/admin/AdminAuthoritiesScreen').then((m) => ({ default: m.AdminAuthoritiesScreen })));
const AdminVehiclesScreen = lazyWithRetry(() => import('../features/admin/AdminVehiclesScreen').then((m) => ({ default: m.AdminVehiclesScreen })));
const AdminTripsScreen = lazyWithRetry(() => import('../features/admin/AdminTripsScreen').then((m) => ({ default: m.AdminTripsScreen })));
const AdminReportsScreen = lazyWithRetry(() => import('../features/admin/AdminReportsScreen').then((m) => ({ default: m.AdminReportsScreen })));
const AdminModerationScreen = lazyWithRetry(() => import('../features/admin/AdminModerationScreen').then((m) => ({ default: m.AdminModerationScreen })));
const AdminFeatureFlagsScreen = lazyWithRetry(() => import('../features/admin/AdminFeatureFlagsScreen').then((m) => ({ default: m.AdminFeatureFlagsScreen })));
const AdminSystemHealthScreen = lazyWithRetry(() => import('../features/admin/AdminSystemHealthScreen').then((m) => ({ default: m.AdminSystemHealthScreen })));
const AdminMonitoringScreen = lazyWithRetry(() => import('../features/admin/AdminMonitoringScreen').then((m) => ({ default: m.AdminMonitoringScreen })));
const AdminAuditLogsScreen = lazyWithRetry(() => import('../features/admin/AdminAuditLogsScreen').then((m) => ({ default: m.AdminAuditLogsScreen })));
const AdminAnalyticsScreen = lazyWithRetry(() => import('../features/admin/AdminAnalyticsScreen').then((m) => ({ default: m.AdminAnalyticsScreen })));
const AdminNotificationsScreen = lazyWithRetry(() => import('../features/admin/AdminNotificationsScreen').then((m) => ({ default: m.AdminNotificationsScreen })));
const AdminIntegrationsScreen = lazyWithRetry(() => import('../features/admin/AdminIntegrationsScreen').then((m) => ({ default: m.AdminIntegrationsScreen })));
const AdminSecurityScreen = lazyWithRetry(() => import('../features/admin/AdminSecurityScreen').then((m) => ({ default: m.AdminSecurityScreen })));
const AdminMaintenanceScreen = lazyWithRetry(() => import('../features/admin/AdminMaintenanceScreen').then((m) => ({ default: m.AdminMaintenanceScreen })));
const AdminSettingsScreen = lazyWithRetry(() => import('../features/admin/AdminSettingsScreen').then((m) => ({ default: m.AdminSettingsScreen })));

const ContentLoadingFallback = () => (
  <div className="w-full h-full min-h-[300px] flex items-center justify-center p-8" aria-live="polite">
    <BrandLoader size="md" />
  </div>
);

const FullPageLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background" aria-live="polite">
    <BrandLoader size="lg" />
  </div>
);

const withFullPageSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<FullPageLoadingFallback />}>{element}</Suspense>
);

export const ContentSuspenseOutlet: React.FC = () => (
  <Suspense fallback={<ContentLoadingFallback />}>
    <Outlet />
  </Suspense>
);

const router = createBrowserRouter([
  { path: '/', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<WelcomeScreen />) },
  { path: '/onboarding', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<WelcomeScreen />) },
  { path: '/location-permission', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<PermissionsWizardScreen />) },
  { path: '/permissions-wizard', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<PermissionsWizardScreen />) },

  // Auth Layouts
  { path: '/auth/login', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<LoginScreen />) },
  { path: '/auth/register', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<RegisterScreen />) },
  { path: '/auth/forgot-password', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<ForgotPasswordScreen />) },
  { path: '/auth/verify-email', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<EmailVerificationScreen />) },
  { path: '/auth/verify-otp', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<OtpVerificationScreen />) },
  { path: '/auth/loading', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<LoadingAuthScreen />) },
  { path: '/auth/session-expired', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<SessionExpiredScreen />) },
  { path: '/auth/suspended', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<AccountSuspendedScreen />) },
  { path: '/auth/unauthorized', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<UnauthorizedScreen />) },
  { path: '/auth/mfa-enrollment', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<MfaEnrollmentScreen />) },
  { path: '/auth/mfa-challenge', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<MfaChallengeScreen />) },

  // System Layouts
  { path: '/maintenance', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<MaintenanceModeScreen />) },
  { path: '/scheduled-maintenance', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<ScheduledMaintenanceScreen />) },
  { path: '/server-unavailable', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<ServerUnavailableScreen />) },
  { path: '/update-required', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<UpdateRequiredScreen />) },
  { path: '/update-available', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<UpdateAvailableScreen />) },

  // Passenger Shell & Routes
  {
    element: <RoleGuard allowedRoles={['passenger']} />,
    errorElement: <RouteErrorElement />,
    children: [{
      path: '/passenger',
      element: <PassengerShell />,
      errorElement: <RouteErrorElement />,
      children: [
        { index: true, element: <PassengerDashboard /> },
        { path: 'start-trip', element: <ActiveTripScreen /> },
        { path: 'trips', element: <TripHistoryScreen /> },
        { path: 'map', element: <SafetyMapScreen /> },
        { path: 'report-blackspot', element: <ReportBlackSpotScreen /> },
        { path: 'sos', element: <EmergencySosScreen /> },
        { path: 'alerts', element: <PassengerAlertsScreen /> },
        { path: 'profile', element: <PassengerProfileScreen /> },
      ],
    }],
  },

  // SACCO Shell & Routes
  {
    element: <RoleGuard allowedRoles={['sacco_manager']} />,
    errorElement: <RouteErrorElement />,
    children: [{
      path: '/sacco',
      element: <SaccoShell />,
      errorElement: <RouteErrorElement />,
      children: [
        { index: true, element: <SaccoDashboard /> },
        { path: 'fleet', element: <SaccoFleetScreen /> },
        { path: 'vehicles', element: <SaccoFleetScreen /> },
        { path: 'drivers', element: <SaccoDriversScreen /> },
        { path: 'trips', element: <SaccoLiveTripsScreen /> },
        { path: 'live-trips', element: <SaccoLiveTripsScreen /> },
        { path: 'violations', element: <SaccoViolationsScreen /> },
        { path: 'reports', element: <SaccoReportsScreen /> },
        { path: 'analytics', element: <SaccoAnalyticsScreen /> },
        { path: 'blackspots', element: <SaccoBlackSpotsScreen /> },
        { path: 'black-spots', element: <SaccoBlackSpotsScreen /> },
        { path: 'notifications', element: <SaccoNotificationsScreen /> },
        { path: 'users', element: <SaccoUsersScreen /> },
        { path: 'settings', element: <SaccoSettingsScreen /> },
        { path: 'profile', element: <SaccoSettingsScreen /> },
      ],
    }],
  },

  // Authority Shell & Routes
  {
    element: <RoleGuard allowedRoles={['authority']} />,
    errorElement: <RouteErrorElement />,
    children: [{
      path: '/authority',
      element: <AuthorityShell />,
      errorElement: <RouteErrorElement />,
      children: [
        { index: true, element: <AuthorityDashboard /> },
        { path: 'compliance', element: <AuthorityComplianceScreen /> },
        { path: 'black-spots', element: <AuthorityBlackSpotsScreen /> },
        { path: 'blackspots', element: <AuthorityBlackSpotsScreen /> },
        { path: 'inspections', element: <AuthorityInspectionsScreen /> },
        { path: 'emergency', element: <AuthorityEmergencyScreen /> },
        { path: 'complaints', element: <AuthorityComplaintsScreen /> },
        { path: 'reports', element: <AuthorityReportsScreen /> },
        { path: 'settings', element: <AuthoritySettingsScreen /> },
        { path: 'profile', element: <AuthoritySettingsScreen /> },
      ],
    }],
  },

  // Admin Shell & Routes
  {
    element: <RoleGuard allowedRoles={['admin']} />,
    errorElement: <RouteErrorElement />,
    children: [{
      path: '/admin',
      element: <AdminShell />,
      errorElement: <RouteErrorElement />,
      children: [
        { index: true, element: <AdminDashboard /> },
        { path: 'users', element: <AdminUsersScreen /> },
        { path: 'roles', element: <AdminRolesScreen /> },
        { path: 'saccos', element: <AdminSaccosScreen /> },
        { path: 'authorities', element: <AdminAuthoritiesScreen /> },
        { path: 'vehicles', element: <AdminVehiclesScreen /> },
        { path: 'trips', element: <AdminTripsScreen /> },
        { path: 'reports', element: <AdminReportsScreen /> },
        { path: 'moderation', element: <AdminModerationScreen /> },
        { path: 'feature-flags', element: <AdminFeatureFlagsScreen /> },
        { path: 'health', element: <AdminSystemHealthScreen /> },
        { path: 'system-health', element: <AdminSystemHealthScreen /> },
        { path: 'monitoring', element: <AdminMonitoringScreen /> },
        { path: 'audit-logs', element: <AdminAuditLogsScreen /> },
        { path: 'analytics', element: <AdminAnalyticsScreen /> },
        { path: 'notifications', element: <AdminNotificationsScreen /> },
        { path: 'integrations', element: <AdminIntegrationsScreen /> },
        { path: 'security', element: <AdminSecurityScreen /> },
        { path: 'maintenance', element: <AdminMaintenanceScreen /> },
        { path: 'settings', element: <AdminSettingsScreen /> },
        { path: 'profile', element: <AdminSettingsScreen /> },
        { path: 'docs', element: <AdminSettingsScreen /> },
      ],
    }],
  },

  // Fallback 404
  { path: '*', errorElement: <RouteErrorElement />, element: withFullPageSuspense(<NotFound404Screen />) },
]);

export const AppRoutes: React.FC = () => (
  <ErrorBoundary>
    <RouterProvider router={router} />
  </ErrorBoundary>
);
