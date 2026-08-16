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
   * Upload owner-scoped trip telemetry JSON blob (gzipped with 5MB cap per VT-005)
   */
  async uploadTelemetryBlob(telemetryData: unknown, userId: string, tripId: string): Promise<string> {
    const jsonStr = JSON.stringify(telemetryData);
    let blob: Blob;
    let extension = 'json';
    let contentType = 'application/json';

    if (typeof CompressionStream !== 'undefined') {
      try {
        const stream = new Blob([jsonStr], { type: 'application/json' })
          .stream()
          .pipeThrough(new CompressionStream('gzip'));
        const compressedBlob = await new Response(stream).blob();
        blob = compressedBlob;
        extension = 'json.gz';
        contentType = 'application/gzip';
      } catch {
        blob = new Blob([jsonStr], { type: 'application/json' });
      }
    } else {
      blob = new Blob([jsonStr], { type: 'application/json' });
    }

    if (blob.size > 5 * 1024 * 1024) {
      throw new Error('Telemetry upload exceeds 5MB size limit.');
    }

    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
    const storageRef = ref(storage, `telemetry/${userId}/trip_${tripId}_${uuid}.${extension}`);
    const uploadTask = await uploadBytesResumable(storageRef, blob, {
      contentType,
    });
    return await getDownloadURL(uploadTask.ref);
  },
};
