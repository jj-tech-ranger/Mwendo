import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: 'vehicle' | 'blackspot' | 'incident';
  title: string;
  subtitle?: string;
  heading?: number; // degrees for vehicle icon orientation
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
  markers = [
    {
      id: 'm1',
      lat: -1.286389,
      lng: 36.817223,
      type: 'vehicle',
      title: 'KDA 123A (MetroLink)',
      subtitle: '62 km/h - Thika Road',
      heading: 45,
    },
    {
      id: 'm2',
      lat: -1.25,
      lng: 36.89,
      type: 'blackspot',
      title: 'Unmarked Bump - Mombasa Rd',
      subtitle: 'Confirmed by 14 commuters',
      severity: 'high',
    },
  ],
  showRouteTrace = true,
  showHeatmapOverlay = true,
  centerAddress = 'Nairobi Metro Corridor',
  onMarkerClick,
  className,
}) => {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(markers[0] || null);

  const handleSelect = (m: MapMarker) => {
    setSelectedMarker(m);
    if (onMarkerClick) onMarkerClick(m);
  };

  return (
    <div className={cn('relative w-full h-[380px] rounded-2xl overflow-hidden border border-outline-variant/30 shadow-sm bg-surface-container-high select-none', className)}>
      {/* Canvas Mock Map Background with Grid and Soft Gradient Roads */}
      <div className="absolute inset-0 bg-[#e8f0ec] dark:bg-[#1a261f] transition-colors overflow-hidden">
        {/* Subtle Map Grid lines */}
        <div
          className="absolute inset-0 opacity-20 dark:opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(to right, #2a4c38 1px, transparent 1px), linear-gradient(to bottom, #2a4c38 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Heatmap gradient overlay */}
        {showHeatmapOverlay && (
          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 w-64 h-64 bg-amber-500/20 dark:bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        )}

        {/* Route trace curve line */}
        {showRouteTrace && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-80">
            <path
              d="M 50 300 Q 200 150 450 180 T 700 80"
              fill="none"
              stroke="#1A5C2E"
              strokeWidth="5"
              strokeDasharray="8 4"
            />
          </svg>
        )}

        {/* Interactive Map Pins */}
        {markers.map((m, idx) => {
          // Calculate relative position simulation
          const leftPct = 25 + (idx * 35) % 60;
          const topPct = 30 + (idx * 25) % 50;

          return (
            <button
              key={m.id}
              onClick={() => handleSelect(m)}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              className={cn(
                'absolute transform -translate-x-1/2 -translate-y-1/2 p-2 rounded-full transition-transform active:scale-95 cursor-pointer shadow-lg flex items-center justify-center',
                m.type === 'vehicle'
                  ? 'bg-primary text-on-primary ring-4 ring-primary/20'
                  : m.severity === 'high'
                  ? 'bg-rose-600 text-white ring-4 ring-rose-500/30 animate-pulse'
                  : 'bg-amber-500 text-black'
              )}
            >
              <span className="material-symbols-outlined text-lg">
                {m.type === 'vehicle'
                  ? 'directions_bus'
                  : m.type === 'blackspot'
                  ? 'warning'
                  : 'report_problem'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Top Floating Address Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-auto">
        <div className="bg-surface-bright/90 backdrop-blur-md border border-outline-variant/30 px-3 py-1.5 rounded-full text-xs font-label-mono font-medium text-on-surface shadow-md flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">location_on</span>
          <span>{centerAddress}</span>
        </div>
        <div className="flex items-center gap-1">
          {showHeatmapOverlay && <Badge variant="warning">Heatmap Active</Badge>}
        </div>
      </div>

      {/* Floating Zoom & Location Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 pointer-events-auto">
        <button className="w-9 h-9 bg-surface-bright/90 backdrop-blur-md rounded-xl border border-outline-variant/30 flex items-center justify-center text-on-surface hover:bg-surface-container shadow-md">
          <span className="material-symbols-outlined text-lg">add</span>
        </button>
        <button className="w-9 h-9 bg-surface-bright/90 backdrop-blur-md rounded-xl border border-outline-variant/30 flex items-center justify-center text-on-surface hover:bg-surface-container shadow-md">
          <span className="material-symbols-outlined text-lg">remove</span>
        </button>
        <button className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center shadow-md hover:bg-primary/90">
          <span className="material-symbols-outlined text-lg">my_location</span>
        </button>
      </div>

      {/* Selected Marker Popup Card */}
      {selectedMarker && (
        <div className="absolute bottom-4 left-4 right-16 bg-surface-bright/95 backdrop-blur-md p-md rounded-xl border border-outline-variant/30 shadow-xl space-y-1 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex justify-between items-start">
            <h5 className="font-headline-lg-mobile text-xs text-on-surface font-bold truncate">
              {selectedMarker.title}
            </h5>
            <button
              onClick={() => setSelectedMarker(null)}
              className="text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
          {selectedMarker.subtitle && (
            <p className="font-body-sm text-[11px] text-on-surface-variant">
              {selectedMarker.subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
