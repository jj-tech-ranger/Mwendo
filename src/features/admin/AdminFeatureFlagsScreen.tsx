import React, { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { auditLogRepository } from '../../repositories';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../components/ui/Toast';

export const AdminFeatureFlagsScreen: React.FC = () => {
  const { showToast } = useToast();
  const { user: currentAdmin } = useAuthStore();

  // Side A: Client Feature Flags
  const [flags, setFlags] = useState({
    enableSOS: true,
    enableGuestMode: true,
    maintenance_mode: false,
    overspeedLimitDisplayed: true,
    overspeedRolloutPct: 100,
  });

  // Side B: System Config (system_config/ panel per architecture §14)
  const [systemConfig, setSystemConfig] = useState({
    riskWeightsJson: JSON.stringify(
      { speeding: 0.4, blackspotProximity: 0.3, harshBraking: 0.3 },
      null,
      2
    ),
    geofenceRadiusMeters: 500,
    decayFactorHalfLifeDays: 30,
    telemetryRetentionDays: 90,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  async function handleSaveFeatureFlags() {
    setIsSubmitting(true);
    try {
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: 'REMOTE_CONFIG',
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: 'UPDATE_FEATURE_FLAGS',
        target: `Flags: ${JSON.stringify(flags)}`,
        timestamp: new Date().toISOString(),
      });

      setToastMsg('Feature Flags successfully deployed to Remote Config.');
    } catch (err) {
      console.error('Failed to save feature flags:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveSystemConfig() {
    setIsSubmitting(true);
    try {
      // Validate JSON
      JSON.parse(systemConfig.riskWeightsJson);

      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: 'SYSTEM_CONFIG',
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: 'UPDATE_SYSTEM_CONFIG_PANEL',
        target: `geofence: ${systemConfig.geofenceRadiusMeters}m, retention: ${systemConfig.telemetryRetentionDays}d`,
        timestamp: new Date().toISOString(),
      });

      setToastMsg('system_config/ Backend Panel parameters updated.');
    } catch (err) {
      showToast('error', 'Configuration Error', 'Invalid JSON structure in Risk Weights configuration.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Feature Flags & System Configuration Panel
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Structurally separated client-side switches and backend algorithmic parameter stores (Architecture §14).
          </p>
        </div>

        <Badge variant="info">Live Config Active</Badge>
      </div>

      {toastMsg && (
        <div className="p-md rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-body-sm text-xs flex items-center justify-between">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-outline">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Grid containing Side A (Client Feature Flags) and Side B (System Config Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Panel A: Client Feature Flags */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg shadow-sm space-y-md">
          <div className="border-b border-outline-variant/20 pb-sm">
            <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">toggle_on</span>
              Client Feature Flags (Remote Config)
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Toggles controlling UI visibility and mobile app feature availability.
            </p>
          </div>

          <div className="space-y-md text-xs font-body-sm">
            {/* Toggle 1: enableSOS */}
            <div className="flex items-center justify-between p-md rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div>
                <p className="font-bold text-on-surface">enableSOS</p>
                <p className="text-[11px] text-on-surface-variant">
                  Activates Emergency Panic Button on Passenger & Commuter views.
                </p>
              </div>
              <input
                type="checkbox"
                checked={flags.enableSOS}
                onChange={(e) => setFlags({ ...flags, enableSOS: e.target.checked })}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>

            {/* Toggle 2: enableGuestMode */}
            <div className="flex items-center justify-between p-md rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div>
                <p className="font-bold text-on-surface">enableGuestMode</p>
                <p className="text-[11px] text-on-surface-variant">
                  Allows unauthenticated users to view the public hazard safety map.
                </p>
              </div>
              <input
                type="checkbox"
                checked={flags.enableGuestMode}
                onChange={(e) => setFlags({ ...flags, enableGuestMode: e.target.checked })}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>

            {/* Toggle 3: maintenance_mode */}
            <div className="flex items-center justify-between p-md rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div>
                <p className="font-bold text-rose-600">maintenance_mode</p>
                <p className="text-[11px] text-on-surface-variant">
                  Global flag triggering the Phase 1 Maintenance Layout.
                </p>
              </div>
              <input
                type="checkbox"
                checked={flags.maintenance_mode}
                onChange={(e) => setFlags({ ...flags, maintenance_mode: e.target.checked })}
                className="w-5 h-5 accent-rose-600 cursor-pointer"
              />
            </div>

            {/* Toggle 4: overspeedLimitDisplayed with Rollout % Slider */}
            <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-on-surface">overspeedLimitDisplayed</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Gradual percentage rollout of live speed limits on passenger HUD.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={flags.overspeedLimitDisplayed}
                  onChange={(e) => setFlags({ ...flags, overspeedLimitDisplayed: e.target.checked })}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </div>

              {flags.overspeedLimitDisplayed && (
                <div className="pt-2 border-t border-outline-variant/20">
                  <div className="flex justify-between font-label-mono text-[10px] text-on-surface mb-1">
                    <span>Gradual Rollout Percentage</span>
                    <span className="font-bold text-primary">{flags.overspeedRolloutPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={flags.overspeedRolloutPct}
                    onChange={(e) => setFlags({ ...flags, overspeedRolloutPct: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>
              )}
            </div>

            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={handleSaveFeatureFlags}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving Flags...' : 'Deploy Remote Config Flags'}
            </Button>
          </div>
        </div>

        {/* Panel B: System Config (system_config/) */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg shadow-sm space-y-md">
          <div className="border-b border-outline-variant/20 pb-sm">
            <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">settings_input_component</span>
              System Config (<code className="font-label-mono text-primary">system_config/</code> Panel)
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Backend algorithmic parameters, telemetry retention schedules, and risk weights.
            </p>
          </div>

          <div className="space-y-md text-xs font-body-sm">
            {/* Risk Weights JSON */}
            <div>
              <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                Risk Weights Algorithmic JSON (<code className="font-label-mono">riskWeights</code>)
              </label>
              <textarea
                rows={4}
                value={systemConfig.riskWeightsJson}
                onChange={(e) => setSystemConfig({ ...systemConfig, riskWeightsJson: e.target.value })}
                className="w-full bg-[#121212] text-emerald-400 font-label-mono text-[11px] border border-outline-variant/30 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-primary mt-1"
              />
            </div>

            {/* Geofence Radius */}
            <div>
              <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                Blackspot Geofence Warning Radius (Meters)
              </label>
              <input
                type="number"
                value={systemConfig.geofenceRadiusMeters}
                onChange={(e) => setSystemConfig({ ...systemConfig, geofenceRadiusMeters: Number(e.target.value) })}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-label-mono mt-1"
              />
            </div>

            {/* Decay Factor & Retention */}
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                  Decay Half-Life (Days)
                </label>
                <input
                  type="number"
                  value={systemConfig.decayFactorHalfLifeDays}
                  onChange={(e) => setSystemConfig({ ...systemConfig, decayFactorHalfLifeDays: Number(e.target.value) })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-label-mono mt-1"
                />
              </div>

              <div>
                <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                  Telemetry Retention (Days)
                </label>
                <input
                  type="number"
                  value={systemConfig.telemetryRetentionDays}
                  onChange={(e) => setSystemConfig({ ...systemConfig, telemetryRetentionDays: Number(e.target.value) })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-label-mono mt-1"
                />
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={handleSaveSystemConfig}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating Parameters...' : 'Save system_config/ Parameters'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
