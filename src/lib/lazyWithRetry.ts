import React, { lazy } from 'react';

/**
 * Robust lazy import with automatic retry on network or chunk loading failure
 */
export function lazyWithRetry<T extends React.ComponentType<Record<string, unknown>>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      console.warn('[lazyWithRetry] First load attempt failed, retrying after delay...', error);
      // Wait 500ms and retry once
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        return await factory();
      } catch (retryError) {
        console.error('[lazyWithRetry] Second load attempt failed:', retryError);
        throw retryError;
      }
    }
  });
}
