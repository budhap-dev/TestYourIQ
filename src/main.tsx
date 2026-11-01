import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ThemeProvider } from './app/ThemeProvider';
import { watchInstallOffer } from './app/install';
import { createRouter } from './app/router';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

watchInstallOffer();
// The service worker (public/sw.js) shows an offline page in the installed app. Not in dev, where
// it would only get in the way of hot reloads.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app works the same without it.
    });
  });
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={createRouter()} />
    </ThemeProvider>
  </StrictMode>,
);
