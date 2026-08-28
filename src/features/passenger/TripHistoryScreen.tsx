import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/LoadingIndicators';
import { tripRepository } from '../../repositories';
import { useAuthStore } from '../../store/useAuthStore';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';
import { Trip } from '../../types';
import { toStandardDate } from '../../lib/utils';

const TripHistorySkeleton: React.FC = () => (
  <div className="space-y-3" role="status" aria-label="Loading trip history">
    {[0, 1, 2].map((item) => (
      <Card key={item} className="p-4 space-y-3 border border-outline-variant/30">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex items-center justify-between border-t border-outline-variant/20 pt-2">
          <div className="flex gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
      </Card>
    ))}
    <span className="sr-only">Loading your trip history…</span>
  </div>
);

export const TripHistoryScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [filterSacco, setFilterSacco] = useState('all');

  const { data: trips = [], isLoading: loading } = useQuery({
    queryKey: ['passengerTrips', user?.uid],
    queryFn: async () => {
      const constraints = user?.uid ? [where('userId', '==', user.uid)] : [];
      return tripRepository.getAll(constraints);
    },
    staleTime: QUERY_STALE_TIMES.REALTIME_TRIPS,
  });

  const filteredTrips = trips.filter((t) => {
    if (filterSacco !== 'all' && t.saccoName !== filterSacco) return false;
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-on-surface">{t('passenger.trips.title')}</h1>
          <p className="text-xs text-on-surface-variant">{t('passenger.trips.subtitle')}</p>
        </div>
      </div>

      {trips.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-on-surface-variant font-medium">{t('passenger.trips.filterSacco')}</span>
          <button
            onClick={() => setFilterSacco('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              filterSacco === 'all'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {t('passenger.trips.allSaccos')}
          </button>
        </div>
      )}

      {loading ? (
        <TripHistorySkeleton />
      ) : filteredTrips.length === 0 ? (
        <EmptyState
          title={t('passenger.trips.emptyTitle')}
          description={t('passenger.trips.emptyDesc')}
          primaryCtaLabel={t('passenger.trips.startFirstTrip')}
          onPrimaryCta={() => navigate('/passenger')}
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {filteredTrips.map((trip) => (
              <Card
                key={trip.id}
                onClick={() => setSelectedTrip(trip)}
                className="p-4 cursor-pointer hover:bg-surface-container-high/50 transition-colors space-y-3 border border-outline-variant/30"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-on-surface flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container font-semibold">{trip.vehicleRegNumber}</span>
                      <span>{trip.routeName || 'Corridor Route'}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {trip.saccoName || 'SACCO'} · {trip.startTime ? toStandardDate(trip.startTime).toLocaleDateString() : 'Recent'}
                    </p>
                  </div>
                  <Badge
                    variant={(trip.violationsCount || 0) === 0 ? 'success' : (trip.violationsCount || 0) <= 2 ? 'warning' : 'danger'}
                    className="font-bold font-mono text-xs"
                  >
                    {t('passenger.trips.violations')}: {trip.violationsCount || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant border-t border-outline-variant/20 pt-2">
                  <div className="flex items-center gap-3">
                    <span>{t('passenger.trips.maxSpeed')}: {trip.maxSpeedKmH || 0} km/h</span>
                    <span>{t('passenger.trips.avgSpeed')}: {trip.avgSpeedKmH || 0} km/h</span>
                  </div>
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog
        isOpen={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        title={selectedTrip?.routeName || t('passenger.trips.tripDetails')}
      >
        {selectedTrip && (
          <div className="space-y-4 text-xs text-on-surface">
            <div className="bg-surface-container p-3 rounded-xl space-y-1">
              <div className="font-mono font-bold text-sm text-primary">
                {selectedTrip.vehicleRegNumber} ({selectedTrip.saccoName || 'SACCO'})
              </div>
              <div className="text-on-surface-variant">
                {selectedTrip.startTime ? toStandardDate(selectedTrip.startTime).toLocaleString() : 'N/A'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="p-3 bg-surface-container-low rounded-xl">
                <span className="text-[10px] text-on-surface-variant block uppercase">{t('passenger.trips.maxSpeed')}</span>
                <span className="text-base font-bold text-on-surface">{selectedTrip.maxSpeedKmH || 0} km/h</span>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl">
                <span className="text-[10px] text-on-surface-variant block uppercase">{t('passenger.trips.avgSpeed')}</span>
                <span className="text-base font-bold text-on-surface">{selectedTrip.avgSpeedKmH || 0} km/h</span>
              </div>
            </div>
            {(selectedTrip.violationsCount || 0) > 0 ? (
              <div className="p-3 bg-error/10 border border-error/20 text-error rounded-xl space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">warning</span>
                  {t('passenger.trips.violationsRecorded', { count: selectedTrip.violationsCount })}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 rounded-xl font-medium">
                {t('passenger.trips.perfectSafety')}
              </div>
            )}
            <div className="pt-2 flex gap-2">
              <Button variant="outline" className="w-full text-xs text-on-surface-variant" onClick={() => setSelectedTrip(null)}>
                {t('passenger.trips.close')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
