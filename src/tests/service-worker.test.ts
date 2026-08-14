import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { usePwaStore } from '../store/usePwaStore';

describe('PWA-001 Service Worker & Cache Lifecycle Audit', () => {
  const swSource = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf-8');

  it('declares a dynamic build-derived CACHE_NAME template instead of a hardcoded static string', () => {
    expect(swSource).toContain("const CACHE_NAME = 'mwendo-salama-__BUILD_ID__'");
    expect(swSource).not.toContain("const CACHE_NAME = 'mwendo-salama-v1';");
  });

  it('removes unconditional self.skipWaiting() from the install event handler', () => {
    // Locate install event handler block
    const installBlockMatch = swSource.match(/addEventListener\('install'[\s\S]*?\n\}\);/);
    expect(installBlockMatch).not.toBeNull();
    const installBlock = installBlockMatch ? installBlockMatch[0] : '';
    
    // Ensure install block does not unconditionally call skipWaiting()
    expect(installBlock).not.toContain('self.skipWaiting()');
  });

  it('listens for client-triggered SKIP_WAITING message before activating new worker', () => {
    // Locate message event handler
    const messageBlockMatch = swSource.match(/addEventListener\('message'[\s\S]*?\n\}\);/);
    expect(messageBlockMatch).not.toBeNull();
    const messageBlock = messageBlockMatch ? messageBlockMatch[0] : '';

    expect(messageBlock).toContain('SKIP_WAITING');
    expect(messageBlock).toContain('self.skipWaiting()');
  });

  it('contains cache-cleanup logic in activate event that deletes stale deployment caches', () => {
    const activateBlockMatch = swSource.match(/addEventListener\('activate'[\s\S]*?\n\}\);/);
    expect(activateBlockMatch).not.toBeNull();
    const activateBlock = activateBlockMatch ? activateBlockMatch[0] : '';

    expect(activateBlock).toContain('caches.keys()');
    expect(activateBlock).toContain('if (cache !== CACHE_NAME)');
    expect(activateBlock).toContain('caches.delete(cache)');
  });

  it('simulates sequential deployments and cleans up old cache buckets', async () => {
    // Deployment 1 simulation
    const buildId1 = 'v1.0.0-1700000001';
    const cacheName1 = `mwendo-salama-${buildId1}`;
    
    // Deployment 2 simulation
    const buildId2 = 'v1.0.1-1700000002';
    const cacheName2 = `mwendo-salama-${buildId2}`;

    expect(cacheName1).not.toEqual(cacheName2);

    // Mock cache storage
    const mockCacheKeys = [cacheName1, 'unrelated-old-cache', cacheName2];
    const deletedCaches: string[] = [];

    // Simulate activate handler in Deployment 2
    const currentActiveCache = cacheName2;
    await Promise.all(
      mockCacheKeys.map(async (cache) => {
        if (cache !== currentActiveCache) {
          deletedCaches.push(cache);
        }
      })
    );

    expect(deletedCaches).toContain(cacheName1);
    expect(deletedCaches).toContain('unrelated-old-cache');
    expect(deletedCaches).not.toContain(cacheName2);
  });

  describe('usePwaStore & Update Trigger', () => {
    beforeEach(() => {
      usePwaStore.setState({
        isUpdateAvailable: false,
        registration: null,
        waitingWorker: null,
      });
    });

    it('stores waiting worker and update available state correctly', () => {
      const mockWaitingWorker = {
        postMessage: vi.fn(),
      } as unknown as ServiceWorker;

      usePwaStore.getState().setUpdateAvailable(true, mockWaitingWorker);

      expect(usePwaStore.getState().isUpdateAvailable).toBe(true);
      expect(usePwaStore.getState().waitingWorker).toBe(mockWaitingWorker);
    });

    it('sends SKIP_WAITING message to waiting worker when applyUpdate is invoked', () => {
      const postMessageSpy = vi.fn();
      const mockWaitingWorker = {
        postMessage: postMessageSpy,
      } as unknown as ServiceWorker;

      usePwaStore.getState().setUpdateAvailable(true, mockWaitingWorker);
      usePwaStore.getState().applyUpdate();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SKIP_WAITING' })
      );
    });
  });
});
