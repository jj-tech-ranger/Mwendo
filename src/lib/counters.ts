import { doc, setDoc, updateDoc, increment, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from './firebase';

/**
 * AN-003: Distributed Counter Sharding Service
 * Implements 10-shard distributed counters for high-frequency SACCO metrics
 * (trips, violations, alerts) to avoid Firestore 1-write/sec hotspotting.
 */
const NUM_SHARDS = 10;

export interface ShardedCounter {
  saccoId: string;
  metric: string;
  totalCount: number;
}

export const shardedCounterService = {
  /**
   * Increments a randomly selected shard for a given SACCO and metric.
   */
  async incrementCounter(saccoId: string, metric: string, delta: number = 1): Promise<void> {
    const shardId = Math.floor(Math.random() * NUM_SHARDS);
    const shardRef = doc(db, 'saccoCounters', `${saccoId}_${metric}_shard_${shardId}`);

    try {
      await updateDoc(shardRef, {
        count: increment(delta),
        saccoId,
        metric,
        shardId,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // If shard doc doesn't exist yet, initialize it
      await setDoc(
        shardRef,
        {
          count: delta,
          saccoId,
          metric,
          shardId,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  },

  /**
   * Reads all shards for a given SACCO and metric and aggregates their sum.
   */
  async getCounterSum(saccoId: string, metric: string): Promise<number> {
    const countersRef = collection(db, 'saccoCounters');
    const q = query(countersRef, where('saccoId', '==', saccoId), where('metric', '==', metric));
    const snapshot = await getDocs(q);

    let total = 0;
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (typeof data.count === 'number') {
        total += data.count;
      }
    });

    return total;
  },
};
