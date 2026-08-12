import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { tripRepository } from '../../repositories';
import { Trip, TripStatus } from '../../types';

export const AdminTripsScreen: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Slide-over preview & Raw Telemetry Modal
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showRawTelemetryModal, setShowRawTelemetryModal] = useState(false);

  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    setIsLoading(true);
    try {
      const fetched = await tripRepository.getAll();
      setTrips(fetched);
    } catch (err) {
      console.error('Failed to load trips:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const getStatusBadge = (s: TripStatus) => {
    switch (s) {
      case 'active':
        return <Badge variant="success">Active Live</Badge>;
      case 'completed':
        return <Badge variant="info">Completed</Badge>;
      case 'auto_completed':
        return (
          <span className="font-label-mono text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full font-bold">
            Auto Completed
          </span>
        );
      case 'incomplete_signal_lost':
        return (
          <span className="font-label-mono text-[10px] text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
            Signal Lost
          </span>
        );
      case 'discarded':
        return <Badge variant="danger">Discarded</Badge>;
      default: {
        const _exhaustive: never = s;
        return <Badge variant="neutral">{_exhaustive}</Badge>;
      }
    }
  };

  const filtered = trips.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      t.id.toLowerCase().includes(q) ||
      t.vehicleRegNumber.toLowerCase().includes(q) ||
      t.saccoName.toLowerCase().includes(q) ||
      t.routeName.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Platform Trip Explorer & Raw Telemetry
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Cross-tenant search across all GPS trip logs and raw ingestion data.
          </p>
        </div>

        <Badge variant="info">{filtered.length} Trips Matched</Badge>
      </div>

      {/* Status Chips Legend */}
      <div className="flex flex-wrap items-center gap-xs text-[11px] font-label-mono bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-sm shadow-xs">
        <span className="text-on-surface-variant uppercase font-bold mr-2">Status Legend:</span>
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          active
        </span>
        <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 border border-sky-500/20">
          completed
        </span>
        <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
          auto_completed
        </span>
        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
          incomplete_signal_lost
        </span>
        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">
          discarded
        </span>
      </div>

      {/* Filter Row */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm flex flex-col md:flex-row gap-md items-center justify-between">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Trip ID, Plate, SACCO, Route..."
            className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
        >
          <option value="all">All Trip Statuses</option>
          <option value="active">active</option>
          <option value="completed">completed</option>
          <option value="auto_completed">auto_completed</option>
          <option value="incomplete_signal_lost">incomplete_signal_lost</option>
          <option value="discarded">discarded</option>
        </select>
      </div>

      {/* Trips Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead className="bg-surface-container-low font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
              <tr>
                <th className="p-md">Trip ID</th>
                <th className="p-md">Vehicle Plate</th>
                <th className="p-md">SACCO / Route</th>
                <th className="p-md">Driver</th>
                <th className="p-md">Speed Metrics</th>
                <th className="p-md">Status</th>
                <th className="p-md text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-surface-container/50">
                  <td className="p-md font-label-mono text-xs font-bold text-primary">
                    {t.id}
                  </td>
                  <td className="p-md font-label-mono font-bold text-on-surface">
                    {t.vehicleRegNumber}
                  </td>
                  <td className="p-md">
                    <p className="font-bold text-on-surface">{t.saccoName}</p>
                    <p className="text-[10px] text-on-surface-variant">{t.routeName}</p>
                  </td>
                  <td className="p-md text-on-surface">{t.driverName || 'Unassigned'}</td>
                  <td className="p-md font-label-mono text-[11px]">
                    <span className="text-emerald-600 font-bold">{t.currentSpeedKmH || 0} km/h</span>
                    <span className="text-outline text-[10px] ml-1">(Max: {t.maxSpeedKmH} km/h)</span>
                  </td>
                  <td className="p-md">{getStatusBadge(t.status)}</td>
                  <td className="p-md text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelectedTrip(t)}>
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Trip Slide-Over Panel */}
      {selectedTrip && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-lg bg-surface-container-lowest border-l border-outline-variant/30 h-full p-lg overflow-y-auto space-y-md shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-md">
              <div>
                <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">
                  Trip Inspection
                </h3>
                <span className="font-label-mono text-xs text-primary">{selectedTrip.id}</span>
              </div>
              <button
                onClick={() => setSelectedTrip(null)}
                className="p-1 rounded-xl hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-sm text-xs font-body-sm">
              <div className="p-md rounded-2xl bg-surface-container-low space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono font-bold text-sm text-on-surface">
                    {selectedTrip.vehicleRegNumber}
                  </span>
                  {getStatusBadge(selectedTrip.status)}
                </div>
                <p className="font-bold text-on-surface">{selectedTrip.saccoName}</p>
                <p className="text-on-surface-variant">{selectedTrip.routeName}</p>
              </div>

              <div className="p-md rounded-2xl border border-outline-variant/20 space-y-2">
                <span className="font-label-mono text-[10px] text-outline uppercase font-bold">
                  Telemetry Confidence Breakdown
                </span>
                <div className="grid grid-cols-2 gap-sm text-xs">
                  <div>
                    <span className="text-on-surface-variant block">Max Speed</span>
                    <span className="font-label-mono font-bold text-rose-600">{selectedTrip.maxSpeedKmH} km/h</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block">Average Speed</span>
                    <span className="font-label-mono font-bold text-on-surface">{selectedTrip.avgSpeedKmH} km/h</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block">Overspeed Alerts</span>
                    <span className="font-label-mono font-bold text-amber-600">{selectedTrip.overspeedEventsCount ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block">Violations Logged</span>
                    <span className="font-label-mono font-bold text-rose-600">{selectedTrip.violationsCount ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-md border-t border-outline-variant/20 space-y-2">
              <Button
                variant="primary"
                className="w-full justify-center gap-2"
                onClick={() => setShowRawTelemetryModal(true)}
              >
                <span className="material-symbols-outlined text-lg">code</span>
                View Raw GPS Telemetry JSON
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Raw Telemetry JSON Modal */}
      {showRawTelemetryModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-md">
          <div className="bg-[#121212] text-emerald-400 border border-emerald-900/60 rounded-2xl p-lg max-w-2xl w-full space-y-md shadow-2xl font-label-mono text-xs">
            <div className="flex items-center justify-between border-b border-emerald-800/40 pb-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">data_object</span>
                <span className="font-bold text-white">Raw Telemetry Packet ({selectedTrip.id})</span>
              </div>
              <button
                onClick={() => setShowRawTelemetryModal(false)}
                className="text-emerald-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-[#0A0A0A] p-md rounded-xl border border-emerald-900/40 max-h-80 overflow-y-auto">
              {(() => {
                const sampleGPS = [];
                if (selectedTrip.startLocation) {
                  sampleGPS.push({
                    point: 'startLocation',
                    lat: selectedTrip.startLocation.latitude,
                    lng: selectedTrip.startLocation.longitude,
                    timestamp: selectedTrip.startTime,
                  });
                }
                if (selectedTrip.lastGpsUpdate) {
                  sampleGPS.push({
                    point: 'lastGpsUpdate',
                    lat: selectedTrip.lastGpsUpdate.latitude,
                    lng: selectedTrip.lastGpsUpdate.longitude,
                    speedKmH: selectedTrip.lastGpsUpdate.speedKmH,
                    heading: selectedTrip.lastGpsUpdate.heading,
                    timestamp: selectedTrip.lastGpsUpdate.timestamp,
                  });
                }
                if (selectedTrip.endLocation) {
                  sampleGPS.push({
                    point: 'endLocation',
                    lat: selectedTrip.endLocation.latitude,
                    lng: selectedTrip.endLocation.longitude,
                    timestamp: selectedTrip.endTime || selectedTrip.updatedAt || selectedTrip.startTime,
                  });
                }

                if (sampleGPS.length === 0) {
                  return (
                    <div className="p-lg text-center text-slate-400 font-body-sm space-y-1">
                      <span className="material-symbols-outlined text-3xl text-slate-500 block mb-1">
                        location_off
                      </span>
                      <p className="font-bold text-slate-300">No telemetry sample available</p>
                      <p className="text-[11px] text-slate-500">
                        This trip record has no stored GPS location coordinates.
                      </p>
                    </div>
                  );
                }

                return (
                  <pre className="text-[11px] leading-relaxed text-emerald-300">
                    {JSON.stringify(
                      {
                        tripId: selectedTrip.id,
                        vehicleRegNumber: selectedTrip.vehicleRegNumber,
                        saccoId: selectedTrip.saccoId,
                        traceId: selectedTrip.traceId || `trc-${selectedTrip.id}`,
                        telemetryStoragePath:
                          selectedTrip.telemetryStoragePath || `telemetry/${selectedTrip.id}.json`,
                        sampleGPS,
                      },
                      null,
                      2
                    )}
                  </pre>
                );
              })()}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setShowRawTelemetryModal(false)}>
                Close Window
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
