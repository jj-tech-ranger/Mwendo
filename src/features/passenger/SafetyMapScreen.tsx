import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { severityToBadgeVariant } from '../../lib/severity';
import { publicPinRepository } from '../../repositories';
import { useToast } from '../../components/ui/Toast';
import { MapComponent, MapMarker } from '../../components/map/MapComponent';
import { HazardConfirmationSheet } from './components/HazardConfirmationSheet';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

interface HazardPin {
  id: string;
  title: string;
  type: 'blackspot' | 'hotspot' | 'danger_zone' | 'police' | 'hospital';
  severity: 'high' | 'medium' | 'low';
  locationName: string;
  corroborationCount: number;
  description: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
}

export const SafetyMapScreen: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [selectedHazard, setSelectedHazard] = useState<HazardPin | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'hazards' | 'emergency'>('all');
  const [mapViewMode, setMapViewMode] = useState<'markers' | 'heatmap'>('markers');

  const { data: hazards = [], isLoading } = useQuery({
    queryKey: ['publicPinHazards'],
    queryFn: async () => {
      const pins = await publicPinRepository.getAll();
      const mapped: HazardPin[] = pins.map((pinRecord, idx: number) => {
        const p = pinRecord as Record<string, unknown>;
        const title = (p.title as string) || (p.name as string) || 'Hazardous Location';
        const rawType = p.type as string | undefined;
        const rawSeverity = (p.severity as string) || 'high';
        return {
          id: String(p.id || `pin_${idx}`),
          title,
          type:
            rawType === 'hospital' || rawType === 'police' || rawType === 'hotspot' || rawType === 'danger_zone'
              ? rawType
              : 'blackspot',
          severity: rawSeverity === 'critical' ? 'high' : (rawSeverity as 'low' | 'medium' | 'high'),
          locationName: (p.routeName as string) || (p.locationName as string) || 'Corridor',
          corroborationCount: Number(p.corroborationCount || p.corroborationsCount || 0),
          description: (p.description as string) || 'Verified public safety hazard location.',
          distanceKm: 1.0 + idx * 0.8,
          latitude: typeof p.latitude === 'number' ? p.latitude : -1.286389 + (idx % 3) * 0.02,
          longitude: typeof p.longitude === 'number' ? p.longitude : 36.817223 + (idx % 3) * 0.02,
        };
      });

      return mapped;
    },
    staleTime: QUERY_STALE_TIMES.SAFETY_ALERTS,
  });

  const filteredHazards = useMemo(() => {
    return hazards.filter((h) => {
      if (activeCategory === 'hazards' && (h.type === 'hospital' || h.type === 'police')) return false;
      if (activeCategory === 'emergency' && h.type !== 'hospital' && h.type !== 'police') return false;
      if (searchQuery) {
        return (
          h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.locationName.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      return true;
    });
  }, [hazards, activeCategory, searchQuery]);

  // Convert hazards to MapMarker format for the real geospatial map
  const mapMarkers: MapMarker[] = useMemo(() => {
    return filteredHazards.map((h) => ({
      id: h.id,
      lat: h.latitude,
      lng: h.longitude,
      type: h.type === 'hospital' || h.type === 'police' ? 'incident' : 'blackspot',
      title: h.title,
      subtitle: `${h.locationName} • ${h.severity.toUpperCase()} RISK`,
      severity: h.severity,
    }));
  }, [filteredHazards]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Search Header Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-on-surface">{t('passenger.map.title')}</h1>
          <Button
            size="sm"
            onClick={() => navigate('/passenger/report-blackspot')}
            className="text-xs font-bold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">add_location_alt</span>
            {t('passenger.map.reportHazard')}
          </Button>
        </div>

        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('passenger.map.searchPlaceholder')}
          className="text-xs bg-surface shadow-sm"
        />
      </div>

      {/* Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            activeCategory === 'all'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          {t('passenger.map.catAll')}
        </button>
        <button
          onClick={() => setActiveCategory('hazards')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            activeCategory === 'hazards'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          {t('passenger.map.catHazards')}
        </button>
        <button
          onClick={() => setActiveCategory('emergency')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            activeCategory === 'emergency'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          {t('passenger.map.catEmergency')}
        </button>
      </div>

      {/* Map View Mode Switcher: Markers vs Heat Map */}
      <div className="flex items-center justify-between bg-surface-container/60 p-2 rounded-xl border border-outline-variant/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">layers</span>
            Layer View
          </span>
          {mapViewMode === 'heatmap' && (
            <Badge variant="danger" className="text-[10px] font-bold">
              Density Heat-Map
            </Badge>
          )}
        </div>
        <div className="flex items-center bg-surface-container-high p-0.5 rounded-lg text-xs" role="tablist" aria-label="Map View Mode">
          <button
            id="btn-view-markers"
            data-testid="btn-view-markers"
            type="button"
            role="tab"
            aria-selected={mapViewMode === 'markers'}
            onClick={() => setMapViewMode('markers')}
            className={`px-3 py-1 rounded-md font-bold flex items-center gap-1 transition-all cursor-pointer ${
              mapViewMode === 'markers'
                ? 'bg-surface text-on-surface shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">location_on</span>
            Markers
          </button>
          <button
            id="btn-view-heatmap"
            data-testid="btn-view-heatmap"
            type="button"
            role="tab"
            aria-selected={mapViewMode === 'heatmap'}
            onClick={() => setMapViewMode('heatmap')}
            className={`px-3 py-1 rounded-md font-bold flex items-center gap-1 transition-all cursor-pointer ${
              mapViewMode === 'heatmap'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">local_fire_department</span>
            Heat Map
          </button>
        </div>
      </div>

      {/* Real Geospatial Map Component */}
      <MapComponent
        markers={mapMarkers}
        centerAddress="Kenya Transit Safety Corridor"
        showHeatmapOverlay={true}
        showRouteTrace={false}
        viewMode={mapViewMode}
        onViewModeChange={setMapViewMode}
        onMarkerClick={(m) => {
          const matched = filteredHazards.find((h) => h.id === m.id);
          if (matched) setSelectedHazard(matched);
        }}
        className="h-80 shadow-md"
      />

      {/* Hazards & Services List */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant">
          Nearby Road Hazards & Services
        </h2>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-on-surface-variant font-mono">
            {t('passenger.map.loading')}
          </div>
        ) : filteredHazards.length === 0 ? (
          <div className="p-8 text-center text-xs text-on-surface-variant font-mono">
            {t('passenger.map.noHazardsFound')}
          </div>
        ) : (
          filteredHazards.map((item) => (
            <Card
              key={item.id}
              onClick={() => setSelectedHazard(item)}
              className="p-4 cursor-pointer hover:bg-surface-container-high/50 transition-colors space-y-2 border border-outline-variant/30"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <span
                      className={`p-1 rounded-md text-white text-xs ${
                        item.type === 'hospital'
                          ? 'bg-blue-600'
                          : item.type === 'police'
                          ? 'bg-indigo-600'
                          : item.severity === 'high'
                          ? 'bg-error'
                          : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm block">
                        {item.type === 'hospital'
                          ? 'local_hospital'
                          : item.type === 'police'
                          ? 'local_police'
                          : 'warning'}
                      </span>
                    </span>
                    <span>{item.title}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">{item.locationName}</p>
                </div>

                <Badge
                  variant={
                    item.type === 'hospital' || item.type === 'police'
                      ? 'neutral'
                      : severityToBadgeVariant(item.severity)
                  }
                  className="text-[10px] font-bold"
                >
                  {t('passenger.map.distanceAway', { distance: item.distanceKm })}
                </Badge>
              </div>

              <p className="text-xs text-on-surface-variant line-clamp-2">{item.description}</p>
            </Card>
          ))
        )}
      </div>

      {/* Waze-style Crowdsourced Confirmation Sheet for Black Spots / Hazards */}
      {selectedHazard && selectedHazard.type !== 'hospital' && selectedHazard.type !== 'police' && (
        <HazardConfirmationSheet
          isOpen={!!selectedHazard}
          onClose={() => setSelectedHazard(null)}
          hazardId={selectedHazard.id}
          hazardTitle={selectedHazard.title}
          locationName={selectedHazard.locationName}
          severity={selectedHazard.severity}
          description={selectedHazard.description}
          distanceKm={selectedHazard.distanceKm}
        />
      )}

      {/* Emergency Facility (Hospital / Police) Inspector Dialog */}
      {selectedHazard && (selectedHazard.type === 'hospital' || selectedHazard.type === 'police') && (
        <Dialog
          isOpen={!!selectedHazard}
          onClose={() => setSelectedHazard(null)}
          title={selectedHazard?.title || 'Emergency Facility'}
        >
          <div className="space-y-4 text-xs text-on-surface">
            <div className="bg-surface-container p-3 rounded-xl space-y-1">
              <div className="font-bold text-sm text-primary">{selectedHazard.locationName}</div>
              <div className="text-on-surface-variant text-[11px]">
                {t('passenger.map.distanceAway', { distance: selectedHazard.distanceKm })}
              </div>
            </div>

            <p className="text-on-surface-variant leading-relaxed">{selectedHazard.description}</p>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => setSelectedHazard(null)}
              >
                {t('passenger.map.close')}
              </Button>
              <Button
                className="flex-1 text-xs font-bold"
                onClick={() => {
                  showToast('info', 'Route Guidance', `Navigating to ${selectedHazard.title}`);
                  setSelectedHazard(null);
                }}
              >
                {t('passenger.map.routeGuidance')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
