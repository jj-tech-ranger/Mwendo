import { create } from 'zustand';
import { Trip, GPSPoint } from '../types';
import { useAuthStore } from './useAuthStore';

export const ACTIVE_TRIP_STORAGE_KEY = 'mwendo.activeTrip.v1';
const TELEMETRY_PERSIST_INTERVAL_MS = 5000;

interface PersistedTripState {
  activeTrip: Trip | null;
  isTracking: boolean;
  isPaused: boolean;
  currentSpeed: number;
  maxSpeed: number;
  avgSpeed: number;
  telemetrySampleCount: number;
  durationSeconds: number;
  overspeedCount: number;
  routeCoordinates: GPSPoint[];
  saccoId: string | undefined;
  saccoName: string;
  routeName: string;
  plateNumber: string;
}

interface TripState extends PersistedTripState {
  startTrip: (params: { vehicleId?: string; plateNumber: string; saccoName?: string; saccoId?: string; routeName?: string }) => void;
  updateTelemetry: (speed: number, gps?: GPSPoint) => void;
  pauseTrip: () => void;
  resumeTrip: () => void;
  endTrip: (status?: Trip['status']) => Trip | null;
  resetTrip: () => void;
  clearActiveTripPersistence: () => void;
}

const EMPTY_TRIP_STATE: PersistedTripState = {
  activeTrip: null,
  isTracking: false,
  isPaused: false,
  currentSpeed: 0,
  maxSpeed: 0,
  avgSpeed: 0,
  telemetrySampleCount: 0,
  durationSeconds: 0,
  overspeedCount: 0,
  routeCoordinates: [],
  saccoId: undefined,
  saccoName: '',
  routeName: '',
  plateNumber: '',
};

function loadPersistedTrip(): PersistedTripState {
  if (typeof window === 'undefined') return EMPTY_TRIP_STATE;
  try {
    const raw = window.localStorage.getItem(ACTIVE_TRIP_STORAGE_KEY);
    if (!raw) return EMPTY_TRIP_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedTripState>;
    if (!parsed.activeTrip || !parsed.isTracking) return EMPTY_TRIP_STATE;
    return {
      ...EMPTY_TRIP_STATE,
      ...parsed,
      saccoId: parsed.saccoId ?? EMPTY_TRIP_STATE.saccoId,
      telemetrySampleCount: Number.isFinite(parsed.telemetrySampleCount) ? parsed.telemetrySampleCount : 0,
      routeCoordinates: Array.isArray(parsed.routeCoordinates) ? parsed.routeCoordinates : [],
    };
  } catch {
    window.localStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
    return EMPTY_TRIP_STATE;
  }
}

function persistTrip(state: TripState) {
  if (typeof window === 'undefined' || !state.activeTrip || !state.isTracking) return;
  try {
    window.localStorage.setItem(
      ACTIVE_TRIP_STORAGE_KEY,
      JSON.stringify({
        activeTrip: state.activeTrip,
        isTracking: state.isTracking,
        isPaused: state.isPaused,
        currentSpeed: state.currentSpeed,
        maxSpeed: state.maxSpeed,
        avgSpeed: state.avgSpeed,
        telemetrySampleCount: state.telemetrySampleCount,
        durationSeconds: state.durationSeconds,
        overspeedCount: state.overspeedCount,
        routeCoordinates: state.routeCoordinates,
        saccoId: state.saccoId,
        saccoName: state.saccoName,
        routeName: state.routeName,
        plateNumber: state.plateNumber,
      }),
    );
  } catch {
    // Persistence is best-effort; the in-memory trip remains authoritative for this session.
  }
}

function clearPersistedTrip() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
  } catch {
    // Ignore storage failures while clearing transient state.
  }
}

function validGps(gps: GPSPoint): boolean {
  const { latitude: lat, longitude: lon, speedKmH: speed, accuracy } = gps;
  const time = new Date(gps.timestamp as string).getTime();
  return (
    Number.isFinite(lat) &&
    lat >= -5.5 &&
    lat <= 6 &&
    Number.isFinite(lon) &&
    lon >= 33 &&
    lon <= 43.5 &&
    Number.isFinite(speed) &&
    speed >= 0 &&
    speed <= 180 &&
    (accuracy === undefined || (Number.isFinite(accuracy) && accuracy > 0 && accuracy <= 100)) &&
    Number.isFinite(time)
  );
}

function haversineDistanceMeters(a: GPSPoint, b: GPSPoint): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(Math.min(1, h)));
}

const persistedTrip = loadPersistedTrip();
let lastTelemetryPersistence = 0;

