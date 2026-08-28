import { getDownloadURL, ref, uploadBytesResumable, UploadTask } from 'firebase/storage';
import { storage } from '../lib/firebase';

const waitForUpload = (uploadTask: UploadTask): Promise<string> =>
  new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      undefined,
      reject,
      async () => {
        try {
          resolve(await getDownloadURL(uploadTask.snapshot.ref));
        } catch (error) {
          reject(error);
        }
      }
    );
  });

export const storageService = {
  /**
   * Upload user profile avatar photo (2MB limit, image only).
   * The returned URL is only resolved after Firebase Storage confirms completion.
   */
  async uploadAvatar(file: File, userId: string): Promise<string> {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Avatar image must be under 2MB');
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const storageRef = ref(storage, `avatars/${userId}/avatar_${Date.now()}.${ext}`);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
    });

    return waitForUpload(uploadTask);
  },

  /**
   * Upload black spot or hazard evidence photo (5MB limit).
   * The returned URL is only resolved after Firebase Storage confirms completion.
   */
  async uploadBlackSpotPhoto(file: File, spotId: string): Promise<string> {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Photo evidence must be under 5MB');
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const storageRef = ref(storage, `black_spots/${spotId}/photo_${Date.now()}.${ext}`);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
    });

    return waitForUpload(uploadTask);
  },

  /**
   * Upload complaint evidence image or video (5MB limit).
   * The returned URL is only resolved after Firebase Storage confirms completion.
   */
  async uploadComplaintEvidence(file: File, saccoId: string, complaintId: string): Promise<string> {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Complaint evidence must be under 5MB');
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const storageRef = ref(storage, `evidence/${saccoId}/${complaintId}/evidence_${Date.now()}.${ext}`);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
    });

    return waitForUpload(uploadTask);
  },

  /**
   * Upload owner-scoped trip telemetry JSON blob (gzipped with 5MB cap per VT-005).
   * The returned URL is only resolved after Firebase Storage confirms completion.
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

    const uuid =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`;
    const storageRef = ref(storage, `telemetry/${userId}/trip_${tripId}_${uuid}.${extension}`);
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType,
    });

    return waitForUpload(uploadTask);
  },
};
