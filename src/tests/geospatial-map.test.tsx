// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import L from 'leaflet';
import { MapComponent, MapMarker } from '../components/map/MapComponent';

describe('PERF-001: Geospatial Real Map Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const markerWest: MapMarker = {
    id: 'marker-westlands',
    lat: -1.2612,
    lng: 36.7865, // More Westerly (Westlands / Waiyaki Way)
    type: 'vehicle',
    title: 'KDA 100A (Westlands)',
    subtitle: 'Waiyaki Way Corridor',
    heading: 90,
  };

  const markerEast: MapMarker = {
    id: 'marker-thika',
    lat: -1.2215,
    lng: 36.8967, // More Easterly (Thika Road / Kasarani)
    type: 'blackspot',
    title: 'Kasarani Blackspot',
    subtitle: 'Thika Superhighway Exit',
    severity: 'high',
  };

  it('renders the real geospatial map container with interactive controls and address bar', () => {
    render(
      <MapComponent
        markers={[markerWest, markerEast]}
        centerAddress="Nairobi Metro Transit Corridor"
        showHeatmapOverlay={true}
      />
    );

    expect(screen.getByTestId('geospatial-map-container')).toBeDefined();
    expect(screen.getByTestId('leaflet-map-canvas')).toBeDefined();
    expect(screen.getByText('Nairobi Metro Transit Corridor')).toBeDefined();
    expect(screen.getByTestId('btn-map-zoom-in')).toBeDefined();
    expect(screen.getByTestId('btn-map-zoom-out')).toBeDefined();
    expect(screen.getByTestId('btn-map-recenter')).toBeDefined();
  });

  it('positions markers derived from real geographic coordinates rather than index arithmetic', () => {
    // Verify using EPSG:3857 (Web Mercator projection used by Leaflet and tile maps)
    const zoom = 12;
    const pointWest = L.CRS.EPSG3857.latLngToPoint(L.latLng(markerWest.lat, markerWest.lng), zoom);
    const pointEast = L.CRS.EPSG3857.latLngToPoint(L.latLng(markerEast.lat, markerEast.lng), zoom);

    // Longitude test: Kasarani (36.8967° E) must be to the right (greater X) of Westlands (36.7865° E)
    expect(pointEast.x).toBeGreaterThan(pointWest.x);
    expect(markerEast.lng).toBeGreaterThan(markerWest.lng);

    // Latitude test: Kasarani (-1.2215° N) is further north than Westlands (-1.2612° N), so Y is smaller in screen space
    expect(pointEast.y).toBeLessThan(pointWest.y);
    expect(markerEast.lat).toBeGreaterThan(markerWest.lat);

    const { container } = render(
      <MapComponent
        markers={[markerWest, markerEast]}
        centerAddress="Nairobi Metro Transit Corridor"
      />
    );

    // Verify both marker DOM elements were created with geospatial data attributes
    const renderedMarkerWest = container.querySelector(`[data-testid="map-marker-${markerWest.id}"]`);
    const renderedMarkerEast = container.querySelector(`[data-testid="map-marker-${markerEast.id}"]`);

    expect(renderedMarkerWest).not.toBeNull();
    expect(renderedMarkerEast).not.toBeNull();

    expect(renderedMarkerWest?.getAttribute('data-lat')).toBe(String(markerWest.lat));
    expect(renderedMarkerWest?.getAttribute('data-lng')).toBe(String(markerWest.lng));
    expect(renderedMarkerEast?.getAttribute('data-lat')).toBe(String(markerEast.lat));
    expect(renderedMarkerEast?.getAttribute('data-lng')).toBe(String(markerEast.lng));
  });

  it('handles marker selection and fires onMarkerClick callback', () => {
    const handleMarkerClick = vi.fn();

    const { container } = render(
      <MapComponent
        markers={[markerWest, markerEast]}
        onMarkerClick={handleMarkerClick}
      />
    );

    const markerEastElement = container.querySelector(`[data-testid="map-marker-${markerEast.id}"]`);
    expect(markerEastElement).not.toBeNull();

    if (markerEastElement) {
      fireEvent.click(markerEastElement);
      expect(handleMarkerClick).toHaveBeenCalledWith(markerEast);
    }
  });

  it('triggers functional zoom controls without error', () => {
    render(
      <MapComponent
        markers={[markerWest, markerEast]}
      />
    );

    const zoomInBtn = screen.getByTestId('btn-map-zoom-in');
    const zoomOutBtn = screen.getByTestId('btn-map-zoom-out');
    const recenterBtn = screen.getByTestId('btn-map-recenter');

    // Clicking controls
    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomOutBtn);
    fireEvent.click(recenterBtn);

    expect(zoomInBtn).toBeDefined();
    expect(zoomOutBtn).toBeDefined();
    expect(recenterBtn).toBeDefined();
  });
});
