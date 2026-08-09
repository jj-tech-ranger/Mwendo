import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { UserRole } from '../../types';

interface RoleGuardProps {
  allowedRoles?: UserRole[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();

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

  // Guard mechanism prepared for Phase 3 auth wiring. Currently allows bypass if no user set yet for Phase 1/2 previewing
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/auth/unauthorized" replace />;
  }

  return <Outlet />;
};
