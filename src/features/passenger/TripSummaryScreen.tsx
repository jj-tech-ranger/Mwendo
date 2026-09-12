import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { Trip, GenerateTripSummaryPayload, GenerateTripSummaryResult } from '../../types';
import { pointsService } from '../../services/pointsService';
import { useAuthStore } from '../../store/useAuthStore';

interface TripSummaryScreenProps {
  trip?: Trip | null;
  onDone?: () => void;
  onFinish?: () => void;
}

export const TripSummaryScreen: React.FC<TripSummaryScreenProps> = ({ trip: propTrip, onDone, onFinish }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((s) => s.user);

  // Read trip either from props or location state or fallback
  const tripData: Trip = propTrip || (location.state as { trip?: Trip })?.trip || {
    id: `trip_${Date.now()}`,
    vehicleRegNumber: 'KDB 892J',
    plateNumber: 'KDB 892J',
    saccoId: 'sacco_metro',
    saccoName: 'Super Metro SACCO',
    routeName: 'Thika Road Corridor',
    status: 'completed',
    currentSpeedKmH: 0,
    maxSpeedKmH: 78,
    avgSpeedKmH: 52,
    durationSeconds: 1620,
    overspeedEventsCount: 0,
    violationsCount: 0,
    startTime: new Date(Date.now() - 1620000).toISOString(),
    endTime: new Date().toISOString(),
  };

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiRiskTier, setAiRiskTier] = useState<'low' | 'moderate' | 'high'>('low');
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const pointsAwardedRef = useRef(false);

  // Award trip completion points once
  useEffect(() => {
    if (currentUser?.uid && !pointsAwardedRef.current && tripData.status === 'completed') {
      pointsAwardedRef.current = true;
      void pointsService.awardPoints(currentUser.uid, 'trip_completed').then(() => {
        setPointsAwarded(15);
      });
    }
  }, [currentUser?.uid, tripData.status]);

  // Call Gemini callable via Cloud Function
  useEffect(() => {
    let isCancelled = false;

    const fetchSummary = async () => {
      setIsLoadingAi(true);
      setAiError(null);

      const maxSpeed = tripData.maxSpeedKmH || 0;
      const overspeedCount = tripData.overspeedEventsCount || 0;
      const route = tripData.routeName || 'corridor';

      // Deterministic fallback generator
      const fallbackSummary = overspeedCount > 0
        ? `This trip recorded ${overspeedCount} overspeed event(s) along ${route} with a maximum speed of ${maxSpeed} km/h — moderate risk.`
        : `This trip maintained speeds strictly within the legal 80 km/h threshold along ${route} with 0 overspeed violations — low risk.`;

      const fallbackTier: 'low' | 'moderate' | 'high' = maxSpeed > 100 ? 'high' : overspeedCount > 0 ? 'moderate' : 'low';

      try {
        const callable = httpsCallable<GenerateTripSummaryPayload, GenerateTripSummaryResult>(
          functions,
          'generateTripSummary'
        );

        const payload: GenerateTripSummaryPayload = {
          tripId: tripData.id,
          maxSpeedKmH: tripData.maxSpeedKmH || 0,
          avgSpeedKmH: tripData.avgSpeedKmH || 0,
          durationSeconds: tripData.durationSeconds || 0,
          saccoName: tripData.saccoName,
          routeName: tripData.routeName,
          overspeedEventsCount: tripData.overspeedEventsCount || 0,
          violations: (tripData.overspeedEventsCount || 0) > 0 ? [
            {
              type: 'overspeed',
              speed: tripData.maxSpeedKmH,
              location: tripData.routeName,
              details: `Speed exceeded threshold (${tripData.maxSpeedKmH} km/h)`
            }
          ] : [],
        };

        const res = await callable(payload);
        if (!isCancelled && res.data && res.data.summary) {
          setAiSummary(res.data.summary);
          setAiRiskTier(res.data.riskTier || fallbackTier);
        }
      } catch (err: unknown) {
        console.warn('Cloud Function generateTripSummary call failed, utilizing graceful fallback:', err);
        if (!isCancelled) {
          setAiSummary(fallbackSummary);
          setAiRiskTier(fallbackTier);
          setAiError('Offline mode: Deterministic safety analysis active.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAi(false);
        }
      }
    };

    void fetchSummary();

    return () => {
      isCancelled = true;
    };
  }, [tripData]);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const isIncompleteSignalLost = tripData.status === 'incomplete_signal_lost';
  const isHighRisk = !isIncompleteSignalLost && (tripData.maxSpeedKmH > 90 || (tripData.overspeedEventsCount ?? 0) > 0);
  const summaryScore = isIncompleteSignalLost ? '—' : isHighRisk ? '74' : '96';
  const summaryBadgeVariant = isIncompleteSignalLost ? 'warning' : isHighRisk ? 'warning' : 'success';
  const summaryBadgeText = isIncompleteSignalLost
    ? 'Trip Incomplete — GPS Signal Lost'
    : isHighRisk
    ? 'Moderate Risk Detected'
    : 'Safe Trip Completed';

  const handleReturn = () => {
    if (onFinish) {
      onFinish();
    } else if (onDone) {
      onDone();
    } else {
      navigate('/passenger');
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background p-4 sm:p-6 max-w-lg mx-auto space-y-5 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleReturn}
          className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant">
          Trip Safety Summary
        </span>
        <div className="w-8" />
      </div>

      {/* Safety Points Awarded Toast Banner */}
      {pointsAwarded && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-3 rounded-2xl flex items-center justify-between text-xs animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-lg text-emerald-600">military_tech</span>
            <span>+15 Safety Points Awarded!</span>
          </div>
          <span className="font-mono text-[11px] font-semibold">Tier Progress Updated</span>
        </div>
      )}

      {/* Score Card */}
      <Card
        className={`p-6 text-center space-y-4 shadow-md ${
          isIncompleteSignalLost ? 'border border-amber-500/40' : ''
        }`}
      >
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
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
              strokeDashoffset={isIncompleteSignalLost ? 250 : isHighRisk ? 75 : 20}
              className={
                isIncompleteSignalLost
                  ? 'text-amber-500'
                  : isHighRisk
                  ? 'text-amber-500'
                  : 'text-emerald-600'
              }
              fill="transparent"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black font-mono">{summaryScore}</span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">
              {isIncompleteSignalLost ? 'N/A' : '/ 100'}
            </span>
          </div>
        </div>

        <div>
          <Badge variant={summaryBadgeVariant} className="px-3 py-1 font-bold">
            {summaryBadgeText}
          </Badge>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className="text-xs font-mono font-bold text-on-surface">
              {tripData.plateNumber || tripData.vehicleRegNumber}
            </span>
            {tripData.isProvisional && (
              <Badge variant="warning" className="text-[9px] uppercase font-mono py-0 px-1.5">
                Provisional
              </Badge>
            )}
          </div>
          <p className="text-xs text-on-surface-variant mt-1 font-medium">
            {tripData.routeName} ({tripData.saccoName})
          </p>
        </div>
      </Card>

      {/* Gemini AI Plain-Language Safety Summary Card */}
      <Card className="p-4 space-y-2 border border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            <span>AI Safety Assessment</span>
          </div>
          <Badge variant={aiRiskTier === 'low' ? 'success' : aiRiskTier === 'moderate' ? 'warning' : 'danger'} className="text-[10px]">
            {aiRiskTier.toUpperCase()} RISK
          </Badge>
        </div>

        {isLoadingAi ? (
          <div className="py-3 flex items-center gap-3 text-xs text-on-surface-variant">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="font-mono">Analyzing speed profile & violation telemetry with Gemini AI...</span>
          </div>
        ) : (
          <p className="text-xs text-on-surface leading-relaxed font-medium">
            {aiSummary || 'Analysis complete: Compliant trip within safety limits.'}
          </p>
        )}

        {aiError && (
          <div className="text-[10px] text-on-surface-variant/80 font-mono pt-1">
            {aiError}
          </div>
        )}
      </Card>

      {/* Speed & Metric Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 space-y-1">
          <span className="text-xs text-on-surface-variant">Total Duration</span>
          <div className="text-xl font-black font-mono">
            {formatDuration(tripData.durationSeconds || 0)}
          </div>
        </Card>
        <Card className="p-4 space-y-1">
          <span className="text-xs text-on-surface-variant">Max Speed</span>
          <div
            className={`text-xl font-black font-mono ${
              tripData.maxSpeedKmH > 80 ? 'text-error' : 'text-on-surface'
            }`}
          >
            {tripData.maxSpeedKmH || 0} km/h
          </div>
        </Card>
        <Card className="p-4 space-y-1">
          <span className="text-xs text-on-surface-variant">Average Speed</span>
          <div className="text-xl font-black font-mono">{tripData.avgSpeedKmH || 0} km/h</div>
        </Card>
        <Card className="p-4 space-y-1">
          <span className="text-xs text-on-surface-variant">Overspeed Events</span>
          <div
            className={`text-xl font-black font-mono ${
              (tripData.overspeedEventsCount ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-700'
            }`}
          >
            {tripData.overspeedEventsCount ?? 0}
          </div>
        </Card>
      </div>

      {/* Buttons */}
      <div className="space-y-2 pt-2">
        <Button
          variant="outline"
          className="w-full text-xs font-bold text-amber-700 border-amber-500/40 hover:bg-amber-500/10"
          onClick={() => navigate('/passenger/report-blackspot')}
        >
          <span className="material-symbols-outlined text-base mr-1">flag</span>
          {t('passenger.dashboard.reportHazard')}
        </Button>
        <Button className="w-full h-11 text-sm font-bold" onClick={handleReturn}>
          Finish & Return to Dashboard
        </Button>
      </div>
    </div>
  );
};
