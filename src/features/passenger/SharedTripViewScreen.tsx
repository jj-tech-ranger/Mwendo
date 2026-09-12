import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SharedTrip } from '../../types';
import { shareTripService } from '../../services/shareTripService';

export const SharedTripViewScreen: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!shareId) return;

    // Initial fetch
    void shareTripService.getSharedTrip(shareId).then((data) => {
      if (data) {
        if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
          setIsExpired(true);
        }
        setTrip(data);
      }
      setLoading(false);
    });

    // Real-time listener without auth
    const unsub = onSnapshot(
      doc(db, 'shared_trips', shareId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SharedTrip;
          if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
            setIsExpired(true);
          }
          setTrip(data);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Snapshot listener error on shared trip:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-on-surface-variant font-mono">Loading live trip status...</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mb-4 text-on-surface-variant">
          <span className="material-symbols-outlined text-3xl">wrong_location</span>
        </div>
        <h1 className="text-xl font-bold text-on-surface mb-2">Trip Not Found</h1>
        <p className="text-sm text-on-surface-variant mb-6">
          This shared trip link does not exist or has expired.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-sm"
        >
          Open Mwendo Salama
        </Link>
      </div>
    );
  }

  const isOverspeed = trip.currentSpeedKmH > 80 || trip.overspeedEventsCount > 0;
  const isTripEnded = trip.status === 'completed' || isExpired;

  return (
    <div className="min-h-screen bg-background text-on-background p-4 sm:p-6 max-w-lg mx-auto space-y-4 animate-in fade-in duration-300">
      {/* Brand Header */}
      <div className="flex items-center justify-between py-2 border-b border-outline/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-xl">directions_bus</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Mwendo Salama</h1>
            <p className="text-[10px] text-on-surface-variant font-medium">Passenger Safety Guardian</p>
          </div>
        </div>
        <Badge variant={isTripEnded ? 'neutral' : 'success'} className="font-mono text-xs">
          {isTripEnded ? 'TRIP COMPLETED' : 'LIVE STATUS'}
        </Badge>
      </div>

      {/* Safety Status Card */}
      <Card className="p-6 text-center space-y-4 border border-outline/15 shadow-sm">
        <div className="flex items-center justify-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isTripEnded
                ? 'bg-surface-container-high text-on-surface'
                : isOverspeed
                ? 'bg-amber-500/20 text-amber-600'
                : 'bg-emerald-500/20 text-emerald-600'
            }`}
          >
            <span className="material-symbols-outlined text-3xl">
              {isTripEnded ? 'task_alt' : isOverspeed ? 'warning' : 'verified_user'}
            </span>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-on-surface">
            {isTripEnded ? 'Trip Safely Completed' : trip.safetyStatus}
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Privacy Protected: Live safety metrics only, without GPS trail recording.
          </p>
        </div>

        {/* Speed Indicator */}
        {!isTripEnded && (
          <div className="bg-surface-container p-4 rounded-xl flex items-center justify-around">
            <div>
              <span className="text-[11px] text-on-surface-variant block uppercase tracking-wider font-semibold">
                Current Speed
              </span>
              <span
                className={`text-2xl font-black font-mono ${
                  trip.currentSpeedKmH > 80 ? 'text-error' : 'text-primary'
                }`}
              >
                {trip.currentSpeedKmH} <span className="text-xs font-normal">km/h</span>
              </span>
            </div>
            <div className="h-8 w-px bg-outline/20" />
            <div>
              <span className="text-[11px] text-on-surface-variant block uppercase tracking-wider font-semibold">
                Max Recorded
              </span>
              <span className="text-2xl font-black font-mono text-on-surface">
                {trip.maxSpeedKmH} <span className="text-xs font-normal">km/h</span>
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Matatu & Transit Details */}
      <Card className="p-5 space-y-3">
        <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
          Vehicle Information
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-surface-container rounded-lg">
            <span className="text-[10px] text-on-surface-variant block">Registration Plate</span>
            <span className="font-black font-mono text-sm">{trip.plateNumber}</span>
          </div>
          <div className="p-3 bg-surface-container rounded-lg">
            <span className="text-[10px] text-on-surface-variant block">SACCO Operator</span>
            <span className="font-bold truncate block">{trip.saccoName}</span>
          </div>
        </div>
        <div className="p-3 bg-surface-container rounded-lg text-xs">
          <span className="text-[10px] text-on-surface-variant block">Route Corridor</span>
          <span className="font-medium text-on-surface">{trip.routeName}</span>
        </div>
      </Card>

      {/* Expiry and Safety Notice */}
      <div className="text-center p-3 text-[11px] text-on-surface-variant space-y-1">
        <p>This read-only link automatically expires after 12 hours.</p>
        <p className="font-mono text-[10px]">
          Last updated: {new Date(trip.lastUpdatedAt).toLocaleTimeString()}
        </p>
      </div>

      <div className="pt-2">
        <Link
          to="/"
          className="w-full h-11 flex items-center justify-center bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs rounded-xl transition-colors"
        >
          Protected by Mwendo Salama Platform
        </Link>
      </div>
    </div>
  );
};
