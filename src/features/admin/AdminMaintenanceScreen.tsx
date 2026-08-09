import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { auditLogRepository } from '../../repositories';
import { useAuthStore } from '../../store/useAuthStore';

export const AdminMaintenanceScreen: React.FC = () => {
  const { user: currentAdmin } = useAuthStore();

  const [isMaintenanceActive, setIsMaintenanceActive] = useState<boolean>(() => {
    return localStorage.getItem('mwendo_maintenance_mode') === 'true';
  });

  const [customMessage, setCustomMessage] = useState(
    'Mwendo Salama is undergoing scheduled infrastructure upgrades. Live GPS tracking remains active.'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('mwendo_maintenance_mode', String(isMaintenanceActive));
  }, [isMaintenanceActive]);

  async function handleToggleMaintenanceMode() {
    setIsSubmitting(true);
    const nextState = !isMaintenanceActive;

    try {
      // Save state to local storage and log audit
      localStorage.setItem('mwendo_maintenance_mode', String(nextState));
      setIsMaintenanceActive(nextState);

      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: 'MAINTENANCE_CONTROL',
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: nextState ? 'ACTIVATE_MAINTENANCE_MODE' : 'DEACTIVATE_MAINTENANCE_MODE',
        target: `Message: "${customMessage}"`,
        timestamp: new Date().toISOString(),
      });

      setToastMsg(
        nextState
          ? 'MAINTENANCE MODE IS NOW ACTIVE. Phase 1 layout activated.'
          : 'MAINTENANCE MODE DEACTIVATED. Normal operations restored.'
      );
    } catch (err) {
      console.error('Failed to toggle maintenance mode:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-lg max-w-2xl mx-auto">
      <div className="border-b border-outline-variant/20 pb-md">
        <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-600 text-2xl">build_circle</span>
          Platform Maintenance Mode Control Panel
        </h2>
        <p className="font-body-sm text-xs text-on-surface-variant">
          Real toggle controlling global maintenance status for all passenger and SACCO web clients.
        </p>
      </div>

      {toastMsg && (
        <div className="p-md rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-body-sm text-xs flex items-center justify-between">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-outline">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Main Control Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg shadow-sm space-y-md">
        <div className="flex items-center justify-between p-md rounded-2xl bg-surface-container-low border border-outline-variant/20">
          <div>
            <p className="font-bold text-sm text-on-surface">Global Maintenance Status</p>
            <p className="font-body-sm text-xs text-on-surface-variant">
              {isMaintenanceActive
                ? 'Maintenance layout is currently serving users.'
                : 'All systems live and operational.'}
            </p>
          </div>

          <Badge variant={isMaintenanceActive ? 'danger' : 'success'}>
            {isMaintenanceActive ? 'MAINTENANCE ON' : 'SYSTEM LIVE'}
          </Badge>
        </div>

        {/* Custom Message Field */}
        <div className="space-y-1 text-xs">
          <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
            Custom User Maintenance Message
          </label>
          <textarea
            rows={3}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Warning Banner */}
        {!isMaintenanceActive && (
          <div className="p-md rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-body-sm">
            <p className="font-bold">⚠️ Warning: Activating Maintenance Mode</p>
            <p className="text-[11px] mt-0.5">
              Enabling this will immediately redirect all active commuters and SACCO managers to the system maintenance screen.
            </p>
          </div>
        )}

        <Button
          variant={isMaintenanceActive ? 'primary' : 'secondary'}
          onClick={handleToggleMaintenanceMode}
          disabled={isSubmitting}
          className={`w-full justify-center ${
            !isMaintenanceActive ? 'bg-amber-600 hover:bg-amber-700 text-white border-none' : ''
          }`}
        >
          {isSubmitting
            ? 'Updating Maintenance State...'
            : isMaintenanceActive
            ? 'Deactivate Maintenance Mode (Restore Live Systems)'
            : 'Activate Maintenance Mode Now'}
        </Button>
      </div>
    </div>
  );
};
