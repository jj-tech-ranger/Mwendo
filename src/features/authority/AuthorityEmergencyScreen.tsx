import React, { useState, useEffect, useMemo } from 'react';
import { alertRepository, auditLogRepository } from '../../repositories';
import { SafetyAlert } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { MapComponent, MapMarker } from '../../components/map/MapComponent';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../components/ui/Toast';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const AuthorityEmergencyScreen: React.FC = () => {
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<SafetyAlert | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'alerts'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const fetchedAlerts = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as SafetyAlert[];
          setAlerts(fetchedAlerts);
        } else {
          setAlerts([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.warn('[AuthorityEmergencyScreen] onSnapshot error:', error);
        setAlerts([]);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter for emergency / SOS / critical alerts
  const emergencyAlerts = useMemo(() => {
    return alerts.filter(
      (a) => a.type === 'sos' || a.severity === 'critical' || a.severity === 'high'
    );
  }, [alerts]);

  // Map markers for active emergencies
  const mapMarkers: MapMarker[] = useMemo(() => {
    return emergencyAlerts.map((a, idx) => ({
      id: a.id || `sos-${idx}`,
      lat: a.latitude || -1.286389 + idx * 0.02,
      lng: a.longitude || 36.817223 + idx * 0.02,
      type: 'incident',
      title: `Emergency: ${a.vehicleRegNumber}`,
      subtitle: `${a.type.toUpperCase()} • ${a.message}`,
      severity: 'high',
    }));
  }, [emergencyAlerts]);

  // Dispatch Police or Patrol
  const handleDispatchAction = async (alertId: string, actionNote: string) => {
    try {
      await alertRepository.update(alertId, {
        acknowledgedByAuthority: true,
        status: 'resolved',
      });

      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: selectedAlert?.saccoId || 'NTSA',
        actorName: user?.displayName || 'Inspector',
        actorRole: 'NTSA Inspector',
        action: actionNote,
        target: `Emergency Alert ${alertId}`,
        timestamp: new Date().toISOString(),
      });

      setSuccessMsg(`Action executed: ${actionNote}`);
      setSelectedAlert(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to dispatch police:', err);
      showToast('error', 'Update Failed', 'Error updating emergency status.');
    }
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-600 text-2xl animate-pulse">
              e911_emergency
            </span>
            <h2 className="font-headline-lg-mobile text-lg text-on-surface">
              NTSA & National Police Emergency Dispatch
            </h2>
          </div>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Real-time SOS passenger alerts, crash telemetry triggers, and mobile highway patrol response
          </p>
        </div>

        <Badge variant="danger" className="py-1 px-3">
          LIVE EMERGENCY MONITORING
        </Badge>
      </div>

      {successMsg && (
        <div className="p-md rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-label-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">local_police</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Map View */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-lg-mobile text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">map</span>
              Live Emergency Geolocation Pins
            </h3>
            <span className="font-label-mono text-xs text-outline">
              {emergencyAlerts.length} Active Triggers
            </span>
          </div>

          <MapComponent
            markers={mapMarkers}
            centerAddress="National Highway Safety Radar"
            showHeatmapOverlay={true}
            className="h-[400px]"
          />
        </div>

        {/* Emergency Alert List */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md flex flex-col justify-between">
          <div>
            <h3 className="font-headline-lg-mobile text-sm text-on-surface border-b border-outline-variant/20 pb-sm mb-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 text-xl">campaign</span>
              Active Emergency Queue
            </h3>

            <div className="space-y-sm max-h-[360px] overflow-y-auto pr-1">
              {emergencyAlerts.length > 0 ? (
                emergencyAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-sm rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-label-mono text-xs font-bold text-on-surface">
                        {alert.vehicleRegNumber}
                      </span>
                      <Badge variant="danger">{alert.type.toUpperCase()}</Badge>
                    </div>
                    <p className="font-body-sm text-[11px] text-on-surface">
                      {alert.message}
                    </p>
                    <div className="flex items-center justify-between text-[10px] font-label-mono text-outline">
                      <span>Speed: {alert.speedKmH} km/h</span>
                      <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>

                    <Button
                      size="sm"
                      variant="primary"
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-2"
                      onClick={() => setSelectedAlert(alert)}
                    >
                      <span className="material-symbols-outlined text-base">local_police</span>
                      Dispatch Highway Patrol
                    </Button>
                  </div>
                ))
              ) : (
                <div className="p-md text-center border border-outline-variant/20 rounded-xl bg-surface-container-low text-on-surface-variant text-xs">
                  <span className="material-symbols-outlined text-2xl text-emerald-600 block mb-1">
                    check_circle
                  </span>
                  No active emergency or SOS triggers reported.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Response Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl max-w-lg w-full p-lg shadow-2xl space-y-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-2xl">local_police</span>
                <h3 className="font-headline-lg-mobile text-base text-on-surface">
                  Emergency Incident Response Command
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="bg-surface-container-low p-md rounded-xl space-y-2 text-xs font-body-sm">
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-on-surface-variant">Vehicle Plate:</span>
                <span className="font-bold text-on-surface">{selectedAlert.vehicleRegNumber}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-on-surface-variant">SACCO:</span>
                <span className="font-bold text-on-surface">{selectedAlert.saccoId}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-on-surface-variant">Recorded Speed:</span>
                <span className="font-bold text-rose-600 font-label-mono">{selectedAlert.speedKmH} km/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Alert Message:</span>
                <span className="text-on-surface">{selectedAlert.message}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-label-mono text-[11px] text-on-surface-variant uppercase">
                Select Dispatch Action:
              </p>

              <Button
                variant="primary"
                className="w-full justify-start gap-3 bg-rose-600 hover:bg-rose-700 text-white"
                onClick={() =>
                  handleDispatchAction(
                    selectedAlert.id,
                    `Dispatched Kenya Police Service Highway Unit to intercept vehicle ${selectedAlert.vehicleRegNumber}`
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">local_police</span>
                Dispatch Kenya Police Highway Unit
              </Button>

              <Button
                variant="secondary"
                className="w-full justify-start gap-3"
                onClick={() =>
                  handleDispatchAction(
                    selectedAlert.id,
                    `Dispatched NTSA Mobile Safety Inspection Patrol to ${selectedAlert.vehicleRegNumber}`
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">minor_crash</span>
                Dispatch NTSA Mobile Patrol
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() =>
                  handleDispatchAction(
                    selectedAlert.id,
                    `Resolved emergency alert for ${selectedAlert.vehicleRegNumber}`
                  )
                }
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Mark Incident Resolved
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
