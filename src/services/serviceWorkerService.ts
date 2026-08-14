import { usePwaStore } from '../store/usePwaStore';

export const serviceWorkerService = {
  register() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          usePwaStore.getState().setRegistration(reg);
          console.log('[PWA] Service Worker registered with scope:', reg.scope);

          // Check if an updated worker is already waiting in background
          if (reg.waiting) {
            console.log('[PWA] Found waiting worker on registration');
            usePwaStore.getState().setUpdateAvailable(true, reg.waiting);
          }

          // Listen for incoming new service worker versions
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // An active controller already exists -> this is an update, not initial install
                console.log('[PWA] New version installed and waiting for user confirmation');
                usePwaStore.getState().setUpdateAvailable(true, newWorker);
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });

      // Handle controller change (when skipWaiting activates new SW)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  },

  applyUpdate() {
    usePwaStore.getState().applyUpdate();
  },
};
