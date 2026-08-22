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
  QueryConstraint,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  protected collectionName: string;
  protected converter: FirestoreDataConverter<T>;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
    this.converter = createConverter<T>();
  }

  protected getCollection() {
    return collection(db, this.collectionName).withConverter(this.converter);
  }

  protected getDocRef(id: string) {
    return doc(db, this.collectionName, id).withConverter(this.converter);
  }

  async getById(id: string): Promise<T | null> {
    try {
      const docSnap = await getDoc(this.getDocRef(id));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (err) {
      console.warn(`[BaseRepository] getById error for ${this.collectionName}/${id}:`, err);
      return null;
    }
  }

  async getAll(constraints: QueryConstraint[] = []): Promise<T[]> {
    try {
      const q = query(this.getCollection(), ...constraints);
      const querySnap = await getDocs(q);
      return querySnap.docs.map((docSnap) => docSnap.data());
    } catch (err) {
      console.warn(`[BaseRepository] getAll error for ${this.collectionName}:`, err);
      return [];
    }
  }

  async save(data: T): Promise<void> {
    try {
      await setDoc(this.getDocRef(data.id), data);
    } catch (err) {
      console.error(`[BaseRepository] save error for ${this.collectionName}/${data.id}:`, err);
      throw err;
    }
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    try {
      await updateDoc(doc(db, this.collectionName, id), data as DocumentData);
    } catch (err) {
      console.error(`[BaseRepository] update error for ${this.collectionName}/${id}:`, err);
      throw err;
    }
  }
}
