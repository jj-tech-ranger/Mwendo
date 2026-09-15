import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  onSnapshot,
  QueryConstraint,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { db, hasRealConfig } from '../lib/firebase';
import {
  MOCK_SACCOS,
  MOCK_VEHICLES,
  MOCK_VEHICLE_SUMMARIES,
  MOCK_PUBLIC_PINS,
  MOCK_BLACK_SPOTS,
  MOCK_SAFETY_ALERTS,
  MOCK_TRIPS,
  MOCK_DRIVERS,
  MOCK_VIOLATIONS,
  MOCK_COMPLAINTS,
  MOCK_AUDIT_LOGS,
  MOCK_TEAM_USERS,
  MOCK_INSPECTIONS,
  MOCK_ANALYTICS,
} from './mockData';

// In-memory runtime store keyed by collectionName
export const inMemoryStore: Record<string, Map<string, unknown>> = {
  saccos: new Map(MOCK_SACCOS.map((s) => [s.id, s])),
  vehicles: new Map(MOCK_VEHICLES.map((v) => [v.id, v])),
  vehicle_public_summary: new Map(MOCK_VEHICLE_SUMMARIES.map((v) => [v.id, v])),
  public_pins: new Map(MOCK_PUBLIC_PINS.map((p) => [p.id, p])),
  black_spots: new Map(MOCK_BLACK_SPOTS.map((b) => [b.id, b])),
  safety_alerts: new Map(MOCK_SAFETY_ALERTS.map((a) => [a.id, a])),
  trips: new Map(MOCK_TRIPS.map((t) => [t.id, t])),
  drivers: new Map(MOCK_DRIVERS.map((d) => [d.id, d])),
  violations: new Map(MOCK_VIOLATIONS.map((v) => [v.id, v])),
  complaints: new Map(MOCK_COMPLAINTS.map((c) => [c.id, c])),
  audit_logs: new Map(MOCK_AUDIT_LOGS.map((a) => [a.id, a])),
  team_users: new Map(MOCK_TEAM_USERS.map((t) => [t.id, t])),
  inspections: new Map(MOCK_INSPECTIONS.map((i) => [i.id, i])),
  analytics: new Map([[MOCK_ANALYTICS.id, MOCK_ANALYTICS]]),
};

export function createConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T): DocumentData {
      // Remove id before saving to Firestore document
      const { id: _id, ...rest } = data as unknown as Record<string, unknown>;
      const converted: Record<string, unknown> = { ...rest };
      if (typeof converted.startTime === 'string') {
        converted.startTime = Timestamp.fromDate(new Date(converted.startTime));
      } else if (converted.startTime instanceof Date) {
        converted.startTime = Timestamp.fromDate(converted.startTime);
      }

      if (typeof converted.endTime === 'string') {
        converted.endTime = Timestamp.fromDate(new Date(converted.endTime));
      } else if (converted.endTime instanceof Date) {
        converted.endTime = Timestamp.fromDate(converted.endTime);
      }

      if (typeof converted.timestamp === 'string') {
        converted.timestamp = Timestamp.fromDate(new Date(converted.timestamp));
      } else if (converted.timestamp instanceof Date) {
        converted.timestamp = Timestamp.fromDate(converted.timestamp);
      }
      return converted;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
      const data = snapshot.data(options);
      return {
        id: snapshot.id,
        ...data,
      } as T;
    },
  };
}

export class BaseRepository<T extends { id: string }> {
  public readonly collectionName: string;
  protected converter: FirestoreDataConverter<T>;
  protected subscribers: Set<(items: T[]) => void> = new Set();

  constructor(collectionName: string) {
    this.collectionName = collectionName;
    this.converter = createConverter<T>();
  }

  protected notifySubscribers(): void {
    const store = inMemoryStore[this.collectionName];
    const items = store && store.size > 0 ? (Array.from(store.values()) as T[]) : [];
    this.subscribers.forEach((cb) => {
      try {
        cb(items);
      } catch (err) {
        console.warn(`[BaseRepository] subscriber notification error for ${this.collectionName}:`, err);
      }
    });
  }

  protected getCollection() {
    return collection(db, this.collectionName).withConverter(this.converter);
  }

  protected getDocRef(id: string) {
    return doc(db, this.collectionName, id).withConverter(this.converter);
  }

  async getById(id: string): Promise<T | null> {
    if (hasRealConfig) {
      try {
        const docSnap = await getDoc(this.getDocRef(id));
        if (docSnap.exists()) {
          return docSnap.data();
        }
      } catch (err) {
        console.warn(`[BaseRepository] getById error for ${this.collectionName}/${id}:`, err);
      }
    }

    const store = inMemoryStore[this.collectionName];
    if (store && store.has(id)) {
      return (store.get(id) as T) || null;
    }
    return null;
  }

  async getAll(constraints: QueryConstraint[] = []): Promise<T[]> {
    if (hasRealConfig) {
      try {
        const q = query(this.getCollection(), ...constraints);
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          return querySnap.docs.map((docSnap) => docSnap.data());
        }
      } catch (err) {
        console.warn(`[BaseRepository] getAll error for ${this.collectionName}:`, err);
      }
    }

    const store = inMemoryStore[this.collectionName];
    if (store && store.size > 0) {
      return Array.from(store.values()) as T[];
    }
    return [];
  }

  async save(data: T): Promise<void> {
    // Keep in-memory store in sync
    let store = inMemoryStore[this.collectionName];
    if (!store) {
      store = new Map();
      inMemoryStore[this.collectionName] = store;
    }
    store.set(data.id, data);
    this.notifySubscribers();

    if (hasRealConfig) {
      try {
        await setDoc(this.getDocRef(data.id), data);
      } catch (err) {
        console.error(`[BaseRepository] save error for ${this.collectionName}/${data.id}:`, err);
      }
    }
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    // Keep in-memory store in sync
    const store = inMemoryStore[this.collectionName];
    if (store && store.has(id)) {
      const existing = store.get(id) as Record<string, unknown>;
      store.set(id, { ...existing, ...data } as T);
      this.notifySubscribers();
    }

    if (hasRealConfig) {
      try {
        await updateDoc(doc(db, this.collectionName, id), data as DocumentData);
      } catch (err) {
        console.error(`[BaseRepository] update error for ${this.collectionName}/${id}:`, err);
      }
    }
  }

  subscribe(
    constraints: QueryConstraint[] = [],
    callback: (data: T[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    if (hasRealConfig) {
      try {
        const q = constraints.length > 0 ? query(this.getCollection(), ...constraints) : this.getCollection();
        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const items = snapshot.docs.map((docSnap) => docSnap.data());
            callback(items);
          },
          (err) => {
            console.warn(`[BaseRepository] onSnapshot error for ${this.collectionName}:`, err);
            if (onError) onError(err);
          }
        );
        return unsubscribe;
      } catch (err) {
        console.warn(`[BaseRepository] subscribe setup error for ${this.collectionName}:`, err);
        if (onError && err instanceof Error) onError(err);
      }
    }

    const handler = (items: T[]) => {
      callback(items);
    };

    this.subscribers.add(handler);

    // Initial sync
    const store = inMemoryStore[this.collectionName];
    const initialItems = store && store.size > 0 ? (Array.from(store.values()) as T[]) : [];
    callback(initialItems);

    return () => {
      this.subscribers.delete(handler);
    };
  }
}
