import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export interface CreateInspectionRequest {
  vehicleId: string;
  saccoId: string;
  inspectionType?: 'routine' | 'spot_check' | 'follow_up';
  result: 'pass' | 'fail' | 'conditional';
  notes?: string;
  inspectionDate?: string;
}

export interface CreateInspectionResponse {
  success: true;
  inspectionId: string;
  certificateNumber: string;
  expiryDate: string;
  createdAt: string;
}

export async function createTrustedInspection(
  payload: CreateInspectionRequest
): Promise<CreateInspectionResponse> {
  const callable = httpsCallable<CreateInspectionRequest, CreateInspectionResponse>(
    functions,
    'createInspection'
  );

  const response = await callable(payload);
  return response.data;
}
