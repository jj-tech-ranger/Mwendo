import { usePwaStore } from '../store/usePwaStore';

export const serviceWorkerService = {
  register() {
    try {
      if (
        typeof window === 'undefined' ||
        typeof navigator === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !navigator.serviceWorker
      ) {
        return;
      }

      const registerSW = () => {
        try {
          navigator.serviceWorker
            .register('/sw.js')
            .then((reg) => {
              if (!reg) return;
              usePwaStore.getState().setRegistration(reg);
              console.log('[PWA] Service Worker registered with scope:', reg.scope);

              // Check if an updated worker is already waiting in background (production only)
              if (reg.waiting && !import.meta.env.DEV) {
                console.log('[PWA] Found waiting worker on registration');
                usePwaStore.getState().setUpdateAvailable(true, reg.waiting);
              }

              // Listen for incoming new service worker versions
              reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;

                newWorker.addEventListener('statechange', () => {
                  if (
                    newWorker.state === 'installed' &&
                    navigator.serviceWorker?.controller &&
                    !import.meta.env.DEV
                  ) {
                    // An active controller already exists -> this is an update, not initial install
                    console.log('[PWA] New version installed and waiting for user confirmation');
                    usePwaStore.getState().setUpdateAvailable(true, newWorker);
                  }
                });
              });
            })
            .catch((err) => {
              console.warn('[PWA] Service Worker registration failed (harmless in dev/test):', err);
            });
        } catch (err) {
          console.warn('[PWA] Synchronous error during serviceWorker.register call:', err);
        }
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW, { once: true });
      }

      // Handle controller change (when skipWaiting activates new SW)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing && !import.meta.env.DEV) {
          refreshing = true;
          window.location.reload();
        }
      });
    } catch (err) {
      console.warn('[PWA] Failed to initialize service worker registration listener:', err);
    }
  },

  applyUpdate() {
    try {
      usePwaStore.getState().applyUpdate();
    } catch (err) {
      console.warn('[PWA] Failed to apply update:', err);
    }
  },
};
