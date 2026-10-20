import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { TooltipProvider } from './components/ui/tooltip.tsx';
import { Toaster } from './components/ui/toaster.tsx';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <App />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Register service worker (PWA) — auto-update on new version detection.
// Checks for SW updates every 60 minutes while the app is open. When a
// new version is found, skipWaiting + clients.claim activate it on the
// next navigation — no user prompt needed.
import { registerSW } from 'virtual:pwa-register';
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateSW(true); },
  onOfflineReady() { console.log('Journada ready for offline use.'); },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);
  },
});

// After a new SW activates and claims this tab, reload so the page
// fetches fresh assets from the new precache. Only for an UPDATE: on a
// first-ever visit there is no controller yet, the page already runs the
// current assets, and reloading would wipe whatever the person is doing
// (it aborted sign-up mid-request in the e2e journey).
if ('serviceWorker' in navigator) {
  const hadController = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
  });
}
