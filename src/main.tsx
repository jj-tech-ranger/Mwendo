import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { serviceWorkerService } from './services/serviceWorkerService';
import './index.css';

if (import.meta.env.DEV) {
  import('./testing/testAuthHarness').then(({ installTestAuthHarness }) => {
    installTestAuthHarness();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker for PWA & Offline Support
serviceWorkerService.register();


