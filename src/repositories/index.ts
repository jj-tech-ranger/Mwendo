import { collection, query, where, orderBy, limit, onSnapshot, Query, getDocs } from 'firebase/firestore';
import { db, hasRealConfig } from '../lib/firebase';
import { normalizePlate } from '../lib/plate';
import { BaseRepository, inMemoryStore } from './baseRepository';
import { UserProfile, Trip, BlackSpot, SafetyAlert, Vehicle, VehiclePublicSummary, Driver, Violation, Complaint, AuditLog, TeamUser, InspectionReport, SACCO, AnalyticsDocument } from '../types';

export class UserRepository extends BaseRepository<UserProfile> {
  constructor() {
    super('users');
  }
}

export class SaccoRepository extends BaseRepository<SACCO> {
  constructor() {
    super('saccos');
  }
}

export class TripRepository extends BaseRepository<Trip> {
  constructor() {
    super('trips');
  }
}

export class BlackSpotRepository extends BaseRepository<BlackSpot> {
  constructor() {
    super('black_spots');
  }
}

export const SAFETY_ALERTS_COLLECTION = 'safety_alerts';

export class AlertRepository extends BaseRepository<SafetyAlert> {
  constructor() {
    super(SAFETY_ALERTS_COLLECTION);
  }

  getCollectionName(): string {
    return this.collectionName;
  }

  getActiveAlertsQuery(limitCount = 50): Query {
    return query(
      collection(db, this.collectionName),
      where('status', '==', 'active'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
  }

  subscribeToActive(
    callback: (alerts: SafetyAlert[]) => void,
    onError?: (error: unknown) => void,
    limitCount = 50
  ): () => void {
    if (!hasRealConfig) {
      const store = inMemoryStore[this.collectionName];
      const items = store ? (Array.from(store.values()) as SafetyAlert[]) : [];
      callback(items.slice(0, limitCount));
      return () => {};
    }

    const q = this.getActiveAlertsQuery(limitCount);
    return onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as SafetyAlert[];
        callback(fetched);
      },
      (error) => {
        if (onError) onError(error);
      }
    );
  }
}

export class VehicleRepository extends BaseRepository<Vehicle> {
  constructor() {
    super('vehicles');
  }

  async findByNormalizedPlate(rawPlate: string): Promise<Vehicle | null> {
    const normalized = normalizePlate(rawPlate);
    if (!normalized) return null;

    // 1. First check document keyed by normalized ID
    const byId = await this.getById(normalized);
    if (byId) return byId;

    // 2. Query regNumber matching normalized
    if (hasRealConfig) {
      try {
        const q = query(
          collection(db, this.collectionName).withConverter(this.converter),
          where('regNumber', '==', normalized),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty && snap.docs[0]) {
          return snap.docs[0].data();
        }
      } catch (err) {
        console.warn('[VehicleRepository] findByNormalizedPlate query error:', err);
      }
    }

    // Fallback to in-memory store
    const store = inMemoryStore[this.collectionName];
    if (store) {
      for (const vehicle of store.values() as Iterable<Vehicle>) {
        if (normalizePlate(vehicle.regNumber) === normalized || normalizePlate(vehicle.id) === normalized) {
          return vehicle;
        }
      }
    }

    return null;
  }

  async searchVehicles(prefix: string, maxResults = 5): Promise<Vehicle[]> {
    const normalized = normalizePlate(prefix);
    if (!normalized || normalized.length < 2) return [];

    if (hasRealConfig) {
      try {
        const q = query(
          collection(db, this.collectionName).withConverter(this.converter),
          where('regNumber', '>=', normalized),
          where('regNumber', '<=', normalized + '\uf8ff'),
          limit(maxResults)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map((d) => d.data());
        }
      } catch {
        // Fall through to memory
      }
    }

    const store = inMemoryStore[this.collectionName];
    if (store) {
      const matches: Vehicle[] = [];
      for (const vehicle of store.values() as Iterable<Vehicle>) {
        const norm = normalizePlate(vehicle.regNumber);
        if (norm.includes(normalized)) {
          matches.push(vehicle);
          if (matches.length >= maxResults) break;
        }
      }
      return matches;
    }

    return [];
  }
}

export class DriverRepository extends BaseRepository<Driver> {
  constructor() {
    super('drivers');
  }
}

export class ViolationRepository extends BaseRepository<Violation> {
  constructor() {
    super('violations');
  }
}

export class ComplaintRepository extends BaseRepository<Complaint> {
  constructor() {
    super('complaints');
  }

