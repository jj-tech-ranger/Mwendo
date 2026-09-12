import L from 'leaflet';

// Ensure Leaflet global is present for leaflet.heat plugin
if (typeof window !== 'undefined' && !(window as unknown as { L?: typeof L }).L) {
  (window as unknown as { L: typeof L }).L = L;
}

// Leaflet.heat plugin attaches heatLayer to L
import 'leaflet.heat';

export default L;
export type { HeatLatLngTuple, HeatMapOptions } from 'leaflet';
