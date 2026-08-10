import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { tripRepository } from '../../repositories';
import { Trip } from '../../types';

export const TripHistoryScreen: React.FC = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [filterSacco, setFilterSacco] = useState('all');

  useEffect(() => {
    async function loadTrips() {
      try {
        const docs = await tripRepository.getAll();
        setTrips(docs);
      } catch (err) {
        console.warn('Failed to load trips:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTrips();
  }, []);

  const filteredTrips = trips.filter((t) => {
    if (filterSacco !== 'all' && t.saccoName !== filterSacco) return false;
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-on-surface">Trip History</h1>
          <p className="text-xs text-on-surface-variant">
            Verified GPS telemetry logs & safety reports
          </p>
        </div>
      </div>

      {/* Filter Row */}
      {trips.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-on-surface-variant font-medium">Filter SACCO:</span>
          <button
            onClick={() => setFilterSacco('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              filterSacco === 'all'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            All SACCOs
          </button>
        </div>
      )}

      {/* Trip List or Empty State */}
      {loading ? (
        <div className="p-8 text-center text-xs text-on-surface-variant font-mono">
          Loading trip history...
        </div>
      ) : filteredTrips.length === 0 ? (
        <EmptyState
          title="No Trips Recorded Yet"
          description="Start tracking your PSV journeys to build your safety score and help monitor Kenya's roads."
          primaryCtaLabel="Start Your First Trip"
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
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container font-semibold">
                        {trip.vehicleRegNumber}
                      </span>
                      <span>{trip.routeName || 'Corridor Route'}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {trip.saccoName || 'SACCO'} · {trip.startTime ? new Date(trip.startTime).toLocaleDateString() : 'Recent'}
                    </p>
                  </div>

                  <Badge
                    variant={
                      trip.violationsCount === 0
                        ? 'success'
                        : trip.violationsCount <= 2
                        ? 'warning'
                        : 'danger'
                    }
                    className="font-bold font-mono text-xs"
                  >
                    Violations: {trip.violationsCount || 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant border-t border-outline-variant/20 pt-2">
                  <div className="flex items-center gap-3">
                    <span>Max Speed: {trip.maxSpeedKmH || 0} km/h</span>
                    <span>Avg: {trip.avgSpeedKmH || 0} km/h</span>
                  </div>
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Trip Details Modal */}
      <Dialog
        isOpen={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        title={selectedTrip?.routeName || 'Trip Details'}
      >
        {selectedTrip && (
          <div className="space-y-4 text-xs text-on-surface">
            <div className="bg-surface-container p-3 rounded-xl space-y-1">
              <div className="font-mono font-bold text-sm text-primary">
                {selectedTrip.vehicleRegNumber} ({selectedTrip.saccoName || 'SACCO'})
              </div>
              <div className="text-on-surface-variant">
                {selectedTrip.startTime ? new Date(selectedTrip.startTime).toLocaleString() : 'N/A'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="p-3 bg-surface-container-low rounded-xl">
                <span className="text-[10px] text-on-surface-variant block uppercase">Max Speed</span>
                <span className="text-base font-bold text-on-surface">{selectedTrip.maxSpeedKmH || 0} km/h</span>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl">
                <span className="text-[10px] text-on-surface-variant block uppercase">Avg Speed</span>
                <span className="text-base font-bold text-on-surface">{selectedTrip.avgSpeedKmH || 0} km/h</span>
              </div>
            </div>

            {(selectedTrip.violationsCount || 0) > 0 ? (
              <div className="p-3 bg-error/10 border border-error/20 text-error rounded-xl space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">warning</span>
                  {selectedTrip.violationsCount} Violation(s) Recorded
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 rounded-xl font-medium">
                ✓ Perfect Safety Score! No speed violations detected.
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                className="w-full text-xs text-on-surface-variant"
                onClick={() => setSelectedTrip(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
