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
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export function createConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T): DocumentData {
      // Remove id before saving to Firestore document
      const { id: _id, ...rest } = data as unknown as Record<string, unknown>;
      return rest;
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
