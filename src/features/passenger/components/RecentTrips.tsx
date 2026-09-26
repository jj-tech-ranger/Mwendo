import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Skeleton } from '../../../components/ui/LoadingIndicators';
import { tripRepository } from '../../../repositories';
import { useAuthStore } from '../../../store/useAuthStore';
import { queryClient as defaultQueryClient, QUERY_STALE_TIMES } from '../../../lib/queryClient';
import { Trip } from '../../../types';
import { toStandardDate } from '../../../lib/utils';
import { computeTripSafety } from '../../../lib/tripSafety';

interface RecentTripsProps {
  limitCount?: number;
  className?: string;
  onSelectTrip?: (trip: Trip) => void;
}

export const RecentTrips: React.FC<RecentTripsProps> = ({
  limitCount = 3,
  className = '',
  onSelectTrip,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  let activeClient = defaultQueryClient;
  try {
    activeClient = useQueryClient() || defaultQueryClient;
  } catch {
    activeClient = defaultQueryClient;
  }

  const { data: completedTrips = [], isLoading, error } = useQuery(
    {
      queryKey: ['passengerRecentTrips', user?.uid],
      queryFn: async () => {
        if (!user?.uid) return [];
        const constraints = [where('userId', '==', user.uid)];
        const trips = await tripRepository.getAll(constraints);
        // Filter for completed trips and sort by startTime descending
        return trips
          .filter((trip) => trip.status === 'completed' || trip.status === 'auto_completed' || trip.status === 'incomplete_signal_lost')
          .sort((a, b) => {
            const timeA = a.startTime ? new Date(toStandardDate(a.startTime)).getTime() : 0;
            const timeB = b.startTime ? new Date(toStandardDate(b.startTime)).getTime() : 0;
            return timeB - timeA;
          });
      },
      staleTime: QUERY_STALE_TIMES.REALTIME_TRIPS,
      enabled: !!user?.uid,
    },
    activeClient
  );

  const displayedTrips = completedTrips.slice(0, limitCount);

  const handleTripClick = (trip: Trip) => {
    if (onSelectTrip) {
      onSelectTrip(trip);
    } else {
      setSelectedTrip(trip);
    }
  };

  return (
    <div className={`space-y-3 ${className}`} data-testid="recent-trips-dashboard">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">history_edu</span>
          <h2 className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">
            {t('passenger.dashboard.recentTrips', 'Recent Trips')}
          </h2>
          {completedTrips.length > 0 && (
            <Badge variant="neutral" className="text-[10px] px-1.5 py-0 font-mono">
              {completedTrips.length}
            </Badge>
          )}
        </div>
        {completedTrips.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/passenger/trips')}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
          >
            {t('passenger.dashboard.viewAllTrips', 'View All')} →
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5" role="status" aria-label="Loading recent trips">
          {[0, 1].map((i) => (
            <Card key={i} className="p-3.5 space-y-2 border border-outline-variant/30">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </Card>
          ))}
          <span className="sr-only">Loading recent trips…</span>
        </div>
      ) : error ? (
        <Card className="p-4 text-center border-outline-variant/30 bg-surface-container-low text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-warning text-xl mb-1 block">warning</span>
          <p>Could not load recent trips right now.</p>
        </Card>
      ) : displayedTrips.length === 0 ? (
        <Card className="p-4 text-center border-outline-variant/30 bg-surface-container-low/50">
          <div className="flex flex-col items-center justify-center py-2 space-y-1.5">
            <span className="material-symbols-outlined text-outline text-2xl">route</span>
            <p className="text-xs font-bold text-on-surface">No completed trips yet</p>
            <p className="text-[11px] text-on-surface-variant max-w-xs">
              Board a registered matatu or bus and track your journey to view your real-time safety scores and AI trip summaries.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {displayedTrips.map((trip) => {
            const safety = computeTripSafety(trip);
            const dateStr = trip.startTime
              ? toStandardDate(trip.startTime).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recent';

            return (
              <Card
                key={trip.id}
                onClick={() => handleTripClick(trip)}
                className="p-3.5 space-y-2.5 border border-outline-variant/30 hover:border-primary/50 transition-all cursor-pointer group hover:bg-surface-container/60 shadow-xs"
                data-testid={`recent-trip-item-${trip.id}`}
              >
                {/* Header: Plate & Route & Score */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface">
                        {trip.vehicleRegNumber || trip.plateNumber || 'PSV'}
                      </span>
                      <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">
                        {trip.routeName || 'Corridor Journey'}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {trip.saccoName || 'Registered SACCO'} · {dateStr}
                    </p>
                  </div>

                  {/* Safety Score Badge */}
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/40">
                      <span
                        className={`material-symbols-outlined text-xs ${
                          safety.riskTier === 'low'
                            ? 'text-emerald-600'
                            : safety.riskTier === 'moderate'
                            ? 'text-amber-500'
                            : 'text-error'
                        }`}
                      >
                        {safety.riskTier === 'low' ? 'verified_user' : 'warning'}
                      </span>
                      <span className="font-mono font-bold text-xs text-on-surface">
                        {safety.score}
                        {typeof safety.score === 'number' && <span className="text-[10px] text-on-surface-variant font-normal">/100</span>}
                      </span>
                    </div>
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-on-surface-variant mt-0.5 text-center">
                      Safety Score
                    </div>
                  </div>
                </div>

                {/* Generated Summary Callout */}
                <div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/30 text-[11px] text-on-surface-variant leading-relaxed flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-xs shrink-0 mt-0.5">
                    summarize
                  </span>
                  <p className="line-clamp-2 italic">
                    &ldquo;{safety.summary}&rdquo;
                  </p>
                </div>

                {/* Key Metrics Strip */}
                <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant border-t border-outline-variant/20 pt-2">
                  <div className="flex items-center gap-3">
                    <span>
                      Max: <strong className="text-on-surface">{trip.maxSpeedKmH || 0} km/h</strong>
                    </span>
                    <span>
                      Avg: <strong className="text-on-surface">{trip.avgSpeedKmH || 0} km/h</strong>
                    </span>
                    {(trip.overspeedEventsCount ?? trip.violationsCount ?? 0) > 0 ? (
                      <span className="text-error font-semibold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-xs">speed</span>
                        {trip.overspeedEventsCount ?? trip.violationsCount} alert(s)
                      </span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        0 alerts
                      </span>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                    chevron_right
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Trip Details Dialog */}
      <Dialog
        isOpen={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        title={selectedTrip?.routeName || 'Trip Safety Summary'}
      >
        {selectedTrip && (() => {
          const safety = computeTripSafety(selectedTrip);
          return (
            <div className="space-y-4 text-xs text-on-surface">
              <div className="bg-surface-container p-3 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-primary">
                    {selectedTrip.vehicleRegNumber || selectedTrip.plateNumber}
                  </span>
                  <Badge variant={safety.riskTier === 'low' ? 'success' : safety.riskTier === 'moderate' ? 'warning' : 'danger'}>
                    Safety Score: {safety.score}/100
                  </Badge>
                </div>
                <div className="text-on-surface-variant">
                  SACCO: <strong className="text-on-surface">{selectedTrip.saccoName || 'Registered SACCO'}</strong>
                </div>
                <div className="text-on-surface-variant">
                  Date: {selectedTrip.startTime ? toStandardDate(selectedTrip.startTime).toLocaleString() : 'Recent'}
                </div>
              </div>

              {/* Full Generated Summary */}
              <div className="p-3 bg-surface-container-low border border-outline-variant/40 rounded-xl space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">auto_awesome</span>
                  Generated Safety Summary
                </div>
                <p className="text-xs text-on-surface leading-relaxed">
                  {safety.summary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="p-3 bg-surface-container-low rounded-xl">
                  <span className="text-[10px] text-on-surface-variant block uppercase">Peak Speed</span>
                  <span className="text-base font-bold text-on-surface">{selectedTrip.maxSpeedKmH || 0} km/h</span>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl">
                  <span className="text-[10px] text-on-surface-variant block uppercase">Average Speed</span>
                  <span className="text-base font-bold text-on-surface">{selectedTrip.avgSpeedKmH || 0} km/h</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => {
                    const t = selectedTrip;
                    setSelectedTrip(null);
                    navigate('/passenger/summary', { state: { trip: t } });
                  }}
                >
                  Open Full Summary View
                </Button>
                <Button
                  variant="secondary"
                  className="w-full text-xs"
                  onClick={() => setSelectedTrip(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          );
        })()}
      </Dialog>
    </div>
  );
};
export default RecentTrips;
