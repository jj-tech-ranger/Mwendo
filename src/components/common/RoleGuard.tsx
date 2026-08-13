import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { UserRole } from '../../types';

interface RoleGuardProps {
  allowedRoles?: UserRole[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles }) => {
  const { user, claims, isAuthenticated, isLoading } = useAuthStore();
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

  // Preserve suspension check (both user.isActive and ID token isSuspended custom claim)
  if (user.isActive === false || user.claimedIsSuspended === true || claims?.isSuspended === true) {
    return <Navigate to="/auth/suspended" replace />;
  }

  // AUTH-004 Hardening Complete (formerly SEC-009): Route-level authorization strictly evaluates
  // the custom claim from the ID token (claimedActiveRole / claims.activeRole), matching firestore.rules
  // and Cloud Function security boundaries. Firestore document fields (user.role / user.activeRole)
  // are retained strictly for UI display purposes and are never trusted for authorization checks.
  const effectiveRole =
    user.claimedActiveRole ??
    (claims?.activeRole as UserRole | undefined) ??
    (user.claims?.activeRole as UserRole | undefined) ??
    user.role;

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
