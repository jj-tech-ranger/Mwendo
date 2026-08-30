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
  async uploadAvatar(file: File, userId: string): Promise<string> {
    if (file.size > 2 * 1024 * 1024) throw new Error('Avatar image must be under 2MB');
    const ext = file.name.split('.').pop() || 'jpg';
    const storageRef = ref(storage, `avatars/${userId}/avatar_${Date.now()}.${ext}`);
    return waitForUpload(uploadBytesResumable(storageRef, file, { contentType: file.type || 'image/jpeg' }));
  },

  /** Reporter UID is path-scoped so Storage Rules can enforce ownership without Firestore lookups. */
  async uploadBlackSpotPhoto(file: File, spotId: string, userId: string): Promise<string> {
    if (file.size > 5 * 1024 * 1024) throw new Error('Photo evidence must be under 5MB');
    const ext = file.name.split('.').pop() || 'jpg';
    const storageRef = ref(storage, `black_spots/${spotId}/${userId}/photo_${Date.now()}.${ext}`);
    return waitForUpload(uploadBytesResumable(storageRef, file, { contentType: file.type || 'image/jpeg' }));
  },

  async uploadComplaintEvidence(file: File, saccoId: string, complaintId: string): Promise<string> {
    if (file.size > 5 * 1024 * 1024) throw new Error('Complaint evidence must be under 5MB');
    const ext = file.name.split('.').pop() || 'jpg';
    const storageRef = ref(storage, `evidence/${saccoId}/${complaintId}/evidence_${Date.now()}.${ext}`);
    return waitForUpload(uploadBytesResumable(storageRef, file, { contentType: file.type || 'image/jpeg' }));
  },

  async uploadTelemetryBlob(telemetryData: unknown, userId: string, tripId: string): Promise<string> {
    const jsonStr = JSON.stringify(telemetryData);
    let blob: Blob;
    let extension = 'json';
    let contentType = 'application/json';

    if (typeof CompressionStream !== 'undefined') {
      try {
        const stream = new Blob([jsonStr], { type: 'application/json' }).stream().pipeThrough(new CompressionStream('gzip'));
        blob = await new Response(stream).blob();
        extension = 'json.gz';
        contentType = 'application/gzip';
      } catch {
        blob = new Blob([jsonStr], { type: 'application/json' });
      }
    } else {
      blob = new Blob([jsonStr], { type: 'application/json' });
    }

    if (blob.size > 5 * 1024 * 1024) throw new Error('Telemetry upload exceeds 5MB size limit.');
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
    const storageRef = ref(storage, `telemetry/${userId}/trip_${tripId}_${uuid}.${extension}`);
    return waitForUpload(uploadBytesResumable(storageRef, blob, { contentType }));
  },
};
