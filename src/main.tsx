import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { serviceWorkerService } from './services/serviceWorkerService';
import './index.css';

if (import.meta.env.DEV) {
  import('./testing/testAuthHarness').then((mod) => {
    if (mod && typeof mod.installTestAuthHarness === 'function') {
      mod.installTestAuthHarness();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker for PWA & Offline Support
try {
  serviceWorkerService.register();
} catch (err) {
  console.warn('[PWA] Registration invocation failed:', err);
}


