import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import QRCode from 'qrcode';
import { db } from '../lib/firebase';
import { SharedTrip } from '../types';

export const shareTripService = {
  async createOrUpdateSharedTrip(trip: {
    id: string;
    vehicleRegNumber?: string;
    plateNumber?: string;
    saccoName: string;
    routeName: string;
    status: string;
    currentSpeedKmH: number;
    maxSpeedKmH: number;
    overspeedEventsCount?: number;
  }): Promise<{ shareId: string; shareUrl: string; qrDataUrl: string }> {
    const shareId = `share_${trip.id}`;
    const shareDocRef = doc(db, 'shared_trips', shareId);

    const plate = trip.plateNumber || trip.vehicleRegNumber || 'Matatu';
    const overspeed = trip.overspeedEventsCount || 0;
    const isSafe = trip.currentSpeedKmH <= 80 && overspeed === 0;
    const safetyStatus = trip.status === 'completed'
      ? 'Trip Completed'
      : isSafe
      ? 'Normal & Safe Driving'
      : 'Caution: Speed Warning Recorded';

    const now = new Date();
    const expires = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12-hour expiry

    const sharedData: SharedTrip = {
      id: shareId,
      tripId: trip.id,
      plateNumber: plate,
      saccoName: trip.saccoName || 'Registered SACCO',
      routeName: trip.routeName || 'Active Corridor',
      status: trip.status === 'completed' ? 'completed' : 'active',
      safetyStatus,
      currentSpeedKmH: trip.currentSpeedKmH,
      maxSpeedKmH: trip.maxSpeedKmH,
      overspeedEventsCount: overspeed,
      lastUpdatedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };

    try {
      await setDoc(shareDocRef, sharedData, { merge: true });
    } catch (err) {
      console.warn('Could not write shared trip to Firestore:', err);
    }

    const shareUrl = `${window.location.origin}/share/trip/${shareId}`;
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 250,
        margin: 2,
        color: {
          dark: '#002B49',
          light: '#FFFFFF',
        },
      });
    } catch (err) {
      console.warn('Failed to generate QR code:', err);
    }

    return { shareId, shareUrl, qrDataUrl };
  },

  async getSharedTrip(shareId: string): Promise<SharedTrip | null> {
    try {
      const snap = await getDoc(doc(db, 'shared_trips', shareId));
      if (!snap.exists()) return null;
      const data = snap.data() as SharedTrip;
      // Check expiration
      if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
        return {
          ...data,
          status: 'completed',
          safetyStatus: 'Link Expired',
        };
      }
      return data;
    } catch (err) {
      console.warn('Error fetching shared trip:', err);
      return null;
    }
  },
};
