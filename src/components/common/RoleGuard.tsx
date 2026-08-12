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

  const effectiveRole = user.activeRole || user.role;
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/auth/unauthorized" replace />;
  }

  return <Outlet />;
};
