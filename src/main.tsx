import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { serviceWorkerService } from './services/serviceWorkerService';
import './index.css';

/**
 * Material Symbols are delivered by Google Fonts. Hide their ligature text
 * until the font is ready so names such as "menu" or "shield" never flash
 * visibly before the glyph is available.
 *
 * The timeout is intentional: a failed font request must never leave icons
 * permanently invisible or block application rendering.
 */
const revealMaterialIcons = () => {
  const reveal = () => document.documentElement.classList.remove('icons-loading');

  if ('fonts' in document) {
    const fontReady = document.fonts.load('24px "Material Symbols Outlined"');
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 1800));
    Promise.race([fontReady, timeout]).then(reveal).catch(reveal);
  } else {
    window.setTimeout(reveal, 250);
  }
};

revealMaterialIcons();

if (import.meta.env.DEV) {
  import('./testing/testAuthHarness').then((mod) => {
    if (mod && typeof mod.installTestAuthHarness === 'function') {
      mod.installTestAuthHarness();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register Service Worker for PWA & Offline Support
try {
  serviceWorkerService.register();
} catch (err) {
  console.warn('[PWA] Registration invocation failed:', err);
}