  async getRecentPending(limitCount = 3): Promise<Complaint[]> {
    try {
      const q = query(
        this.getCollection(),
        where('status', 'in', ['open', 'investigating']),
        limit(limitCount)
      );
      const querySnap = await getDocs(q);
      return querySnap.docs.map((docSnap) => docSnap.data());
    } catch (err) {
      console.warn('[ComplaintRepository] getRecentPending error:', err);
      return [];
    }
  }
}

export class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor() {
    super('audit_logs');
  }

  async getRecent(limitCount = 5): Promise<AuditLog[]> {
    try {
      const q = query(
        this.getCollection(),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const querySnap = await getDocs(q);
      return querySnap.docs.map((docSnap) => docSnap.data());
    } catch (err) {
      console.warn('[AuditLogRepository] getRecent error:', err);
      return [];
    }
  }
}

export class TeamUserRepository extends BaseRepository<TeamUser> {
  constructor() {
    super('team_users');
  }
}

export class InspectionReportRepository extends BaseRepository<InspectionReport> {
  constructor() {
    super('inspections');
  }
}

export class ProcessedEventRepository extends BaseRepository<{ id: string; eventId: string; handler: string; processedAt: string }> {
  constructor() {
    super('processedEvents');
  }
}

export class AnalyticsRepository extends BaseRepository<AnalyticsDocument> {
  constructor() {
    super('analytics');
  }
}

export class PublicPinRepository extends BaseRepository<{ id: string; title: string; routeName: string; latitude: number; longitude: number; severity: string }> {
  constructor() {
    super('public_pins');
  }
}

export class VehiclePublicSummaryRepository extends BaseRepository<VehiclePublicSummary> {
  constructor() {
    super('vehicle_public_summary');
  }

  async findByNormalizedPlate(rawPlate: string): Promise<VehiclePublicSummary | null> {
    const normalized = normalizePlate(rawPlate);
    if (!normalized) return null;

    // 1. Direct getDoc by canonical normalized doc ID
    const byId = await this.getById(normalized);
    if (byId) return byId;

    // 2. Query regNumber matching normalized
    if (hasRealConfig) {
      try {
        const q = query(
          collection(db, this.collectionName).withConverter(this.converter),
          where('regNumber', '==', normalized),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty && snap.docs[0]) {
          return snap.docs[0].data();
        }
      } catch (err) {
        console.warn('[VehiclePublicSummaryRepository] query error:', err);
      }
    }

    const store = inMemoryStore[this.collectionName];
    if (store) {
      for (const summary of store.values() as Iterable<VehiclePublicSummary>) {
        if (normalizePlate(summary.regNumber) === normalized || normalizePlate(summary.id) === normalized) {
          return summary;
        }
      }
    }

    return null;
  }

  async searchVehicles(prefix: string, maxResults = 5): Promise<VehiclePublicSummary[]> {
    const normalized = normalizePlate(prefix);
    if (!normalized || normalized.length < 2) return [];

    if (hasRealConfig) {
      try {
        const q = query(
          collection(db, this.collectionName).withConverter(this.converter),
          where('regNumber', '>=', normalized),
          where('regNumber', '<=', normalized + '\uf8ff'),
          limit(maxResults)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map((d) => d.data());
        }
      } catch {
        // Fall through to memory
      }
    }

    const store = inMemoryStore[this.collectionName];
    if (store) {
      const matches: VehiclePublicSummary[] = [];
      for (const summary of store.values() as Iterable<VehiclePublicSummary>) {
        const norm = normalizePlate(summary.regNumber);
        if (norm.includes(normalized)) {
          matches.push(summary);
          if (matches.length >= maxResults) break;
        }
      }
      return matches;
    }

    return [];
  }
}

export const userRepository = new UserRepository();
export const saccoRepository = new SaccoRepository();
export const tripRepository = new TripRepository();
export const blackSpotRepository = new BlackSpotRepository();
export const alertRepository = new AlertRepository();
export const safetyAlertRepository = alertRepository;
export const vehicleRepository = new VehicleRepository();
export const vehiclePublicSummaryRepository = new VehiclePublicSummaryRepository();
export const driverRepository = new DriverRepository();
export const violationRepository = new ViolationRepository();
export const complaintRepository = new ComplaintRepository();
export const auditLogRepository = new AuditLogRepository();
export const teamUserRepository = new TeamUserRepository();
export const inspectionReportRepository = new InspectionReportRepository();
export const processedEventRepository = new ProcessedEventRepository();
export const analyticsRepository = new AnalyticsRepository();
export const publicPinRepository = new PublicPinRepository();
