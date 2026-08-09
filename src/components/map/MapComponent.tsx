import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: 'vehicle' | 'blackspot' | 'incident';
  title: string;
  subtitle?: string;
  heading?: number;
  severity?: 'low' | 'medium' | 'high';
}

export interface MapComponentProps {
  markers?: MapMarker[];
  showRouteTrace?: boolean;
  showHeatmapOverlay?: boolean;
  centerAddress?: string;
  onMarkerClick?: (marker: MapMarker) => void;
  className?: string;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  markers = [],
  showRouteTrace = false,
  showHeatmapOverlay = false,
  centerAddress = 'Nairobi',
  onMarkerClick,
  className,
}) => {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  useEffect(() => {
    if (!selectedMarker) return;
    const exists = markers.some((marker) => marker.id === selectedMarker.id);
    if (!exists) setSelectedMarker(null);
  }, [markers, selectedMarker]);

  const handleSelect = (m: MapMarker) => {
    setSelectedMarker(m);
    onMarkerClick?.(m);
  };

  return (
    <div className={cn('relative w-full h-[380px] rounded-2xl overflow-hidden border border-outline-variant/30 shadow-sm bg-surface-container-high', className)}>
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
        <div className="bg-surface-bright/90 backdrop-blur-md border border-outline-variant/30 px-3 py-1.5 rounded-full text-xs font-label-mono font-medium text-on-surface shadow-md flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">location_on</span>
          <span>{centerAddress}</span>
        </div>
        <div className="flex items-center gap-1">
          {showHeatmapOverlay && <Badge variant="warning">Heatmap</Badge>}
          {showRouteTrace && <Badge variant="info">Route Trace</Badge>}
        </div>
      </div>

      <div className="h-full pt-14 p-4">
        {markers.length === 0 ? (
          <div className="h-full rounded-xl border border-dashed border-outline-variant/40 bg-surface-container flex flex-col items-center justify-center text-center p-4">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant">map</span>
            <p className="text-sm font-bold text-on-surface mt-2">No map data available</p>
            <p className="text-xs text-on-surface-variant mt-1">Markers will appear when verified trips, alerts, or hazards are recorded.</p>
          </div>
        ) : (
          <div className="h-full rounded-xl border border-outline-variant/20 bg-surface-container p-3 overflow-auto space-y-2">
            {markers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                onClick={() => handleSelect(marker)}
                className="w-full text-left p-3 rounded-xl border border-outline-variant/20 hover:bg-surface-container-high transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-xs text-on-surface">{marker.title}</div>
                  <Badge
                    variant={
                      marker.severity === 'high'
                        ? 'danger'
                        : marker.severity === 'medium'
                        ? 'warning'
                        : 'info'
                    }
                  >
                    {marker.type}
                  </Badge>
                </div>
                {marker.subtitle && <p className="text-[11px] text-on-surface-variant mt-1">{marker.subtitle}</p>}
                <p className="text-[10px] text-outline mt-1 font-label-mono">
                  {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedMarker && (
        <div className="absolute bottom-4 left-4 right-4 bg-surface-bright/95 backdrop-blur-md p-md rounded-xl border border-outline-variant/30 shadow-xl space-y-1">
          <div className="flex justify-between items-start">
            <h5 className="font-headline-lg-mobile text-xs text-on-surface font-bold truncate">{selectedMarker.title}</h5>
            <button onClick={() => setSelectedMarker(null)} className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
          {selectedMarker.subtitle && <p className="font-body-sm text-[11px] text-on-surface-variant">{selectedMarker.subtitle}</p>}
        </div>
      )}
    </div>
  );
};
