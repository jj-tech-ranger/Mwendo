import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { SosButton } from '../../components/ui/SosButton';
import { useTripStore } from '../../store/useTripStore';
import { tripRepository } from '../../repositories';
import { offlineStorage } from '../../services/offlineStorage';
import { offlineSyncService } from '../../services/offlineSyncService';
import { storageService } from '../../services/storageService';
import { telemetryPersistenceService } from '../../services/telemetryPersistenceService';
import { functionsService } from '../../services/functionsService';
import { useAuthStore } from '../../store/useAuthStore';
import { SpeedSmoother, detectOverspeedViolations, GPSSample } from '../../lib/engine';
import { remoteConfigService } from '../../services/remoteConfigService';
import { shareTripService } from '../../services/shareTripService';
import { Trip } from '../../types';
import { normalizePlate } from '../../lib/plate';
import { TripSummaryScreen } from './TripSummaryScreen';

const GPS_RECOVERY_TIMEOUT_SECONDS = 75;

export const ActiveTripScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    activeTrip,
    isTracking,
    isPaused,
    currentSpeed,
    maxSpeed,
    durationSeconds,
    startTrip,
    updateTelemetry,
    pauseTrip,
    resumeTrip,
    endTrip,
    clearActiveTripPersistence,
  } = useTripStore();

  const [setupPlate, setSetupPlate] = useState('');
  const [setupSacco, setSetupSacco] = useState('');
  const [setupRoute, setSetupRoute] = useState('');
  const [showEndModal, setShowEndModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareQrDataUrl, setShareQrDataUrl] = useState('');
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [summaryData, setSummaryData] = useState<Trip | null>(null);
  const [gpsSignalLost, setGpsSignalLost] = useState(false);
  const [gpsRecoverySeconds, setGpsRecoverySeconds] = useState(GPS_RECOVERY_TIMEOUT_SECONDS);
  const [telemetryRestored, setTelemetryRestored] = useState(false);

  const speedSmootherRef = useRef<SpeedSmoother>(new SpeedSmoother(0.35, 30));
  const gpsSamplesBufferRef = useRef<GPSSample[]>([]);
  const gpsWatchdogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gpsWatchdogIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tripCompletionInProgressRef = useRef(false);

  const clearGpsWatchdog = () => {
    if (gpsWatchdogTimeoutRef.current) {
      clearTimeout(gpsWatchdogTimeoutRef.current);
      gpsWatchdogTimeoutRef.current = null;
    }
    if (gpsWatchdogIntervalRef.current) {
      clearInterval(gpsWatchdogIntervalRef.current);
      gpsWatchdogIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!isTracking || isPaused) return;
    const interval = setInterval(() => {
      useTripStore.setState((s) => ({ durationSeconds: s.durationSeconds + 1 }));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTracking, isPaused]);

  useEffect(() => {
    let cancelled = false;
    const tripId = activeTrip?.id;
    if (!tripId) {
      gpsSamplesBufferRef.current = [];
      setTelemetryRestored(true);
      return;
    }
    setTelemetryRestored(false);
    void telemetryPersistenceService.getSamples(tripId).then((samples) => {
      if (cancelled) return;
      gpsSamplesBufferRef.current = samples;
      setTelemetryRestored(true);
    }).catch((err) => {
      if (cancelled) return;
      console.warn('Unable to restore persisted telemetry:', err);
      setTelemetryRestored(true);
    });
    return () => { cancelled = true; };
  }, [activeTrip?.id]);

  useEffect(() => {
    if (!isTracking || isPaused) {
      clearGpsWatchdog();
      setGpsSignalLost(false);
      setGpsRecoverySeconds(GPS_RECOVERY_TIMEOUT_SECONDS);
      return;
    }
    if (!('geolocation' in navigator)) return;
    let disposed = false;
    const handleGpsRecovered = () => {
      if (disposed) return;
      clearGpsWatchdog();
      setGpsSignalLost(false);
      setGpsRecoverySeconds(GPS_RECOVERY_TIMEOUT_SECONDS);
    };
    const handleGpsLost = () => {
      if (disposed || tripCompletionInProgressRef.current) return;
      clearGpsWatchdog();
      setGpsSignalLost(true);
      setGpsRecoverySeconds(GPS_RECOVERY_TIMEOUT_SECONDS);
      const deadline = Date.now() + GPS_RECOVERY_TIMEOUT_SECONDS * 1000;
      gpsWatchdogIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setGpsRecoverySeconds(remaining);
        if (remaining <= 0 && gpsWatchdogIntervalRef.current) {
          clearInterval(gpsWatchdogIntervalRef.current);
          gpsWatchdogIntervalRef.current = null;
        }
      }, 1000);
      gpsWatchdogTimeoutRef.current = setTimeout(() => {
        if (disposed || tripCompletionInProgressRef.current) return;
        tripCompletionInProgressRef.current = true;
        void handleConfirmEndTrip('incomplete_signal_lost');
      }, GPS_RECOVERY_TIMEOUT_SECONDS * 1000);
    };
    const armGpsWatchdog = () => {
      clearGpsWatchdog();
      gpsWatchdogTimeoutRef.current = setTimeout(handleGpsLost, GPS_RECOVERY_TIMEOUT_SECONDS * 1000);
    };
    armGpsWatchdog();
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        handleGpsRecovered();
        const rawSpeedMs = pos.coords.speed;
        const rawSpeedKmH = rawSpeedMs !== null && rawSpeedMs >= 0 ? Math.round(rawSpeedMs * 3.6) : currentSpeed;
        const sample: GPSSample = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speedKmH: rawSpeedKmH,
          accuracy: pos.coords.accuracy,
          timestamp: new Date().toISOString(),
        };
        const { isValid, smoothedSpeedKmH } = speedSmootherRef.current.processSample(sample);
        if (isValid) {
          gpsSamplesBufferRef.current.push(sample);
          const tripId = useTripStore.getState().activeTrip?.id;
          if (tripId && telemetryRestored) {
            void telemetryPersistenceService.appendSample(tripId, sample).catch((err) => {
              console.warn('Unable to persist telemetry sample:', err);
            });
          }
          updateTelemetry(smoothedSpeedKmH, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: typeof sample.timestamp === 'string' ? sample.timestamp : new Date(sample.timestamp).toISOString(),
            speedKmH: smoothedSpeedKmH,
          });
        }
        armGpsWatchdog();
      },
      (err) => {
        if (disposed) return;
        console.warn('Geolocation position error:', err);
        handleGpsLost();
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
    return () => {
      disposed = true;
      clearGpsWatchdog();
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking, isPaused, telemetryRestored]);

  useEffect(() => {
    if (!isTracking && !summaryData) {
      speedSmootherRef.current.reset();
      gpsSamplesBufferRef.current = [];
      tripCompletionInProgressRef.current = false;
      setTelemetryRestored(false);
      if (setupPlate) {
        startTrip({
          plateNumber: normalizePlate(setupPlate),
          saccoName: setupSacco,
          routeName: setupRoute,
          isProvisional: true,
        });
      }
      updateTelemetry(0);
    }
  }, []);

  useEffect(() => () => clearGpsWatchdog(), []);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const handleConfirmEndTrip = async (status: Trip['status'] = 'completed') => {
    if (status === 'incomplete_signal_lost') clearGpsWatchdog();
    const routeCoords = useTripStore.getState().routeCoordinates;
    const currentUser = useAuthStore.getState().user;
    const activeTripId = useTripStore.getState().activeTrip?.id;
    const persistedSamples = activeTripId ? await telemetryPersistenceService.getSamples(activeTripId) : [];
    const samplesByTimestamp = new Map<string, GPSSample>();
    for (const sample of [...persistedSamples, ...gpsSamplesBufferRef.current]) samplesByTimestamp.set(String(sample.timestamp), sample);
    const authoritativeSamples = Array.from(samplesByTimestamp.values());
    gpsSamplesBufferRef.current = authoritativeSamples;
    const speedLimit = remoteConfigService.getFlag('overspeedLimitDisplayed') || 80;
    const detectedViolations = detectOverspeedViolations(authoritativeSamples, speedLimit);
    const calculatedOverspeedCount = detectedViolations.length;
    const completed = endTrip(status);
    const userId = currentUser?.uid || currentUser?.id;
    const cleanPlate = normalizePlate(activeTrip?.plateNumber || setupPlate || '');
    const result: Trip = completed ? {
      ...completed,
      userId: completed.userId || userId,
      vehicleRegNumber: normalizePlate(completed.vehicleRegNumber || cleanPlate),
      plateNumber: normalizePlate(completed.plateNumber || cleanPlate),
      isProvisional: completed.isProvisional ?? activeTrip?.isProvisional ?? true,
      overspeedEventsCount: calculatedOverspeedCount,
      violationsCount: calculatedOverspeedCount,
    } : {
      id: `trip_${Date.now()}`,
      tripId: `TRIP-${Math.floor(100000 + Math.random() * 900000)}`,
      userId,
      vehicleId: activeTrip?.vehicleId,
      vehicleRegNumber: cleanPlate,
      plateNumber: cleanPlate,
      saccoId: activeTrip?.saccoId || 'unassigned',
      saccoName: activeTrip?.saccoName || setupSacco || 'Independent / Unassigned',
      routeName: activeTrip?.routeName || setupRoute,
      isProvisional: activeTrip?.isProvisional ?? true,
      maxSpeedKmH: maxSpeed,
      currentSpeedKmH: 0,
      avgSpeedKmH: Math.round(maxSpeed * 0.7),
      durationSeconds,
      overspeedEventsCount: calculatedOverspeedCount,
      violationsCount: calculatedOverspeedCount,
      status,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    };
    const telemetrySamplesForUpload = routeCoords && routeCoords.length > 0 ? routeCoords : authoritativeSamples;
    if (telemetrySamplesForUpload.length > 0 && currentUser?.uid && navigator.onLine) {
      try {
        const path = await storageService.uploadTelemetryBlob({ tripId: result.id, samples: telemetrySamplesForUpload, count: telemetrySamplesForUpload.length }, currentUser.uid, result.id);
        result.telemetryStoragePath = path;
      } catch (err) {
        console.warn('Telemetry blob upload skipped or failed:', err);
      }
    }
    setSummaryData(result);
    setShowEndModal(false);
    let saveSucceeded = false;
    try {
      if (navigator.onLine) {
        await tripRepository.save(result);
        try {
          await functionsService.processTripCompletion({
            tripId: result.id,
            samples: authoritativeSamples,
            speedLimitKmH: speedLimit,
          });
        } catch (procErr) {
          console.warn('[ActiveTripScreen] Server-authoritative trip completion failed:', procErr);
        }
      } else {
        await offlineStorage.setItem(`offline_trip_${result.id}`, { ...result, retryCount: 0 });
        await offlineSyncService.updatePendingCount();
      }
      saveSucceeded = true;
    } catch (err) {
      console.warn('Error saving trip, saving to offline storage:', err);
      await offlineStorage.setItem(`offline_trip_${result.id}`, { ...result, retryCount: 0 });
      await offlineSyncService.updatePendingCount();
      saveSucceeded = true;
    }
    if (saveSucceeded) {
      if (activeTripId) await telemetryPersistenceService.clear(activeTripId);
      clearActiveTripPersistence();
    }
  };

  const handleOpenShare = async () => {
    setIsGeneratingShare(true);
    setShowShareModal(true);
    try {
      const activeTripId = activeTrip?.id || `trip_${Date.now()}`;
      const res = await shareTripService.createOrUpdateSharedTrip({
        id: activeTripId,
        vehicleRegNumber: activeTrip?.plateNumber || setupPlate,
        plateNumber: activeTrip?.plateNumber || setupPlate,
        saccoName: activeTrip?.saccoName || setupSacco || 'Super Metro SACCO',
        routeName: activeTrip?.routeName || setupRoute || 'Thika Road Corridor',
        status: isTracking ? 'active' : 'paused',
        currentSpeedKmH: currentSpeed,
        maxSpeedKmH: maxSpeed,
      });
      setShareUrl(res.shareUrl);
      setShareQrDataUrl(res.qrDataUrl);
    } catch (err) {
      console.warn('Error generating shared trip:', err);
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share && shareUrl) {
      try {
        await navigator.share({
          title: `Track my ride on ${activeTrip?.plateNumber || setupPlate || 'Matatu'}`,
          text: `Follow my live transit safety status on Mwendo Salama:`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or unsupported
      }
    } else {
      void handleCopyShareLink();
    }
  };

  if (summaryData) {
    return (
      <TripSummaryScreen
        trip={summaryData as unknown as Trip}
        onFinish={() => {
          setSummaryData(null);
          navigate('/passenger');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#112214] text-white p-4 sm:p-6 max-w-lg mx-auto flex flex-col justify-between relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-[radial-gradient(#2a4d31_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between border-b border-emerald-900/50 pb-3">
        <button onClick={() => navigate('/passenger')} className="p-2 rounded-full hover:bg-emerald-900/40 text-emerald-200 transition-colors" aria-label="Minimize">
          <span className="material-symbols-outlined text-2xl">expand_more</span>
        </button>
        <div className="text-center">
          <div className="text-sm font-black font-mono tracking-widest text-emerald-100 uppercase flex items-center justify-center gap-1.5">
            <span>{activeTrip?.plateNumber || normalizePlate(setupPlate)}</span>
            {activeTrip?.isProvisional && (
              <Badge variant="warning" className="text-[9px] uppercase font-mono tracking-normal py-0 px-1.5">
                Provisional
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-emerald-300/80 font-medium">
            {activeTrip?.saccoName || setupSacco} · {activeTrip?.routeName || setupRoute}
          </p>
        </div>
        <button onClick={() => setShowEndModal(true)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-error/20 text-red-300 hover:bg-error/30 transition-colors border border-error/30">
          End Trip
        </button>
      </div>
      {gpsSignalLost && <div className="relative z-20 mt-3 rounded-xl border border-amber-500/50 bg-amber-950/90 px-3 py-2 text-xs text-amber-100 shadow-lg"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-amber-400 text-base">location_off</span><div className="min-w-0 flex-1"><div className="font-bold text-white">GPS signal lost</div><div className="text-[11px] text-amber-200/90">Reconnecting… trip will be marked incomplete in {gpsRecoverySeconds}s if GPS does not return.</div></div><span className="font-mono font-black text-amber-300">{gpsRecoverySeconds}s</span></div></div>}
      <div className="relative z-10 my-auto py-6 text-center space-y-6"><div className="relative w-64 h-64 mx-auto flex items-center justify-center"><svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" stroke="#1b3620" strokeWidth="6" fill="transparent" /><circle cx="50" cy="50" r="42" stroke={currentSpeed > 90 ? '#ef4444' : currentSpeed > 80 ? '#f59e0b' : '#10b981'} strokeWidth="8" strokeDasharray={264} strokeDashoffset={264 - (264 * Math.min(currentSpeed, 120)) / 120} fill="transparent" strokeLinecap="round" className="transition-all duration-500 ease-out" /></svg><div className="absolute inset-0 flex flex-col items-center justify-center space-y-1"><span className={`text-6xl font-black font-mono tracking-tight transition-colors duration-300 ${currentSpeed > 90 ? 'text-red-500 animate-pulse' : currentSpeed > 80 ? 'text-amber-400' : 'text-emerald-300'}`}>{currentSpeed}</span><span className="text-xs font-bold font-mono tracking-widest text-emerald-400/80 uppercase">KM / H</span>{isPaused && <Badge variant="warning" className="text-[10px] mt-1">PAUSED</Badge>}</div></div>
        <div className="flex items-center justify-center gap-4 text-xs font-mono"><div className="bg-emerald-950/80 border border-emerald-800/40 px-3 py-1.5 rounded-xl text-emerald-200">Max Speed: <span className="font-bold text-white">{maxSpeed} km/h</span></div><div className="bg-emerald-950/80 border border-emerald-800/40 px-3 py-1.5 rounded-xl text-emerald-200">Duration: <span className="font-bold text-white">{formatDuration(durationSeconds)}</span></div></div>
        <div className="space-y-2 max-w-sm mx-auto text-left">{currentSpeed > 90 ? <div className="bg-red-950/80 border border-red-500/50 p-3 rounded-xl flex items-center gap-3 text-red-200 text-xs animate-bounce"><span className="material-symbols-outlined text-red-400 text-xl">warning</span><div><div className="font-bold text-white">Overspeed Violation Detected!</div><div className="text-[11px] text-red-300/90">Vehicle traveling over 90 km/h threshold on Thika Road.</div></div></div> : currentSpeed > 80 ? <div className="bg-amber-950/80 border border-amber-500/50 p-3 rounded-xl flex items-center gap-3 text-amber-200 text-xs"><span className="material-symbols-outlined text-amber-400 text-xl">speed</span><div><div className="font-bold text-white">Approaching Speed Limit</div><div className="text-[11px] text-amber-300/90">Speed is 81–90 km/h. Drive cautiously.</div></div></div> : <div className="bg-emerald-950/60 border border-emerald-800/50 p-3 rounded-xl flex items-center gap-3 text-emerald-200 text-xs"><span className="material-symbols-outlined text-emerald-400 text-xl">verified</span><div><div className="font-bold text-white">Route Normal & Safe</div><div className="text-[11px] text-emerald-300/80">Speed within legal safety limit. Co-riders online: 4</div></div></div>}</div>
      </div>
      <div className="relative z-10 flex items-center justify-between border-t border-emerald-900/50 pt-3">
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Button onClick={resumeTrip} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 h-10 rounded-xl">
              <span className="material-symbols-outlined text-base mr-1">play_arrow</span>Resume
            </Button>
          ) : (
            <Button onClick={pauseTrip} variant="outline" className="border-emerald-700 text-emerald-200 hover:bg-emerald-900/40 text-xs font-bold px-4 h-10 rounded-xl">
              <span className="material-symbols-outlined text-base mr-1">pause</span>Pause
            </Button>
          )}
          <Button
            onClick={handleOpenShare}
            variant="outline"
            className="border-emerald-700/80 bg-emerald-950/60 text-emerald-200 hover:bg-emerald-900/40 text-xs font-bold px-3 h-10 rounded-xl flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">share</span>
            <span>Share Trip</span>
          </Button>
        </div>
        <SosButton onClick={() => navigate('/passenger/sos')} variant="fab" />
      </div>

      {/* Share Trip Dialog */}
      <Dialog isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Live Trip Safety">
        <div className="space-y-4 text-xs text-on-surface text-center">
          <p className="text-on-surface-variant text-left">
            Anyone with this link or QR code can monitor this trip's live-updating safety status and speed compliance in real-time without logging in.
          </p>

          {isGeneratingShare ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="font-mono text-xs text-on-surface-variant">Generating secure expiring link...</span>
            </div>
          ) : (
            <>
              {shareQrDataUrl && (
                <div className="bg-white p-3 rounded-2xl inline-block shadow-sm border border-outline/10">
                  <img
                    src={shareQrDataUrl}
                    alt="Scan to track trip"
                    className="w-48 h-48 mx-auto"
                  />
                  <span className="text-[10px] text-gray-600 font-mono block mt-1">Scan with phone camera</span>
                </div>
              )}

              <div className="bg-surface-container p-2.5 rounded-xl flex items-center gap-2 text-left">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="bg-transparent text-[11px] font-mono flex-1 outline-none truncate text-on-surface"
                />
                <Button
                  size="sm"
                  onClick={handleCopyShareLink}
                  className="text-[11px] font-bold px-3 h-8"
                >
                  {copiedLink ? 'Copied!' : 'Copy'}
                </Button>
              </div>

              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-left text-[11px] text-emerald-800 dark:text-emerald-300">
                <div className="font-bold flex items-center gap-1 mb-0.5">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Privacy Protected
                </div>
                Full GPS breadcrumbs are kept private. Only live safety score, vehicle plate, and current status are visible. Link expires automatically in 12 hours.
              </div>

              <div className="flex gap-2 pt-1">
                {typeof navigator.share === 'function' && (
                  <Button
                    onClick={handleNativeShare}
                    className="flex-1 h-10 text-xs font-bold bg-primary text-on-primary"
                  >
                    <span className="material-symbols-outlined text-sm mr-1">send</span>
                    Share via WhatsApp / App
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowShareModal(false)}
                  className="flex-1 h-10 text-xs font-bold"
                >
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>

      <Dialog isOpen={showEndModal} onClose={() => setShowEndModal(false)} title="End Live Trip Tracking?"><div className="space-y-4 text-xs text-on-surface text-left"><p className="text-on-surface-variant">Ending this trip will stop real-time GPS telemetry logging and calculate your safety summary.</p><div className="bg-surface-container-low p-3 rounded-xl space-y-1 font-mono text-xs"><div>Plate: {activeTrip?.plateNumber || setupPlate}</div><div>Duration: {formatDuration(durationSeconds)}</div><div>Max Speed: {maxSpeed} km/h</div></div><div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1 text-xs" onClick={() => setShowEndModal(false)}>Keep Tracking</Button><Button className="flex-1 bg-error hover:bg-error/90 text-on-error text-xs font-bold" onClick={() => { tripCompletionInProgressRef.current = true; void handleConfirmEndTrip(); }}>End Trip Now</Button></div></div></Dialog>
    </div>
  );
};
