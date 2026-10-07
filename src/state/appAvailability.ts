import { create } from 'zustand';
import { useGame } from './store';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export const useAvailability = create<{
  online: boolean;
  offline: 'loading' | 'ready' | 'unavailable';
  updateReady: boolean;
  installAvailable: boolean;
  installed: boolean;
}>(() => ({ online: navigator.onLine, offline: 'loading', updateReady: false, installAvailable: false, installed: window.matchMedia('(display-mode: standalone)').matches }));

let registration: ServiceWorkerRegistration | null = null;
let promptEvent: InstallPrompt | null = null;
let reloadForUpdate = false;
let started = false;

export function startOfflineSupport(): void {
  if (started) return;
  started = true;
  window.addEventListener('online', () => useAvailability.setState({ online: true }));
  window.addEventListener('offline', () => useAvailability.setState({ online: false }));
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); promptEvent = event as InstallPrompt;
    useAvailability.setState({ installAvailable: true });
  });
  window.addEventListener('appinstalled', () => {
    promptEvent = null; useAvailability.setState({ installed: true, installAvailable: false });
  });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) {
    useAvailability.setState({ offline: 'unavailable' }); return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    useAvailability.setState({ offline: 'ready', updateReady: false });
    if (reloadForUpdate && useGame.getState().screen !== 'battle') location.reload();
  });
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).then((reg) => {
    registration = reg;
    if (reg.active) useAvailability.setState({ offline: 'ready' });
    const inspect = () => {
      if (reg.waiting) useAvailability.setState({ updateReady: true });
    };
    inspect();
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        inspect();
        if (worker.state === 'redundant' && !reg.active) useAvailability.setState({ offline: 'unavailable' });
      });
    });
    void navigator.serviceWorker.ready.then(() => useAvailability.setState({ offline: 'ready' }));
  }).catch(() => useAvailability.setState({ offline: 'unavailable' }));
}

export async function installGame(): Promise<void> {
  const event = promptEvent;
  if (!event) return;
  promptEvent = null; useAvailability.setState({ installAvailable: false });
  try { await event.prompt(); await event.userChoice; } catch { /* Browser can withdraw the prompt. */ }
}

export function applyGameUpdate(): void {
  if (!registration?.waiting || useGame.getState().screen === 'battle') return;
  reloadForUpdate = true;
  registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
}
