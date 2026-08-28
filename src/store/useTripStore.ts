import { create } from 'zustand';
import { Trip, GPSPoint } from '../types';
import { useAuthStore } from './useAuthStore';

const ACTIVE_TRIP_STORAGE_KEY = 'mwendo.activeTrip.v1';
const TELEMETRY_PERSIST_INTERVAL_MS = 5_000;

interface PersistedTripState {
  activeTrip: Trip | null;
  isTracking: boolean;
  isPaused: boolean;
  currentSpeed: number;
  maxSpeed: number;
  avgSpeed: number;
  durationSeconds: number;
  overspeedCount: number;
  routeCoordinates: GPSPoint[];
  saccoId?: string | undefined;
  saccoName: string;
  routeName: string;
  plateNumber: string;
}

interface TripState extends PersistedTripState {
  startTrip: (params: { plateNumber: string; saccoName?: string | undefined; saccoId?: string | undefined; routeName?: string | undefined }) => void;
  updateTelemetry: (speed: number, gps?: GPSPoint) => void;
  pauseTrip: () => void;
  resumeTrip: () => void;
  endTrip: (status?: Trip['status']) => Trip | null;
  resetTrip: () => void;
}

const EMPTY_TRIP_STATE: PersistedTripState = {
  activeTrip: null,
  isTracking: false,
  isPaused: false,
  currentSpeed: 0,
  maxSpeed: 0,
  avgSpeed: 0,
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
    if (!parsed.activeTrip || !parsed.isTracking) {
      window.localStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
      return EMPTY_TRIP_STATE;
    }

    return {
      ...EMPTY_TRIP_STATE,
      ...parsed,
      routeCoordinates: Array.isArray(parsed.routeCoordinates) ? parsed.routeCoordinates : [],
    };
  } catch {
    window.localStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
    return EMPTY_TRIP_STATE;
  }
}

function persistTrip(state: TripState): void {
  if (typeof window === 'undefined' || !state.activeTrip || !state.isTracking) return;

  try {
    const persisted: PersistedTripState = {
      activeTrip: state.activeTrip,
      isTracking: state.isTracking,
      isPaused: state.isPaused,
      currentSpeed: state.currentSpeed,
      maxSpeed: state.maxSpeed,
      avgSpeed: state.avgSpeed,
      durationSeconds: state.durationSeconds,
      overspeedCount: state.overspeedCount,
      routeCoordinates: state.routeCoordinates,
      saccoId: state.saccoId,
      saccoName: state.saccoName,
      routeName: state.routeName,
      plateNumber: state.plateNumber,
    };

    window.localStorage.setItem(ACTIVE_TRIP_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Persistence is best-effort. Tracking must continue if storage is unavailable.
  }
}

function clearPersistedTrip(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the in-memory trip remains authoritative for the current session.
  }
}

const persistedTrip = loadPersistedTrip();
let lastTelemetryPersistence = 0;

export const useTripStore = create<TripState>((set, get) => ({
  ...persistedTrip,

  startTrip: ({ plateNumber, saccoName, saccoId, routeName = 'Standard Route' }) => {
    const state = get();
    if (state.activeTrip && state.isTracking) {
      throw new Error('TRIP001: An active trip is already in progress.');
    }

    const currentUser = useAuthStore.getState().user;
    const userId = currentUser?.uid || currentUser?.id;
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const effectiveSaccoId = saccoId || 'unassigned';
    const effectiveSaccoName = saccoName || (effectiveSaccoId === 'unassigned' ? 'Independent / Unassigned' : effectiveSaccoId);

    const newTrip: Trip = {
      id: `trip_${uuid}`,
      tripId: `TRIP-${Math.floor(100000 + Math.random() * 900000)}`,
      ...(userId ? { userId } : {}),
      vehicleRegNumber: plateNumber.toUpperCase(),
      plateNumber: plateNumber.toUpperCase(),
      saccoId: effectiveSaccoId,
      saccoName: effectiveSaccoName,
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
      durationSeconds: 0,
      overspeedCount: 0,
      routeCoordinates: [],
      plateNumber,
      saccoId: effectiveSaccoId,
      saccoName: effectiveSaccoName,
      routeName,
    });

    persistTrip(get());
    lastTelemetryPersistence = Date.now();
  },

  updateTelemetry: (speed, gps) => {
    const state = get();
    if (!state.isTracking || state.isPaused) return;

    const newMaxSpeed = Math.max(state.maxSpeed, speed);
    const updatedCoords = gps
      ? [...state.routeCoordinates, gps]
      : state.routeCoordinates;

    set((s) => ({
      currentSpeed: speed,
      maxSpeed: newMaxSpeed,
      routeCoordinates: updatedCoords,
      activeTrip: s.activeTrip
        ? {
            ...s.activeTrip,
            currentSpeedKmH: speed,
            maxSpeedKmH: newMaxSpeed,
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
      maxSpeedKmH: state.maxSpeed,
      overspeedEventsCount: state.overspeedCount,
    };

    clearPersistedTrip();
    set({ ...EMPTY_TRIP_STATE });

    return completedTrip;
  },

  resetTrip: () => {
    clearPersistedTrip();
    set({ ...EMPTY_TRIP_STATE });
  },
}));
