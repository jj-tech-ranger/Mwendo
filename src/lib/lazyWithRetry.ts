import React, { lazy } from 'react';

/**
 * Robust lazy import with automatic chunk retry and page reload fallback
 * Prevents blank screens when a new deployment invalidates older chunk hashes
 */
export function lazyWithRetry<T extends React.ComponentType<Record<string, unknown>>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('retry-lazy-refreshed') || 'false'
    );

    try {
      const component = await factory();
      window.sessionStorage.setItem('retry-lazy-refreshed', 'false');
      return component;
    } catch (error: unknown) {
      console.warn('[lazyWithRetry] First chunk load failed, retrying once...', error);

      // Wait 300ms and attempt a second fetch
      await new Promise((resolve) => setTimeout(resolve, 300));

      try {
        const component = await factory();
        window.sessionStorage.setItem('retry-lazy-refreshed', 'false');
        return component;
      } catch (retryError: unknown) {
        // If a new deployment occurred, previous chunk hashes no longer exist on CDN/Hosting
        // A single full-page reload fetches the fresh index.html with up-to-date chunk manifest
        if (!pageHasAlreadyBeenForceRefreshed) {
          console.warn('[lazyWithRetry] Stale chunk detected after deployment, reloading page for fresh assets...');
          window.sessionStorage.setItem('retry-lazy-refreshed', 'true');
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }

        console.error('[lazyWithRetry] Chunk failed to load after reload:', retryError);
        throw retryError;
      }
    }
  });
}
