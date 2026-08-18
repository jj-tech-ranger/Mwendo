import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blackSpotRepository, auditLogRepository } from '../../repositories';
import { BlackSpot, SeverityLevel, HazardType } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { MapComponent, MapMarker } from '../../components/map/MapComponent';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../components/ui/Toast';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

export const AuthorityBlackSpotsScreen: React.FC = () => {
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  // Form State for New Official Black Spot
  const [showAddModal, setShowAddModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formRoute, setFormRoute] = useState('');
  const [formCounty, setFormCounty] = useState('Nairobi');
  const [formLat, setFormLat] = useState('-1.286389');
  const [formLng, setFormLng] = useState('36.817223');
  const [formSeverity, setFormSeverity] = useState<SeverityLevel>('high');
  const [formHazardType, setFormHazardType] = useState<HazardType>('accident_prone');
  const [formDescription, setFormDescription] = useState('');

  // Filters
  const [selectedCounty, setSelectedCounty] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'queue'>('map');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const { data: blackSpots = [], isLoading } = useQuery({
    queryKey: ['blackSpots'],
    queryFn: async () => {
      const data = await blackSpotRepository.getAll();
      return data;
    },
    staleTime: QUERY_STALE_TIMES.SAFETY_ALERTS,
  });

  // Filtered dataset
  const filteredSpots = useMemo(() => {
    return blackSpots.filter((s) => {
      const matchCounty = selectedCounty === 'All' || s.county === selectedCounty || s.routeName?.includes(selectedCounty);
      const matchSeverity = selectedSeverity === 'all' || s.severity === selectedSeverity;
      return matchCounty && matchSeverity;
    });
  }, [blackSpots, selectedCounty, selectedSeverity]);

  // Pending verification queue
  const pendingSpots = useMemo(() => {
    return blackSpots.filter((s) => !s.verifiedByAuthority || s.status === 'pending');
  }, [blackSpots]);

  // Heat map markers
  const mapMarkers: MapMarker[] = useMemo(() => {
    return filteredSpots.map((spot, idx) => ({
      id: spot.id || `spot-${idx}`,
      lat: spot.latitude || -1.286389 + (idx % 3) * 0.03,
      lng: spot.longitude || 36.817223 + (idx % 3) * 0.03,
      type: 'blackspot',
      title: spot.name || spot.title || 'Black Spot Hazard',
      subtitle: `${spot.routeName || 'Highway'} • ${spot.severity.toUpperCase()}`,
      severity: spot.severity === 'critical' || spot.severity === 'high' ? 'high' : 'medium',
    }));
  }, [filteredSpots]);

  // Handle Verify & Publish
  const handleVerifySpot = async (spotId: string, isApproved: boolean) => {
    try {
      await blackSpotRepository.update(spotId, {
        verifiedByAuthority: isApproved,
        status: isApproved ? 'published' : 'rejected',
      });

      await queryClient.invalidateQueries({ queryKey: ['blackSpots'] });

      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: 'NTSA',
        actorName: user?.displayName || 'Inspector',
        actorRole: 'NTSA Inspector',
        action: isApproved ? 'Verified & Published Black Spot Hazard' : 'Rejected User Black Spot Report',
        target: `BlackSpot ${spotId}`,
        timestamp: new Date().toISOString(),
      });

      setActionMessage(isApproved ? 'Black spot hazard officially verified and published!' : 'Report rejected.');
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err) {
      console.error('Failed to verify black spot:', err);
      showToast('error', 'Update Failed', 'Error updating black spot status.');
    }
  };

  // Handle Create New Official Black Spot
  const handleCreateSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formRoute) {
      showToast('warning', 'Missing Fields', 'Please fill in title and route name.');
      return;
    }

    const newSpot: BlackSpot = {
      id: `bs-${Date.now()}`,
      name: formName,
      title: formName,
      routeName: formRoute,
      county: formCounty,
      latitude: parseFloat(formLat) || -1.286389,
      longitude: parseFloat(formLng) || 36.817223,
      severity: formSeverity,
      hazardType: formHazardType,
      accidentCount12M: 5,
      hazardDescription: formDescription || 'Official NTSA Hazard Advisory',
      description: formDescription || 'Official NTSA Hazard Advisory',
      reportedByUid: user?.uid || 'ntsa-inspector',
      verifiedByAuthority: true,
      status: 'published',
      confidenceScore: 1.0,
      createdAt: new Date().toISOString(),
    };

    try {
      await blackSpotRepository.save(newSpot);
      await queryClient.invalidateQueries({ queryKey: ['blackSpots'] });
      setShowAddModal(false);

      // Reset form
      setFormName('');
      setFormRoute('');
      setFormDescription('');

      setActionMessage('Official Black Spot Advisory published successfully!');
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err) {
      console.error('Failed to publish black spot:', err);
      showToast('error', 'Publish Failed', 'Failed to publish black spot.');
    }
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface">
            NTSA Black Spot Density & Road Hazard Registry
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Verified black spot locations, speed bump hazards, and automated driver audio warning geofences
          </p>
        </div>

        <div className="flex items-center gap-sm">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="gap-2"
          >
            <span className="material-symbols-outlined text-base">add_location_alt</span>
            Publish Official Hazard
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-md rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-label-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">verified</span>
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/20 pb-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('map')}
              className={`px-4 py-2 rounded-xl font-label-bold text-xs transition-colors flex items-center gap-2 ${
                activeTab === 'map'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-base">map</span>
              Density Heat Map
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-xl font-label-bold text-xs transition-colors flex items-center gap-2 ${
                activeTab === 'list'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-base">format_list_bulleted</span>
              Verified Registry ({filteredSpots.length})
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 rounded-xl font-label-bold text-xs transition-colors flex items-center gap-2 ${
                activeTab === 'queue'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-base">fact_check</span>
              Verification Queue ({pendingSpots.length})
            </button>
          </div>

          <div className="flex items-center gap-sm">
            <select
              id="blackspot-filter-county"
              aria-label="Filter by County"
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
              className="bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-label-mono rounded-xl px-3 py-1.5 focus:outline-none"
            >
              <option value="All">All Counties</option>
              <option value="Nairobi">Nairobi</option>
              <option value="Kiambu">Kiambu</option>
              <option value="Machakos">Machakos</option>
              <option value="Nakuru">Nakuru</option>
              <option value="Mombasa">Mombasa</option>
            </select>

            <select
              id="blackspot-filter-severity"
              aria-label="Filter by Severity"
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-label-mono rounded-xl px-3 py-1.5 focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
            </select>
          </div>
        </div>

        {/* Tab 1: Heat Map View */}
        {activeTab === 'map' && (
          <div className="space-y-md">
            <MapComponent
              markers={mapMarkers}
              centerAddress={`${selectedCounty === 'All' ? 'Kenya National PSV Corridor' : selectedCounty + ' County'}`}
              showHeatmapOverlay={true}
              className="h-[440px]"
            />
          </div>
        )}

        {/* Tab 2: Verified Registry View */}
        {activeTab === 'list' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-body-sm">
              <thead>
                <tr className="border-b border-outline-variant/20 text-on-surface-variant font-label-mono uppercase">
                  <th className="py-2.5 px-3">Hazard Name</th>
                  <th className="py-2.5 px-3">Corridor / Route</th>
                  <th className="py-2.5 px-3">County</th>
                  <th className="py-2.5 px-3">Hazard Type</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">12M Crashes</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {filteredSpots.length > 0 ? (
                  filteredSpots.map((spot) => (
                    <tr key={spot.id} className="hover:bg-surface-container-low/50">
                      <td className="py-3 px-3 font-bold text-on-surface">{spot.name || spot.title}</td>
                      <td className="py-3 px-3 text-on-surface-variant">{spot.routeName}</td>
                      <td className="py-3 px-3 font-label-mono">{spot.county || 'Nairobi'}</td>
                      <td className="py-3 px-3 uppercase text-[11px] font-label-mono text-outline">
                        {spot.hazardType || 'accident_prone'}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={spot.severity === 'critical' ? 'danger' : 'warning'}>
                          {spot.severity.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-label-mono font-bold text-rose-600">
                        {spot.accidentCount12M ?? 0}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="success">VERIFIED & LIVE</Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr key="empty">
                    <td colSpan={7} className="py-8">
                      <EmptyState
                        title="No Black Spots Registered"
                        description="No official black spots registered yet."
                        icon="report_problem"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Pending Verification Queue */}
        {activeTab === 'queue' && (
          <div className="space-y-sm">
            {pendingSpots.length > 0 ? (
              pendingSpots.map((spot) => (
                <div
                  key={spot.id}
                  className="p-md rounded-xl border border-outline-variant/30 bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-md"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs text-on-surface">{spot.name || spot.title}</h4>
                      <Badge variant="warning">USER REPORTED</Badge>
                    </div>
                    <p className="font-body-sm text-[11px] text-on-surface-variant">
                      {spot.routeName} • Reported Description: {spot.hazardDescription || spot.description}
                    </p>
                    <div className="text-[10px] font-label-mono text-outline flex items-center gap-3">
                      <span>Corroborated by {spot.corroborationCount || 3} Commuters</span>
                      <span>Confidence Score: {((spot.confidenceScore || 0.82) * 100).toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleVerifySpot(spot.id, true)}
                      className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <span className="material-symbols-outlined text-base">check</span>
                      Approve & Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleVerifySpot(spot.id, false)}
                      className="gap-1 text-rose-600 hover:text-rose-700"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-xl text-center text-on-surface-variant space-y-2">
                <span className="material-symbols-outlined text-3xl text-emerald-600">
                  verified
                </span>
                <p className="font-label-bold text-xs">All user hazard reports have been processed!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add New Official Black Spot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <form
            onSubmit={handleCreateSpot}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl max-w-lg w-full p-lg shadow-2xl space-y-md animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">
                  add_location_alt
                </span>
                <h3 className="font-headline-lg-mobile text-base text-on-surface">
                  Publish Official NTSA Black Spot Geofence
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-sm text-xs font-body-sm">
              <div>
                <label htmlFor="blackspot-name-input" className="font-label-bold text-on-surface">Hazard / Location Title</label>
                <input
                  id="blackspot-name-input"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. A104 Waiyaki Way Blackspot"
                  required
                  className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <div>
                  <label htmlFor="blackspot-route-input" className="font-label-bold text-on-surface">Route / Corridor</label>
                  <input
                    id="blackspot-route-input"
                    type="text"
                    value={formRoute}
                    onChange={(e) => setFormRoute(e.target.value)}
                    placeholder="e.g. Nairobi - Nakuru Highway"
                    required
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label htmlFor="blackspot-county-select" className="font-label-bold text-on-surface">County</label>
                  <select
                    id="blackspot-county-select"
                    value={formCounty}
                    onChange={(e) => setFormCounty(e.target.value)}
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
                  >
                    <option value="Nairobi">Nairobi</option>
                    <option value="Kiambu">Kiambu</option>
                    <option value="Machakos">Machakos</option>
                    <option value="Nakuru">Nakuru</option>
                    <option value="Mombasa">Mombasa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <div>
                  <label htmlFor="blackspot-lat-input" className="font-label-bold text-on-surface">Latitude</label>
                  <input
                    id="blackspot-lat-input"
                    type="text"
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
                  />
                </div>
                <div>
                  <label htmlFor="blackspot-lng-input" className="font-label-bold text-on-surface">Longitude</label>
                  <input
                    id="blackspot-lng-input"
                    type="text"
                    value={formLng}
                    onChange={(e) => setFormLng(e.target.value)}
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <div>
                  <label htmlFor="blackspot-severity-select" className="font-label-bold text-on-surface">Severity</label>
                  <select
                    id="blackspot-severity-select"
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value as SeverityLevel)}
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="low">Low Risk</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="blackspot-hazard-select" className="font-label-bold text-on-surface">Hazard Type</label>
                  <select
                    id="blackspot-hazard-select"
                    value={formHazardType}
                    onChange={(e) => setFormHazardType(e.target.value as HazardType)}
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
                  >
                    <option value="accident_prone">Accident Prone Spot</option>
                    <option value="unmarked_bump">Unmarked Bump</option>
                    <option value="pothole">Severe Pothole Cluster</option>
                    <option value="poor_lighting">Poor Lighting / Dark Corridor</option>
                    <option value="flash_flooding">Flash Flooding Risk</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="blackspot-notes-textarea" className="font-label-bold text-on-surface">Inspector Advisory Notes</label>
                <textarea
                  id="blackspot-notes-textarea"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Mandatory audio warning message for driver & passenger apps..."
                  className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-sm border-t border-outline-variant/20">
              <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Publish Advisory
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
