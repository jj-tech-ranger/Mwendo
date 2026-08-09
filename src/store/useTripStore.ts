import { create } from 'zustand';
import { Trip, GPSPoint } from '../types';

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
  saccoName: string;
  routeName: string;
  plateNumber: string;

  // Actions
  startTrip: (params: { plateNumber: string; saccoName: string; routeName: string }) => void;
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
  saccoName: '',
  routeName: '',
  plateNumber: '',

  startTrip: ({ plateNumber, saccoName, routeName }) => {
    const newTrip: Trip = {
      id: `trip_${Date.now()}`,
      tripId: `TRIP-${Math.floor(100000 + Math.random() * 900000)}`,
      vehicleRegNumber: plateNumber.toUpperCase(),
      plateNumber: plateNumber.toUpperCase(),
      saccoId: 'sacco_metrolink',
      saccoName,
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
      saccoName,
      routeName,
    });
  },

  updateTelemetry: (speed, gps) => {
    const state = get();
    if (!state.isTracking || state.isPaused) return;

    const newMaxSpeed = Math.max(state.maxSpeed, speed);
    const isOverspeed = speed > 80;
    const newOverspeedCount = isOverspeed ? state.overspeedCount + 1 : state.overspeedCount;

    const updatedCoords = gps
      ? [...state.routeCoordinates, gps]
      : state.routeCoordinates;

    set((s) => ({
      currentSpeed: speed,
      maxSpeed: newMaxSpeed,
      overspeedCount: newOverspeedCount,
      routeCoordinates: updatedCoords,
      activeTrip: s.activeTrip
        ? {
            ...s.activeTrip,
            currentSpeedKmH: speed,
            maxSpeedKmH: newMaxSpeed,
            overspeedEventsCount: newOverspeedCount,
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
