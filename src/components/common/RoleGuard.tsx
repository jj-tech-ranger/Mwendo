import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { UserRole } from '../../types';

interface RoleGuardProps {
  allowedRoles?: UserRole[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-md">
          <span className="material-symbols-outlined text-primary text-4xl animate-spin">
            sync
          </span>
          <span className="font-label-mono text-xs text-on-surface-variant uppercase tracking-wider">
            Authenticating session...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (user.isActive === false) {
    return <Navigate to="/auth/suspended" replace />;
  }

  // SECURITY NOTICE (SEC-009): The effectiveRole check below relies on Firestore document attributes
  // (user.activeRole / user.role) stored in local state. This is currently client-trust-only and will be
  // hardened to evaluate request.auth.token.activeRole custom claims once BE-001 lands.
  const effectiveRole = user.activeRole || user.role;
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/auth/unauthorized" replace />;
  }

  // Mandatory MFA Enforcement (SEC-008): Admin and Authority accounts MUST have verified TOTP MFA
  if (effectiveRole === 'admin' || effectiveRole === 'authority') {
    if (!user.isMfaEnrolled) {
      return <Navigate to="/auth/mfa-enrollment" replace />;
    }
    if (user.isMfaVerified === false) {
      return <Navigate to="/auth/mfa-challenge" replace />;
    }
  }

  return <Outlet />;
};
