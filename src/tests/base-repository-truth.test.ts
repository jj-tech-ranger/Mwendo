import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseRepository } from '../repositories/baseRepository';
import * as firestore from 'firebase/firestore';

vi.mock('../lib/firebase', () => ({
  db: {},
  hasRealConfig: true,
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    collection: vi.fn(() => ({
      withConverter: vi.fn(() => ({})),
    })),
    doc: vi.fn(() => ({
      withConverter: vi.fn(() => ({})),
    })),
    query: vi.fn((col) => col),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
  };
});

describe('BaseRepository truth in data fetching (zero fallbacks on real empty result sets)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty array [] when Firestore query legitimately returns zero documents', async () => {
    const repo = new BaseRepository<{ id: string; name: string }>('violations');

    // Simulate real Firestore returning an empty snapshot
    vi.mocked(firestore.getDocs).mockResolvedValueOnce({
      empty: true,
      docs: [],
      size: 0,
      forEach: vi.fn(),
    } as unknown as firestore.QuerySnapshot);

    const result = await repo.getAll();

    // Must return an empty array, NOT inMemoryStore / mockData.ts records
    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });

  it('returns null when Firestore getDoc legitimately finds no matching document', async () => {
    const repo = new BaseRepository<{ id: string; name: string }>('violations');

    // Simulate real Firestore returning exists() === false
    vi.mocked(firestore.getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
      id: 'non_existent_id',
    } as unknown as firestore.DocumentSnapshot);

    const result = await repo.getById('non_existent_id');

    // Must return null, NOT inMemoryStore / mockData.ts fallback
    expect(result).toBeNull();
  });

  it('re-throws error when Firestore getDocs rejects with permission-denied (distinguishing error from empty result)', async () => {
    const repo = new BaseRepository<{ id: string; name: string }>('violations');

    const permissionError = new Error('Missing or insufficient permissions: [permission-denied]');
    vi.mocked(firestore.getDocs).mockRejectedValueOnce(permissionError);

    // Caller must be able to distinguish an error from an empty result ([]):
    // repo.getAll() must reject/throw rather than swallowing into []
    await expect(repo.getAll()).rejects.toThrow('Missing or insufficient permissions');
  });

  it('re-throws error when Firestore getDoc rejects with network failure (distinguishing error from null)', async () => {
    const repo = new BaseRepository<{ id: string; name: string }>('violations');

    const networkError = new Error('Unavailable: [unavailable] client is offline');
    vi.mocked(firestore.getDoc).mockRejectedValueOnce(networkError);

    // Caller must be able to distinguish an error from a non-existent document (null):
    // repo.getById() must reject/throw rather than swallowing into null
    await expect(repo.getById('erroneous_id')).rejects.toThrow('client is offline');
  });
});
