import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

export const storageService = {
  /**
   * Upload user profile avatar photo (2MB limit, image only)
   */
  async uploadAvatar(file: File, userId: string): Promise<string> {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Avatar image must be under 2MB');
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const storageRef = ref(storage, `avatars/${userId}/avatar_${Date.now()}.${ext}`);
    const uploadTask = await uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
    });
    return await getDownloadURL(uploadTask.ref);
  },

  /**
   * Upload black spot or hazard evidence photo (5MB limit)
   */
  async uploadBlackSpotPhoto(file: File, spotId: string): Promise<string> {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Photo evidence must be under 5MB');
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const storageRef = ref(storage, `black_spots/${spotId}/photo_${Date.now()}.${ext}`);
    const uploadTask = await uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
    });
    return await getDownloadURL(uploadTask.ref);
  },

  /**
   * Upload complaint evidence image or video (5MB limit)
   */
  async uploadComplaintEvidence(file: File, saccoId: string, complaintId: string): Promise<string> {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Complaint evidence must be under 5MB');
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const storageRef = ref(storage, `evidence/${saccoId}/${complaintId}/evidence_${Date.now()}.${ext}`);
    const uploadTask = await uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
    });
    return await getDownloadURL(uploadTask.ref);
  },

  /**
   * Upload owner-scoped trip telemetry JSON blob
   */
  async uploadTelemetryBlob(telemetryData: any, userId: string, tripId: string): Promise<string> {
    const jsonStr = JSON.stringify(telemetryData);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const storageRef = ref(storage, `telemetry/${userId}/trip_${tripId}_${Date.now()}.json`);
    const uploadTask = await uploadBytesResumable(storageRef, blob, {
      contentType: 'application/json',
    });
    return await getDownloadURL(uploadTask.ref);
  },
};