export const useTripStore = create<TripState>((set, get) => ({
  ...persistedTrip,

  startTrip: ({ vehicleId, plateNumber, saccoName, saccoId, routeName = 'Standard Route' }) => {
    const state = get();
    if (state.activeTrip && state.isTracking) {
      throw new Error('TRIP001: An active trip is already in progress.');
    }
    if (!saccoId || saccoId === 'unassigned') {
      throw new Error('TRIP002: A verified SACCO is required to start a trip.');
    }

    const currentUser = useAuthStore.getState().user;
    const userId = currentUser?.uid || currentUser?.id;
    const uuid =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const normalizedPlate = plateNumber.trim().toUpperCase();
    const newTrip: Trip = {
      id: `trip_${uuid}`,
      tripId: `TRIP-${Math.floor(100000 + Math.random() * 900000)}`,
      ...(userId ? { userId } : {}),
      ...(vehicleId ? { vehicleId } : {}),
      vehicleRegNumber: normalizedPlate,
      plateNumber: normalizedPlate,
      saccoId,
      saccoName: saccoName || saccoId,
      routeName,
      status: 'active',
      currentSpeedKmH: 0,
      maxSpeedKmH: 0,
      avgSpeedKmH: 0,
      startTime: new Date().toISOString(),
      durationSeconds: 0,
      distanceMeters: 0,
      overspeedEventsCount: 0,
      violationsCount: 0,
    };

    set({
      activeTrip: newTrip,
      isTracking: true,
      isPaused: false,
      currentSpeed: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      telemetrySampleCount: 0,
      durationSeconds: 0,
      overspeedCount: 0,
      routeCoordinates: [],
      plateNumber: normalizedPlate,
      saccoId,
      saccoName: saccoName || saccoId,
      routeName,
    });
    persistTrip(get());
    lastTelemetryPersistence = Date.now();
  },

  updateTelemetry: (speed, gps) => {
    const state = get();
    if (!state.isTracking || state.isPaused) return;

    if (!Number.isFinite(speed) || speed < 0 || speed > 180) return;

    if (gps) {
      if (!validGps(gps)) return;
      const last = state.routeCoordinates.at(-1);
      if (last) {
        const previousMs = new Date(last.timestamp as string).getTime();
        const currentMs = new Date(gps.timestamp as string).getTime();
        if (currentMs <= previousMs) return;
      }
    }

    const safeSpeed = speed;
    const newMaxSpeed = Math.max(state.maxSpeed, safeSpeed);
    const updatedCoords = gps ? [...state.routeCoordinates, gps] : state.routeCoordinates;
    const previousPoint = state.routeCoordinates.at(-1);
    const addedDistance = gps && previousPoint ? haversineDistanceMeters(previousPoint, gps) : 0;
    const nextDistanceMeters = (state.activeTrip?.distanceMeters ?? 0) + addedDistance;
    const nextTelemetrySampleCount = state.telemetrySampleCount + 1;
    const nextAvgSpeed = ((state.avgSpeed * state.telemetrySampleCount) + safeSpeed) / nextTelemetrySampleCount;

    set((s) => ({
      currentSpeed: safeSpeed,
      maxSpeed: newMaxSpeed,
      avgSpeed: nextAvgSpeed,
      telemetrySampleCount: nextTelemetrySampleCount,
      routeCoordinates: updatedCoords,
      activeTrip: s.activeTrip
        ? {
            ...s.activeTrip,
            currentSpeedKmH: safeSpeed,
            maxSpeedKmH: newMaxSpeed,
            avgSpeedKmH: nextAvgSpeed,
            distanceMeters: nextDistanceMeters,
            ...(gps ? { lastGpsUpdate: gps } : {}),
          }
        : null,
    }));

    const now = Date.now();
    if (now - lastTelemetryPersistence >= TELEMETRY_PERSIST_INTERVAL_MS) {
      persistTrip(get());
      lastTelemetryPersistence = now;
    }
  },

  pauseTrip: () => {
    set({ isPaused: true });
    persistTrip(get());
  },

  resumeTrip: () => {
    set({ isPaused: false });
    persistTrip(get());
  },

  endTrip: (status = 'completed') => {
    const state = get();
    if (!state.activeTrip) return null;

    const completedTrip: Trip = {
      ...state.activeTrip,
      status,
      endTime: new Date().toISOString(),
      durationSeconds: state.durationSeconds,
      avgSpeedKmH: state.avgSpeed,
      distanceMeters: state.activeTrip.distanceMeters ?? 0,
      maxSpeedKmH: state.maxSpeed,
      overspeedEventsCount: state.overspeedCount,
    };

    set({ ...EMPTY_TRIP_STATE });
    return completedTrip;
  },

  clearActiveTripPersistence: () => clearPersistedTrip(),

  resetTrip: () => {
    clearPersistedTrip();
    set({ ...EMPTY_TRIP_STATE });
  },
}));
