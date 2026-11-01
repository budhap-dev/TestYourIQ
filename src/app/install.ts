import { useSyncExternalStore } from 'react';

/** Chromium's install offer (Android, desktop Chrome and Edge); not in TypeScript's DOM types. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** How this browser can install the app: our own button, Share-menu steps, or not at all. */
export type InstallOption = 'prompt' | 'ios' | null;

let offer: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPhone and iPad install from the Share menu and never send an install offer. iPadOS reports
// itself as a Mac, so touch support tells them apart.
const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

function getOption(): InstallOption {
  if (isInstalled()) return null;
  if (offer) return 'prompt';
  return isIos() ? 'ios' : null;
}

/**
 * Keeps the browser's install offer for the footer button. The offer can arrive before React
 * renders, so call this once at startup. The browser's own install UI is left in place.
 */
export function watchInstallOffer(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    offer = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    notify();
  });
}

export function useInstallOption(): InstallOption {
  return useSyncExternalStore(subscribe, getOption, () => null);
}

export async function promptInstall(): Promise<void> {
  const current = offer;
  if (!current) return;
  // An offer can only be shown once; the browser sends a new one if it's dismissed.
  offer = null;
  notify();
  await current.prompt();
}
