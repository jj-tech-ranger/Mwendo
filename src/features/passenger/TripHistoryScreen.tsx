import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';

interface SampleTrip {
  id: string;
  plateNumber: string;
  saccoName: string;
  routeName: string;
  date: string;
  duration: string;
  maxSpeed: number;
  safetyScore: number;
  status: 'safe' | 'caution' | 'danger';
  violations: number;
}

const SAMPLE_TRIPS: SampleTrip[] = [
  {
    id: 'trip_101',
    plateNumber: 'KDA 123A',
    saccoName: 'MetroLink SACCO',
    routeName: 'Thika Road – Nairobi CBD',
    date: '08 Aug 2026 · 17:42',
    duration: '18:42',
    maxSpeed: 78,
    safetyScore: 96,
    status: 'safe',
    violations: 0,
  },
  {
    id: 'trip_102',
    plateNumber: 'KCE 450Z',
    saccoName: 'GreenLine SACCO',
    routeName: 'Waiyaki Way – Westlands',
    date: '05 Aug 2026 · 08:15',
    duration: '24:10',
    maxSpeed: 94,
    safetyScore: 72,
    status: 'caution',
    violations: 1,
  },
  {
    id: 'trip_103',
    plateNumber: 'KCF 882B',
    saccoName: 'TransitStar SACCO',
    routeName: 'Mombasa Road – Syokimau',
    date: '28 Jul 2026 · 19:05',
    duration: '32:00',
    maxSpeed: 102,
    safetyScore: 54,
    status: 'danger',
    violations: 3,
  },
];

export const TripHistoryScreen: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTrip, setSelectedTrip] = useState<SampleTrip | null>(null);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [filterSacco, setFilterSacco] = useState('all');

  const filteredTrips = SAMPLE_TRIPS.filter((t) => {
    if (filterSacco !== 'all' && t.saccoName !== filterSacco) return false;
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Top Header & Empty Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-on-surface">Trip History</h1>
          <p className="text-xs text-on-surface-variant">
            Verified GPS telemetry logs & safety reports
          </p>
        </div>

        <button
          onClick={() => setShowEmptyState(!showEmptyState)}
          className="text-xs font-mono text-primary hover:underline"
        >
          {showEmptyState ? 'Show Trips' : 'Test Empty State'}
        </button>
      </div>

      {/* Filter Row */}
      {!showEmptyState && (
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
          <button
            onClick={() => setFilterSacco('MetroLink SACCO')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              filterSacco === 'MetroLink SACCO'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            MetroLink
          </button>
          <button
            onClick={() => setFilterSacco('GreenLine SACCO')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              filterSacco === 'GreenLine SACCO'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            GreenLine
          </button>
        </div>
      )}

      {/* Trip List or Empty State */}
      {showEmptyState ? (
        <EmptyState
          title="No Trips Recorded Yet"
          description="Start tracking your PSV journeys to build your safety score and help monitor Kenya's roads."
          primaryCtaLabel="Start Your First Trip"
          onPrimaryCta={() => navigate('/passenger')}
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant">
              August 2026
            </h2>

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
                        {trip.plateNumber}
                      </span>
                      <span>{trip.routeName}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {trip.saccoName} · {trip.date}
                    </p>
                  </div>

                  <Badge
                    variant={
                      trip.status === 'safe'
                        ? 'success'
                        : trip.status === 'caution'
                        ? 'warning'
                        : 'danger'
                    }
                    className="font-bold font-mono text-xs"
                  >
                    Score: {trip.safetyScore}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant border-t border-outline-variant/20 pt-2">
                  <div className="flex items-center gap-3">
                    <span>Duration: {trip.duration}</span>
                    <span>Max: {trip.maxSpeed} km/h</span>
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
                {selectedTrip.plateNumber} ({selectedTrip.saccoName})
              </div>
              <div className="text-on-surface-variant">{selectedTrip.date}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="p-3 bg-surface-container-low rounded-xl">
                <span className="text-[10px] text-on-surface-variant block uppercase">Max Speed</span>
                <span className="text-base font-bold text-on-surface">{selectedTrip.maxSpeed} km/h</span>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl">
                <span className="text-[10px] text-on-surface-variant block uppercase">Duration</span>
                <span className="text-base font-bold text-on-surface">{selectedTrip.duration}</span>
              </div>
            </div>

            {selectedTrip.violations > 0 ? (
              <div className="p-3 bg-error/10 border border-error/20 text-error rounded-xl space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">warning</span>
                  {selectedTrip.violations} Violation(s) Recorded
                </div>
                <p className="text-[11px] text-error/80">
                  Overspeed event logged on Thika Road corridor.
                </p>
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
