import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { SosButton } from '../../components/ui/SosButton';
import { useTripStore } from '../../store/useTripStore';
import { tripRepository } from '../../repositories';
import { offlineStorage } from '../../services/offlineStorage';
import { offlineSyncService } from '../../services/offlineSyncService';
import { storageService } from '../../services/storageService';
import { telemetryPersistenceService } from '../../services/telemetryPersistenceService';
import { useAuthStore } from '../../store/useAuthStore';
import { SpeedSmoother, detectOverspeedViolations, GPSSample } from '../../lib/engine';
import { remoteConfigService } from '../../services/remoteConfigService';
import { Trip } from '../../types';

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
        startTrip({ plateNumber: setupPlate, saccoName: setupSacco, routeName: setupRoute });
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
    const result: Trip = completed ? {
      ...completed,
      userId: completed.userId || userId,
      overspeedEventsCount: calculatedOverspeedCount,
      violationsCount: calculatedOverspeedCount,
    } : {
      id: `trip_${Date.now()}`,
      tripId: `TRIP-${Math.floor(100000 + Math.random() * 900000)}`,
      userId,
      vehicleRegNumber: activeTrip?.plateNumber || setupPlate,
      plateNumber: activeTrip?.plateNumber || setupPlate,
      saccoId: activeTrip?.saccoId || 'unassigned',
      saccoName: activeTrip?.saccoName || setupSacco || 'Independent / Unassigned',
      routeName: activeTrip?.routeName || setupRoute,
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
      if (navigator.onLine) await tripRepository.save(result);
      else {
        await offlineStorage.setItem(`offline_trip_${result.id}`, result);
        await offlineSyncService.updatePendingCount();
      }
      saveSucceeded = true;
    } catch (err) {
      console.warn('Error saving trip, saving to offline storage:', err);
      await offlineStorage.setItem(`offline_trip_${result.id}`, result);
      await offlineSyncService.updatePendingCount();
      saveSucceeded = true;
    }
    if (saveSucceeded) {
      if (activeTripId) await telemetryPersistenceService.clear(activeTripId);
      clearActiveTripPersistence();
    }
  };

  if (summaryData) {
    const isIncompleteSignalLost = summaryData.status === 'incomplete_signal_lost';
    const isHighRisk = !isIncompleteSignalLost && (summaryData.maxSpeedKmH > 90 || (summaryData.overspeedEventsCount ?? 0) > 0);
    const summaryScore = isIncompleteSignalLost ? '—' : isHighRisk ? '72' : '94';
    const summaryBadgeVariant = isIncompleteSignalLost ? 'warning' : isHighRisk ? 'warning' : 'success';
    const summaryBadgeText = isIncompleteSignalLost ? 'Trip Incomplete — GPS Signal Lost' : isHighRisk ? 'Moderate Risk Detected' : 'Safe Trip Completed';
    const summaryDescription = isIncompleteSignalLost ? `GPS signal was unavailable for ${GPS_RECOVERY_TIMEOUT_SECONDS} seconds. The trip was stopped and marked incomplete so the recorded data is not presented as a fully verified trip.` : `${summaryData.routeName} (${summaryData.saccoName})`;
    return (
      <div className="min-h-screen bg-background text-on-background p-4 sm:p-6 max-w-lg mx-auto space-y-6 animate-in fade-in">
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => navigate('/passenger')} className="p-2 rounded-full hover:bg-surface-container-high transition-colors"><span className="material-symbols-outlined text-2xl">close</span></button>
          <span className="text-xs font-mono font-bold uppercase text-on-surface-variant">Trip Summary</span><div className="w-8" />
        </div>
        <Card className={`p-6 text-center space-y-4 shadow-md ${isIncompleteSignalLost ? 'border border-amber-500/40' : ''}`}>
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center"><svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" className="text-surface-container-high" fill="transparent" /><circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" strokeDasharray={250} strokeDashoffset={isIncompleteSignalLost ? 250 : isHighRisk ? 80 : 30} className={isIncompleteSignalLost ? 'text-amber-500' : isHighRisk ? 'text-amber-500' : 'text-emerald-600'} fill="transparent" strokeLinecap="round" /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-black font-mono">{summaryScore}</span><span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">{isIncompleteSignalLost ? 'N/A' : '/ 100'}</span></div></div>
          <div><Badge variant={summaryBadgeVariant} className="px-3 py-1 font-bold">{summaryBadgeText}</Badge><p className="text-xs text-on-surface-variant mt-2">{summaryDescription}</p></div>
        </Card>
        {isIncompleteSignalLost && <Card className="p-4 border border-amber-500/40 bg-amber-500/5"><div className="flex items-start gap-3 text-xs"><span className="material-symbols-outlined text-amber-600 text-xl">location_off</span><div><div className="font-bold text-on-surface">Why was this trip marked incomplete?</div><p className="text-on-surface-variant mt-1">Mwendo could not receive a valid GPS position within the recovery window. The available telemetry was retained, but the trip is not treated as a fully verified completed journey.</p></div></div></Card>}
        <div className="grid grid-cols-2 gap-3"><Card className="p-4 space-y-1"><span className="text-xs text-on-surface-variant">Total Duration</span><div className="text-xl font-black font-mono">{formatDuration(summaryData.durationSeconds || 0)}</div></Card><Card className="p-4 space-y-1"><span className="text-xs text-on-surface-variant">Max Speed</span><div className={`text-xl font-black font-mono ${summaryData.maxSpeedKmH > 90 ? 'text-error' : 'text-on-surface'}`}>{summaryData.maxSpeedKmH || 0} km/h</div></Card><Card className="p-4 space-y-1"><span className="text-xs text-on-surface-variant">Average Speed</span><div className="text-xl font-black font-mono">{summaryData.avgSpeedKmH || 0} km/h</div></Card><Card className="p-4 space-y-1"><span className="text-xs text-on-surface-variant">Overspeed Events</span><div className={`text-xl font-black font-mono ${(summaryData.overspeedEventsCount ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>{summaryData.overspeedEventsCount ?? 0}</div></Card></div>
        <Card className="p-4 space-y-3"><div className="flex items-center justify-between text-xs"><span className="font-bold text-on-surface">Route GPS Track</span><span className={`font-mono ${isIncompleteSignalLost ? 'text-amber-700' : 'text-emerald-700'}`}>{isIncompleteSignalLost ? 'Incomplete' : 'Verified'}</span></div><div className="h-28 bg-surface-container-high rounded-xl flex items-center justify-center relative overflow-hidden border border-outline-variant/30"><div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/10 to-teal-900/10" /><div className="flex items-center gap-2 text-xs font-mono font-semibold text-on-surface-variant z-10"><span className="material-symbols-outlined text-primary text-base">near_me</span>{summaryData.plateNumber} · Thika Road Corridor</div></div></Card>
        <div className="space-y-2 pt-2"><Button variant="outline" className="w-full text-xs font-bold text-amber-700 border-amber-500/40 hover:bg-amber-500/10" onClick={() => navigate('/passenger/report-blackspot')}><span className="material-symbols-outlined text-base mr-1">flag</span>Report Reckless Driver / Road Hazard</Button><Button className="w-full h-11 text-sm font-bold" onClick={() => { setSummaryData(null); navigate('/passenger'); }}>Finish & Return to Dashboard</Button></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#112214] text-white p-4 sm:p-6 max-w-lg mx-auto flex flex-col justify-between relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-[radial-gradient(#2a4d31_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between border-b border-emerald-900/50 pb-3"><button onClick={() => navigate('/passenger')} className="p-2 rounded-full hover:bg-emerald-900/40 text-emerald-200 transition-colors" aria-label="Minimize"><span className="material-symbols-outlined text-2xl">expand_more</span></button><div className="text-center"><div className="text-sm font-black font-mono tracking-widest text-emerald-100 uppercase">{activeTrip?.plateNumber || setupPlate}</div><p className="text-[11px] text-emerald-300/80 font-medium">{activeTrip?.saccoName || setupSacco} · {activeTrip?.routeName || setupRoute}</p></div><button onClick={() => setShowEndModal(true)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-error/20 text-red-300 hover:bg-error/30 transition-colors border border-error/30">End Trip</button></div>
      {gpsSignalLost && <div className="relative z-20 mt-3 rounded-xl border border-amber-500/50 bg-amber-950/90 px-3 py-2 text-xs text-amber-100 shadow-lg"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-amber-400 text-base">location_off</span><div className="min-w-0 flex-1"><div className="font-bold text-white">GPS signal lost</div><div className="text-[11px] text-amber-200/90">Reconnecting… trip will be marked incomplete in {gpsRecoverySeconds}s if GPS does not return.</div></div><span className="font-mono font-black text-amber-300">{gpsRecoverySeconds}s</span></div></div>}
      <div className="relative z-10 my-auto py-6 text-center space-y-6"><div className="relative w-64 h-64 mx-auto flex items-center justify-center"><svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" stroke="#1b3620" strokeWidth="6" fill="transparent" /><circle cx="50" cy="50" r="42" stroke={currentSpeed > 90 ? '#ef4444' : currentSpeed > 80 ? '#f59e0b' : '#10b981'} strokeWidth="8" strokeDasharray={264} strokeDashoffset={264 - (264 * Math.min(currentSpeed, 120)) / 120} fill="transparent" strokeLinecap="round" className="transition-all duration-500 ease-out" /></svg><div className="absolute inset-0 flex flex-col items-center justify-center space-y-1"><span className={`text-6xl font-black font-mono tracking-tight transition-colors duration-300 ${currentSpeed > 90 ? 'text-red-500 animate-pulse' : currentSpeed > 80 ? 'text-amber-400' : 'text-emerald-300'}`}>{currentSpeed}</span><span className="text-xs font-bold font-mono tracking-widest text-emerald-400/80 uppercase">KM / H</span>{isPaused && <Badge variant="warning" className="text-[10px] mt-1">PAUSED</Badge>}</div></div>
        <div className="flex items-center justify-center gap-4 text-xs font-mono"><div className="bg-emerald-950/80 border border-emerald-800/40 px-3 py-1.5 rounded-xl text-emerald-200">Max Speed: <span className="font-bold text-white">{maxSpeed} km/h</span></div><div className="bg-emerald-950/80 border border-emerald-800/40 px-3 py-1.5 rounded-xl text-emerald-200">Duration: <span className="font-bold text-white">{formatDuration(durationSeconds)}</span></div></div>
        <div className="space-y-2 max-w-sm mx-auto text-left">{currentSpeed > 90 ? <div className="bg-red-950/80 border border-red-500/50 p-3 rounded-xl flex items-center gap-3 text-red-200 text-xs animate-bounce"><span className="material-symbols-outlined text-red-400 text-xl">warning</span><div><div className="font-bold text-white">Overspeed Violation Detected!</div><div className="text-[11px] text-red-300/90">Vehicle traveling over 90 km/h threshold on Thika Road.</div></div></div> : currentSpeed > 80 ? <div className="bg-amber-950/80 border border-amber-500/50 p-3 rounded-xl flex items-center gap-3 text-amber-200 text-xs"><span className="material-symbols-outlined text-amber-400 text-xl">speed</span><div><div className="font-bold text-white">Approaching Speed Limit</div><div className="text-[11px] text-amber-300/90">Speed is 81–90 km/h. Drive cautiously.</div></div></div> : <div className="bg-emerald-950/60 border border-emerald-800/50 p-3 rounded-xl flex items-center gap-3 text-emerald-200 text-xs"><span className="material-symbols-outlined text-emerald-400 text-xl">verified</span><div><div className="font-bold text-white">Route Normal & Safe</div><div className="text-[11px] text-emerald-300/80">Speed within legal safety limit. Co-riders online: 4</div></div></div>}</div>
      </div>
      <div className="relative z-10 flex items-center justify-between border-t border-emerald-900/50 pt-3">{isPaused ? <Button onClick={resumeTrip} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 h-10 rounded-xl"><span className="material-symbols-outlined text-base mr-1">play_arrow</span>Resume</Button> : <Button onClick={pauseTrip} variant="outline" className="border-emerald-700 text-emerald-200 hover:bg-emerald-900/40 text-xs font-bold px-4 h-10 rounded-xl"><span className="material-symbols-outlined text-base mr-1">pause</span>Pause</Button>}<SosButton onClick={() => navigate('/passenger/sos')} variant="fab" /> </div>
      <Dialog isOpen={showEndModal} onClose={() => setShowEndModal(false)} title="End Live Trip Tracking?"><div className="space-y-4 text-xs text-on-surface text-left"><p className="text-on-surface-variant">Ending this trip will stop real-time GPS telemetry logging and calculate your safety summary.</p><div className="bg-surface-container-low p-3 rounded-xl space-y-1 font-mono text-xs"><div>Plate: {activeTrip?.plateNumber || setupPlate}</div><div>Duration: {formatDuration(durationSeconds)}</div><div>Max Speed: {maxSpeed} km/h</div></div><div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1 text-xs" onClick={() => setShowEndModal(false)}>Keep Tracking</Button><Button className="flex-1 bg-error hover:bg-error/90 text-on-error text-xs font-bold" onClick={() => { tripCompletionInProgressRef.current = true; void handleConfirmEndTrip(); }}>End Trip Now</Button></div></div></Dialog>
    </div>
  );
};
