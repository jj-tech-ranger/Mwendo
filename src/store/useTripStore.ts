import { create } from 'zustand';
import { Trip, GPSPoint } from '../types';
import { useAuthStore } from './useAuthStore';

interface TripState {
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

  // Actions
  startTrip: (params: { plateNumber: string; saccoName?: string | undefined; saccoId?: string | undefined; routeName?: string | undefined }) => void;
  updateTelemetry: (speed: number, gps?: GPSPoint) => void;
  pauseTrip: () => void;
  resumeTrip: () => void;
  endTrip: () => Trip | null;
  resetTrip: () => void;
}

export const useTripStore = create<TripState>((set, get) => ({
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

  startTrip: ({ plateNumber, saccoName, saccoId, routeName = 'Standard Route' }) => {
    const state = get();
    if (state.activeTrip && state.isTracking) {
      throw new Error('TRIP001: An active trip is already in progress.');
    }

    const currentUser = useAuthStore.getState().user;
    const userId = currentUser?.uid || currentUser?.id;
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  },

  pauseTrip: () => set({ isPaused: true }),
  resumeTrip: () => set({ isPaused: false }),

  endTrip: () => {
    const state = get();
    if (!state.activeTrip) return null;

    const completedTrip: Trip = {
      ...state.activeTrip,
      status: 'completed',
      endTime: new Date().toISOString(),
      durationSeconds: state.durationSeconds,
      maxSpeedKmH: state.maxSpeed,
      overspeedEventsCount: state.overspeedCount,
    };

    set({
      activeTrip: null,
      isTracking: false,
      isPaused: false,
      currentSpeed: 0,
    });

    return completedTrip;
  },

  resetTrip: () =>
    set({
      activeTrip: null,
      isTracking: false,
      isPaused: false,
      currentSpeed: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      durationSeconds: 0,
      overspeedCount: 0,
      routeCoordinates: [],
      saccoName: '',
      routeName: '',
      plateNumber: '',
    }),
}));
