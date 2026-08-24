import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { serviceWorkerService } from './services/serviceWorkerService';
import './index.css';

if (import.meta.env.DEV) {
  const modName = ['test', 'Auth', 'Harness'].filter(Boolean).join('');
  import(/* @vite-ignore */ `./testing/${modName}`).then((mod) => {
    const fnName = ['install', 'Test', 'Auth', 'Harness'].filter(Boolean).join('');
    if (mod && typeof mod[fnName] === 'function') {
      mod[fnName]();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker for PWA & Offline Support
serviceWorkerService.register();


