import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';

export type PointsEvent = 'trip_completed' | 'black_spot_reported' | 'report_confirmed';

export const POINTS_VALUES: Record<PointsEvent, number> = {
  trip_completed: 15,
  black_spot_reported: 25,
  report_confirmed: 10,
};

export function computeRewardTier(points: number): 'Bronze' | 'Silver' | 'Gold' {
  if (points >= 300) return 'Gold';
  if (points >= 100) return 'Silver';
  return 'Bronze';
}

export const pointsService = {
  async awardPoints(
    userId: string,
    event: PointsEvent,
    customPoints?: number
  ): Promise<{ totalPoints: number; tier: 'Bronze' | 'Silver' | 'Gold' }> {
    const pointsToAdd = customPoints ?? POINTS_VALUES[event];
    const userRef = doc(db, 'users', userId);

    let currentPoints = 0;
    let currentHistory: Array<{ event: string; points: number; timestamp: string }> = [];

    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        currentPoints = Number(data.safetyPoints || 0);
        currentHistory = Array.isArray(data.pointsHistory) ? data.pointsHistory : [];
      }
    } catch (err) {
      console.warn('Could not read user profile for points, falling back to authStore:', err);
      const authUser = useAuthStore.getState().user;
      if (authUser?.uid === userId) {
        currentPoints = authUser.safetyPoints || 0;
        currentHistory = authUser.pointsHistory || [];
      }
    }

    const newTotal = currentPoints + pointsToAdd;
    const newTier = computeRewardTier(newTotal);
    const newHistoryEntry = {
      event,
      points: pointsToAdd,
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [newHistoryEntry, ...currentHistory].slice(0, 50);

    try {
      await updateDoc(userRef, {
        safetyPoints: newTotal,
        rewardTier: newTier,
        pointsHistory: updatedHistory,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to update points in Firestore, updating local state:', err);
    }

    // Update in-memory auth store if current user
    const currentUser = useAuthStore.getState().user;
    if (currentUser && currentUser.uid === userId) {
      useAuthStore.setState({
        user: {
          ...currentUser,
          safetyPoints: newTotal,
          rewardTier: newTier,
          pointsHistory: updatedHistory,
        },
      });
    }

    return { totalPoints: newTotal, tier: newTier };
  },
};
