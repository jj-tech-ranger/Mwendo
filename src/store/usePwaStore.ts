import { create } from 'zustand';

interface PwaState {
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
  waitingWorker: ServiceWorker | null;
  setUpdateAvailable: (isAvailable: boolean, waitingWorker?: ServiceWorker | null) => void;
  setRegistration: (registration: ServiceWorkerRegistration | null) => void;
  applyUpdate: () => void;
}

export const usePwaStore = create<PwaState>((set, get) => ({
  isUpdateAvailable: false,
  registration: null,
  waitingWorker: null,
  setUpdateAvailable: (isUpdateAvailable, waitingWorker = null) =>
    set({ isUpdateAvailable, waitingWorker }),
  setRegistration: (registration) => set({ registration }),
  applyUpdate: () => {
    const { waitingWorker } = get();
    if (waitingWorker) {
      // Post SKIP_WAITING to waiting service worker
      try {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        waitingWorker.postMessage('SKIP_WAITING');
      } catch (e) {
        console.warn('[PWA] Failed to message waiting worker:', e);
      }
    }

    if (typeof window !== 'undefined') {
      let refreshing = false;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      }
      setTimeout(() => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      }, 1000);
    }
  },
}));
