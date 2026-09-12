import { describe, it, expect } from 'vitest';
import { processDecayStaleBlackSpotsLogic } from '../reports/decayStaleBlackSpots';

describe('Cloud Functions — decayStaleBlackSpots (Waze-style Crowdsourced Decay)', () => {
  it('downgrades severity when resolved confirmations outweigh still_there', async () => {
    const mockDbData: Record<string, any> = {
      'black_spots/spot_1': {
        title: 'Pothole near Naivasha Interchange',
        severity: 'high',
        status: 'active',
      },
    };

    const mockSubcollections: Record<string, Array<{ type: string; timestamp: string }>> = {
      'black_spots/spot_1/confirmations': [
        { type: 'resolved', timestamp: new Date().toISOString() },
        { type: 'resolved', timestamp: new Date().toISOString() },
        { type: 'resolved', timestamp: new Date().toISOString() },
        { type: 'still_there', timestamp: new Date().toISOString() },
      ],
    };

    const mockDb: any = {
      collection: (name: string) => ({
        get: async () => ({
          docs: Object.keys(mockDbData).map((key) => {
            const data = mockDbData[key];
            return {
              id: key.split('/')[1],
              data: () => data,
              ref: {
                collection: (subName: string) => ({
                  get: async () => ({
                    empty: !(mockSubcollections[`${key}/${subName}`]?.length > 0),
                    forEach: (cb: any) => {
                      (mockSubcollections[`${key}/${subName}`] || []).forEach((c) => cb({ data: () => c }));
                    },
                  }),
                }),
                set: async (updateData: any, opts?: any) => {
                  if (opts?.merge) {
                    mockDbData[key] = { ...mockDbData[key], ...updateData };
                  } else {
                    mockDbData[key] = updateData;
                  }
                },
              },
            };
          }),
        }),
      }),
    };

    const res = await processDecayStaleBlackSpotsLogic(mockDb);
    expect(res.spotsEvaluated).toBe(1);
    expect(res.spotsDowngraded).toBe(1);
    expect(mockDbData['black_spots/spot_1'].severity).toBe('medium');
    expect(mockDbData['black_spots/spot_1'].lastDecayedAt).toBeDefined();
  });

  it('archives low severity spot when resolved confirmations persist', async () => {
    const mockDbData: Record<string, any> = {
      'black_spots/spot_2': {
        title: 'Temporary construction obstacle',
        severity: 'low',
        status: 'active',
      },
    };

    const mockSubcollections: Record<string, Array<{ type: string; timestamp: string }>> = {
      'black_spots/spot_2/confirmations': [
        { type: 'resolved', timestamp: new Date().toISOString() },
        { type: 'resolved', timestamp: new Date().toISOString() },
        { type: 'resolved', timestamp: new Date().toISOString() },
        { type: 'resolved', timestamp: new Date().toISOString() },
      ],
    };

    const mockDb: any = {
      collection: () => ({
        get: async () => ({
          docs: Object.keys(mockDbData).map((key) => ({
            id: key.split('/')[1],
            data: () => mockDbData[key],
            ref: {
              collection: (subName: string) => ({
                get: async () => ({
                  empty: false,
                  forEach: (cb: any) => {
                    (mockSubcollections[`${key}/${subName}`] || []).forEach((c) => cb({ data: () => c }));
                  },
                }),
              }),
              set: async (updateData: any) => {
                mockDbData[key] = { ...mockDbData[key], ...updateData };
              },
            },
          })),
        }),
      }),
    };

    const res = await processDecayStaleBlackSpotsLogic(mockDb);
    expect(res.spotsArchived).toBe(1);
    expect(mockDbData['black_spots/spot_2'].status).toBe('archived');
  });
});
