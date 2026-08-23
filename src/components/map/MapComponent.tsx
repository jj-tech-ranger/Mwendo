import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';

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
  markers?: MapMarker[] | undefined;
  showRouteTrace?: boolean | undefined;
  showHeatmapOverlay?: boolean | undefined;
  centerAddress?: string | undefined;
  initialCenter?: { lat: number; lng: number } | undefined;
  initialZoom?: number | undefined;
  onMarkerClick?: ((marker: MapMarker) => void) | undefined;
  className?: string | undefined;
  enablePinDrop?: boolean | undefined;
  onPinDrop?: ((coords: { lat: number; lng: number }) => void) | undefined;
  pinnedLocation?: { lat: number; lng: number } | null | undefined;
}

const DEFAULT_CENTER: [number, number] = [-1.286389, 36.817223]; // Nairobi Metro Corridor
const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL ||
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

const createCustomIcon = (marker: MapMarker, isSelected: boolean) => {
  const isVehicle = marker.type === 'vehicle';
  const isHighSeverity = marker.severity === 'high' || marker.type === 'incident';

  let bgClass = 'bg-amber-500 text-black ring-4 ring-amber-500/20';
  let iconName = 'warning';

  if (isVehicle) {
    bgClass = 'bg-[#00431b] text-white ring-4 ring-[#00431b]/25';
    iconName = 'directions_bus';
  } else if (isHighSeverity) {
    bgClass = 'bg-rose-600 text-white ring-4 ring-rose-500/30 animate-pulse';
    iconName = marker.type === 'incident' ? 'report_problem' : 'warning';
  }

  const rotation = marker.heading ? `transform: rotate(${marker.heading}deg);` : '';

  return L.divIcon({
    className: 'custom-leaflet-marker-wrapper',
    html: `
      <div 
        id="map-marker-${marker.id}"
        data-testid="map-marker-${marker.id}"
        data-lat="${marker.lat}"
        data-lng="${marker.lng}"
        data-marker-type="${marker.type}"
        data-marker-title="${marker.title}"
        class="w-9 h-9 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-95 ${bgClass} ${
      isSelected ? 'scale-115 ring-4 ring-primary shadow-xl' : ''
    }"
        style="${rotation}"
        title="${marker.title}"
      >
        <span class="material-symbols-outlined text-lg leading-none select-none">${iconName}</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

export const MapComponent: React.FC<MapComponentProps> = ({
  markers = [],
  showRouteTrace = false,
  showHeatmapOverlay = true,
  centerAddress = 'Nairobi Metro Corridor',
  initialCenter,
  initialZoom = 12,
  onMarkerClick,
  className,
  enablePinDrop = false,
  onPinDrop,
  pinnedLocation = null,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);

  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(markers[0] || null);

  const handleSelectMarker = useCallback(
    (marker: MapMarker) => {
      setSelectedMarker(marker);
      if (onMarkerClick) {
        onMarkerClick(marker);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo([marker.lat, marker.lng], { animate: true, duration: 0.5 });
      }
    },
    [onMarkerClick]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const firstMarker = markers[0];
    const startCenter: [number, number] = pinnedLocation
      ? [pinnedLocation.lat, pinnedLocation.lng]
      : initialCenter
      ? [initialCenter.lat, initialCenter.lng]
      : firstMarker
      ? [firstMarker.lat, firstMarker.lng]
      : DEFAULT_CENTER;

    const map = L.map(mapContainerRef.current, {
      center: startCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    // Layer Groups
    markersLayerRef.current = L.layerGroup().addTo(map);
    heatmapLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Invalidate size after mount / container paint
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      heatmapLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, [initialCenter, initialZoom, pinnedLocation]);

  // Click listener for manual pin dropping
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !enablePinDrop) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      onPinDrop?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [enablePinDrop, onPinDrop]);

  // Update Markers, Heatmaps, and Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current || !heatmapLayerRef.current) return;

    // Clear previous layers
    markersLayerRef.current.clearLayers();
    heatmapLayerRef.current.clearLayers();
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    // Add Pinned Location Marker if manual pin drop or active selection
    if (pinnedLocation) {
      const pinIcon = L.divIcon({
        className: 'custom-leaflet-pin-marker-wrapper',
        html: `
          <div 
            id="map-marker-dropped-pin"
            data-testid="map-marker-dropped-pin"
            data-lat="${pinnedLocation.lat}"
            data-lng="${pinnedLocation.lng}"
            class="w-10 h-10 rounded-full shadow-2xl flex items-center justify-center cursor-pointer bg-rose-600 text-white ring-4 ring-rose-500/40 animate-bounce"
            title="Selected Hazard Location"
          >
            <span class="material-symbols-outlined text-2xl leading-none select-none">location_on</span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 36],
      });
      const pinMarker = L.marker([pinnedLocation.lat, pinnedLocation.lng], { icon: pinIcon });
      pinMarker.addTo(markersLayerRef.current!);
    }

    // Add Markers
    markers.forEach((m) => {
      const isSelected = selectedMarker?.id === m.id;
      const icon = createCustomIcon(m, isSelected);
      const leafletMarker = L.marker([m.lat, m.lng], { icon });

      leafletMarker.on('click', () => {
        handleSelectMarker(m);
      });

      leafletMarker.addTo(markersLayerRef.current!);

      // Heatmap danger radius overlays
      if (showHeatmapOverlay && (m.type === 'blackspot' || m.type === 'incident')) {
        const isCritical = m.severity === 'high' || m.type === 'incident';
        const circle = L.circle([m.lat, m.lng], {
          radius: isCritical ? 750 : 450,
          color: isCritical ? '#e11d48' : '#f59e0b',
          fillColor: isCritical ? '#e11d48' : '#f59e0b',
          fillOpacity: 0.18,
          weight: 1.5,
          opacity: 0.4,
        });
        circle.addTo(heatmapLayerRef.current!);
      }
    });

    // Add Route Polyline
    if (showRouteTrace && markers.length > 1) {
      const latlngs: [number, number][] = markers.map((m) => [m.lat, m.lng]);
      const polyline = L.polyline(latlngs, {
        color: '#00431b',
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 6',
      }).addTo(map);
      routeLayerRef.current = polyline;
    }

    // Auto-fit bounds if multiple markers exist
    const firstMarker = markers[0];
    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
    } else if (pinnedLocation) {
      map.setView([pinnedLocation.lat, pinnedLocation.lng], initialZoom);
    } else if (firstMarker && !initialCenter) {
      map.setView([firstMarker.lat, firstMarker.lng], initialZoom);
    }
  }, [markers, showHeatmapOverlay, showRouteTrace, selectedMarker?.id, handleSelectMarker, initialCenter, initialZoom, pinnedLocation]);

  // Zoom / Location Control Handlers
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    const firstMarker = markers[0];
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          mapInstanceRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 14);
        },
        () => {
          if (firstMarker) {
            mapInstanceRef.current?.flyTo([firstMarker.lat, firstMarker.lng], 13);
          } else {
            mapInstanceRef.current?.flyTo(DEFAULT_CENTER, 12);
          }
        }
      );
    } else if (firstMarker) {
      mapInstanceRef.current.flyTo([firstMarker.lat, firstMarker.lng], 13);
    } else {
      mapInstanceRef.current.flyTo(DEFAULT_CENTER, 12);
    }
  };

  return (
    <div
      id="geospatial-map-container"
      data-testid="geospatial-map-container"
      className={cn(
        'relative w-full h-[380px] rounded-2xl overflow-hidden border border-outline-variant/30 shadow-sm bg-surface-container-high select-none',
        className
      )}
    >
      {/* Real Tile-based Leaflet Geospatial Map Container */}
      <div
        ref={mapContainerRef}
        id="leaflet-map-canvas"
        data-testid="leaflet-map-canvas"
        className="absolute inset-0 w-full h-full z-0 bg-[#e8f0ec] dark:bg-[#1a261f]"
      />

      {/* Top Floating Address Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-auto z-10">
        <div className="bg-surface-bright/90 backdrop-blur-md border border-outline-variant/30 px-3 py-1.5 rounded-full text-xs font-label-mono font-medium text-on-surface shadow-md flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">location_on</span>
          <span className="truncate max-w-[200px] sm:max-w-xs">{centerAddress}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {enablePinDrop && (
            <span
              id="map-pin-drop-badge"
              data-testid="map-pin-drop-badge"
              className="bg-rose-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow flex items-center gap-1 animate-pulse"
            >
              <span className="material-symbols-outlined text-xs">touch_app</span>
              {pinnedLocation ? 'Pin Placed' : 'Tap Map to Pin'}
            </span>
          )}
          {showHeatmapOverlay && (
            <Badge variant="warning" className="shadow-sm">
              Heatmap Active
            </Badge>
          )}
          <span className="text-[10px] font-mono font-bold bg-surface-bright/80 backdrop-blur-xs px-2 py-1 rounded-full border border-outline-variant/20 text-on-surface-variant hidden sm:inline-block">
            {markers.length} Pins Live
          </span>
        </div>
      </div>

      {/* Floating Functional Zoom & Location Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 pointer-events-auto z-10">
        <button
          type="button"
          id="btn-map-zoom-in"
          data-testid="btn-map-zoom-in"
          onClick={handleZoomIn}
          title="Zoom In"
          aria-label="Zoom In"
          className="w-9 h-9 bg-surface-bright/95 backdrop-blur-md rounded-xl border border-outline-variant/30 flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 shadow-md cursor-pointer transition-all"
        >
          <span className="material-symbols-outlined text-lg leading-none">add</span>
        </button>
        <button
          type="button"
          id="btn-map-zoom-out"
          data-testid="btn-map-zoom-out"
          onClick={handleZoomOut}
          title="Zoom Out"
          aria-label="Zoom Out"
          className="w-9 h-9 bg-surface-bright/95 backdrop-blur-md rounded-xl border border-outline-variant/30 flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 shadow-md cursor-pointer transition-all"
        >
          <span className="material-symbols-outlined text-lg leading-none">remove</span>
        </button>
        <button
          type="button"
          id="btn-map-recenter"
          data-testid="btn-map-recenter"
          onClick={handleRecenter}
          title="Recenter Map"
          aria-label="Recenter Map"
          className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center shadow-md hover:bg-primary/90 active:scale-95 cursor-pointer transition-all"
        >
          <span className="material-symbols-outlined text-lg leading-none">my_location</span>
        </button>
      </div>

      {/* Selected Marker Popup Card */}
      {selectedMarker && (
        <div
          id={`map-popup-card-${selectedMarker.id}`}
          data-testid={`map-popup-card-${selectedMarker.id}`}
          className="absolute bottom-4 left-4 right-16 bg-surface-bright/95 backdrop-blur-md p-3 rounded-xl border border-outline-variant/30 shadow-xl space-y-1 z-10 animate-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-1.5 truncate">
              <span
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  selectedMarker.type === 'vehicle'
                    ? 'bg-primary'
                    : selectedMarker.severity === 'high'
                    ? 'bg-rose-600 animate-pulse'
                    : 'bg-amber-500'
                )}
              />
              <h5 className="font-headline-lg-mobile text-xs text-on-surface font-bold truncate">
                {selectedMarker.title}
              </h5>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMarker(null)}
              className="text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
          {selectedMarker.subtitle && (
            <p className="font-body-sm text-[11px] text-on-surface-variant line-clamp-1">
              {selectedMarker.subtitle}
            </p>
          )}
          <div className="flex items-center justify-between text-[10px] font-mono text-outline pt-0.5 border-t border-outline-variant/10">
            <span>
              {selectedMarker.lat.toFixed(5)}, {selectedMarker.lng.toFixed(5)}
            </span>
            <span className="uppercase font-bold text-primary">{selectedMarker.type}</span>
          </div>
        </div>
      )}
    </div>
  );
};
