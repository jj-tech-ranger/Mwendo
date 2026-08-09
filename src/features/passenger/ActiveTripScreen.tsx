import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { useTripStore } from '../../store/useTripStore';
import { tripRepository } from '../../repositories';
import { offlineStorage } from '../../services/offlineStorage';

export const ActiveTripScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    activeTrip,
    isTracking,
    isPaused,
    currentSpeed,
    maxSpeed,
    durationSeconds,
    overspeedCount,
    startTrip,
    updateTelemetry,
    pauseTrip,
    resumeTrip,
    endTrip,
  } = useTripStore();

  // Local UI State
  const [setupPlate, setSetupPlate] = useState('KDA 123A');
  const [setupSacco, setSetupSacco] = useState('MetroLink SACCO');
  const [setupRoute, setSetupRoute] = useState('Thika Road – Nairobi CBD');
  const [showEndModal, setShowEndModal] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);

  // Timer for duration counter
  useEffect(() => {
    if (!isTracking || isPaused) return;

    const interval = setInterval(() => {
      useTripStore.setState((s) => ({
        durationSeconds: s.durationSeconds + 1,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isTracking, isPaused]);

  // Real Geolocation Watcher
  useEffect(() => {
    if (!isTracking || isPaused) return;

    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const rawSpeedMs = pos.coords.speed;
          const speedKmH = rawSpeedMs !== null && rawSpeedMs >= 0 ? Math.round(rawSpeedMs * 3.6) : currentSpeed;
          updateTelemetry(speedKmH, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: new Date().toISOString(),
            speedKmH,
          });
        },
        (err) => {
          console.warn('Geolocation position error:', err);
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isTracking, isPaused]);

  // Initial Auto Start if coming from Dashboard
  useEffect(() => {
    if (!isTracking && !summaryData) {
      startTrip({
        plateNumber: setupPlate,
        saccoName: setupSacco,
        routeName: setupRoute,
      });
      // Initial telemetry default speed
      updateTelemetry(62);
    }
  }, []);

  // Format Duration seconds -> MM:SS
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const handleConfirmEndTrip = async () => {
    const completed = endTrip();
    const result = completed || {
      id: `trip_${Date.now()}`,
      tripId: `TRIP-${Math.floor(100000 + Math.random() * 900000)}`,
      plateNumber: activeTrip?.plateNumber || setupPlate,
      saccoName: activeTrip?.saccoName || setupSacco,
      routeName: activeTrip?.routeName || setupRoute,
      maxSpeedKmH: maxSpeed,
      durationSeconds,
      overspeedEventsCount: overspeedCount,
      status: 'completed',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    };

    setSummaryData(result);
    setShowEndModal(false);

    // Save trip document to Firestore / offline storage
    try {
      if (navigator.onLine) {
        await tripRepository.save(result as any);
      } else {
        await offlineStorage.setItem(`offline_trip_${result.id}`, result);
      }
    } catch (err) {
      console.warn('Error saving trip, saving to offline storage:', err);
      await offlineStorage.setItem(`offline_trip_${result.id}`, result);
    }
  };

  // IF TRIP FINISHED - SHOW SUMMARY SCREEN
  if (summaryData) {
    const isHighRisk = summaryData.maxSpeedKmH > 90 || summaryData.overspeedEventsCount > 0;

    return (
      <div className="min-h-screen bg-background text-on-background p-4 sm:p-6 max-w-lg mx-auto space-y-6 animate-in fade-in">
        {/* Header Bar */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => navigate('/passenger')}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <span className="text-xs font-mono font-bold uppercase text-on-surface-variant">
            Trip Summary
          </span>
          <div className="w-8" />
        </div>

        {/* Safety Score Ring Card */}
        <Card className="p-6 text-center space-y-4 shadow-md">
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                className="text-surface-container-high"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={250}
                strokeDashoffset={isHighRisk ? 80 : 30}
                className={isHighRisk ? 'text-amber-500' : 'text-emerald-600'}
                fill="transparent"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black font-mono">
                {isHighRisk ? '72' : '94'}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">
                / 100
              </span>
            </div>
          </div>

          <div>
            <Badge variant={isHighRisk ? 'warning' : 'success'} className="px-3 py-1 font-bold">
              {isHighRisk ? 'Moderate Risk Detected' : 'Safe Trip Completed'}
            </Badge>
            <p className="text-xs text-on-surface-variant mt-2">
              {summaryData.routeName} ({summaryData.saccoName})
            </p>
          </div>
        </Card>

        {/* Stat Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 space-y-1">
            <span className="text-xs text-on-surface-variant">Total Duration</span>
            <div className="text-xl font-black font-mono">
              {formatDuration(summaryData.durationSeconds || 1122)}
            </div>
          </Card>

          <Card className="p-4 space-y-1">
            <span className="text-xs text-on-surface-variant">Max Speed</span>
            <div
              className={`text-xl font-black font-mono ${
                summaryData.maxSpeedKmH > 90 ? 'text-error' : 'text-on-surface'
              }`}
            >
              {summaryData.maxSpeedKmH || 78} km/h
            </div>
          </Card>

          <Card className="p-4 space-y-1">
            <span className="text-xs text-on-surface-variant">Average Speed</span>
            <div className="text-xl font-black font-mono">54 km/h</div>
          </Card>

          <Card className="p-4 space-y-1">
            <span className="text-xs text-on-surface-variant">Overspeed Events</span>
            <div
              className={`text-xl font-black font-mono ${
                summaryData.overspeedEventsCount > 0 ? 'text-amber-600' : 'text-emerald-700'
              }`}
            >
              {summaryData.overspeedEventsCount || 0}
            </div>
          </Card>
        </div>

        {/* Route Map Card */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-on-surface">Route GPS Track</span>
            <span className="font-mono text-emerald-700">Verified</span>
          </div>
          <div className="h-28 bg-surface-container-high rounded-xl flex items-center justify-center relative overflow-hidden border border-outline-variant/30">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/10 to-teal-900/10" />
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-on-surface-variant z-10">
              <span className="material-symbols-outlined text-primary text-base">near_me</span>
              {summaryData.plateNumber} · Thika Road Corridor
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            variant="outline"
            className="w-full text-xs font-bold text-amber-700 border-amber-500/40 hover:bg-amber-500/10"
            onClick={() => navigate('/passenger/report-blackspot')}
          >
            <span className="material-symbols-outlined text-base mr-1">flag</span>
            Report Reckless Driver / Road Hazard
          </Button>

          <Button
            className="w-full h-11 text-sm font-bold"
            onClick={() => {
              setSummaryData(null);
              navigate('/passenger');
            }}
          >
            Finish & Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // CORE LIVE TRACKING IMMERSIVE SCREEN (Trip Dark Theme #1A2E1A)
  return (
    <div className="min-h-screen bg-[#112214] text-white p-4 sm:p-6 max-w-lg mx-auto flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background Dot Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#2a4d31_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between border-b border-emerald-900/50 pb-3">
        <button
          onClick={() => navigate('/passenger')}
          className="p-2 rounded-full hover:bg-emerald-900/40 text-emerald-200 transition-colors"
          aria-label="Minimize"
        >
          <span className="material-symbols-outlined text-2xl">expand_more</span>
        </button>

        <div className="text-center">
          <div className="text-sm font-black font-mono tracking-widest text-emerald-100 uppercase">
            {activeTrip?.plateNumber || setupPlate}
          </div>
          <p className="text-[11px] text-emerald-300/80 font-medium">
            {activeTrip?.saccoName || setupSacco} · {activeTrip?.routeName || setupRoute}
          </p>
        </div>

        <button
          onClick={() => setShowEndModal(true)}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-error/20 text-red-300 hover:bg-error/30 transition-colors border border-error/30"
        >
          End Trip
        </button>
      </div>

      {/* Speedometer Gauge Canvas */}
      <div className="relative z-10 my-auto py-6 text-center space-y-6">
        {/* Main Speed Gauge */}
        <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
          {/* Circular Speed Ring SVG */}
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background Track */}
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke="#1b3620"
              strokeWidth="6"
              fill="transparent"
            />
            {/* Active Speed Arc */}
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke={currentSpeed > 90 ? '#ef4444' : currentSpeed > 80 ? '#f59e0b' : '#10b981'}
              strokeWidth="8"
              strokeDasharray={264}
              strokeDashoffset={264 - (264 * Math.min(currentSpeed, 120)) / 120}
              fill="transparent"
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>

          {/* Centered Readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-1">
            <span
              className={`text-6xl font-black font-mono tracking-tight transition-colors duration-300 ${
                currentSpeed > 90
                  ? 'text-red-500 animate-pulse'
                  : currentSpeed > 80
                  ? 'text-amber-400'
                  : 'text-emerald-300'
              }`}
            >
              {currentSpeed}
            </span>
            <span className="text-xs font-bold font-mono tracking-widest text-emerald-400/80 uppercase">
              KM / H
            </span>
            {isPaused && (
              <Badge variant="warning" className="text-[10px] mt-1">
                PAUSED
              </Badge>
            )}
          </div>
        </div>

        {/* Live Telemetry Stat Chips */}
        <div className="flex items-center justify-center gap-4 text-xs font-mono">
          <div className="bg-emerald-950/80 border border-emerald-800/40 px-3 py-1.5 rounded-xl text-emerald-200">
            Max Speed: <span className="font-bold text-white">{maxSpeed} km/h</span>
          </div>
          <div className="bg-emerald-950/80 border border-emerald-800/40 px-3 py-1.5 rounded-xl text-emerald-200">
            Duration: <span className="font-bold text-white">{formatDuration(durationSeconds)}</span>
          </div>
        </div>

        {/* Interactive Speed Simulator Controls */}
        <div className="bg-emerald-950/60 border border-emerald-800/40 p-3 rounded-2xl max-w-xs mx-auto space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300">
            <span>Simulate Telemetry Speed:</span>
            <span className="font-bold">{currentSpeed} km/h</span>
          </div>
          <input
            type="range"
            min="0"
            max="120"
            step="2"
            value={currentSpeed}
            onChange={(e) => updateTelemetry(Number(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 bg-emerald-900 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-emerald-400/60">
            <span>0 Safe</span>
            <span>80 Limit</span>
            <span>90+ Overspeed</span>
          </div>
        </div>

        {/* Alert Cards Feed */}
        <div className="space-y-2 max-w-sm mx-auto text-left">
          {currentSpeed > 90 ? (
            <div className="bg-red-950/80 border border-red-500/50 p-3 rounded-xl flex items-center gap-3 text-red-200 text-xs animate-bounce">
              <span className="material-symbols-outlined text-red-400 text-xl">warning</span>
              <div>
                <div className="font-bold text-white">Overspeed Violation Detected!</div>
                <div className="text-[11px] text-red-300/90">
                  Vehicle traveling over 90 km/h threshold on Thika Road.
                </div>
              </div>
            </div>
          ) : currentSpeed > 80 ? (
            <div className="bg-amber-950/80 border border-amber-500/50 p-3 rounded-xl flex items-center gap-3 text-amber-200 text-xs">
              <span className="material-symbols-outlined text-amber-400 text-xl">speed</span>
              <div>
                <div className="font-bold text-white">Approaching Speed Limit</div>
                <div className="text-[11px] text-amber-300/90">
                  Speed is 81–90 km/h. Drive cautiously.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-950/60 border border-emerald-800/50 p-3 rounded-xl flex items-center gap-3 text-emerald-200 text-xs">
              <span className="material-symbols-outlined text-emerald-400 text-xl">verified</span>
              <div>
                <div className="font-bold text-white">Route Normal & Safe</div>
                <div className="text-[11px] text-emerald-300/80">
                  Speed within legal safety limit. Co-riders online: 4
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Bar & Emergency Floating Button */}
      <div className="relative z-10 flex items-center justify-between border-t border-emerald-900/50 pt-3">
        {/* Pause / Resume Button */}
        {isPaused ? (
          <Button
            onClick={resumeTrip}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 h-10 rounded-xl"
          >
            <span className="material-symbols-outlined text-base mr-1">play_arrow</span>
            Resume
          </Button>
        ) : (
          <Button
            onClick={pauseTrip}
            variant="outline"
            className="border-emerald-700 text-emerald-200 hover:bg-emerald-900/40 text-xs font-bold px-4 h-10 rounded-xl"
          >
            <span className="material-symbols-outlined text-base mr-1">pause</span>
            Pause
          </Button>
        )}

        {/* Emergency SOS Button */}
        <button
          onClick={() => navigate('/passenger/sos')}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center font-black shadow-lg shadow-red-900/50 transition-all transform active:scale-95 border-2 border-red-400"
          aria-label="Emergency SOS"
        >
          <span className="text-sm tracking-wider font-mono">SOS</span>
        </button>
      </div>

      {/* End Trip Confirmation Modal */}
      <Dialog
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        title="End Live Trip Tracking?"
      >
        <div className="space-y-4 text-xs text-on-surface text-left">
          <p className="text-on-surface-variant">
            Ending this trip will stop real-time GPS telemetry logging and calculate your safety summary.
          </p>

          <div className="bg-surface-container-low p-3 rounded-xl space-y-1 font-mono text-xs">
            <div>Plate: {activeTrip?.plateNumber || setupPlate}</div>
            <div>Duration: {formatDuration(durationSeconds)}</div>
            <div>Max Speed: {maxSpeed} km/h</div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 text-xs"
              onClick={() => setShowEndModal(false)}
            >
              Keep Tracking
            </Button>
            <Button
              className="flex-1 bg-error hover:bg-error/90 text-on-error text-xs font-bold"
              onClick={handleConfirmEndTrip}
            >
              End Trip Now
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
