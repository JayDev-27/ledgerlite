import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const INSTALL_DISMISSED_KEY = 'ledgerlite_pwa_install_dismissed';

export function checkIsStandalone(
  win?: Window | null,
  nav?: (Navigator & { standalone?: boolean }) | null
): boolean {
  const currentWin = win ?? (typeof window !== 'undefined' ? window : null);
  const currentNav = nav ?? (typeof navigator !== 'undefined' ? (navigator as Navigator & { standalone?: boolean }) : null);

  if (!currentWin || !currentNav) return false;

  const isStandalone = typeof currentWin.matchMedia === 'function' &&
    currentWin.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = currentNav.standalone === true;

  return Boolean(isStandalone || isIosStandalone);
}

export function getPwaDismissed(storage?: Storage | null): boolean {
  const currentStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!currentStorage) return false;
  try {
    return currentStorage.getItem(INSTALL_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setPwaDismissed(storage?: Storage | null): void {
  const currentStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!currentStorage) return;
  try {
    currentStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
  } catch {
    // Ignore restricted storage contexts
  }
}

export interface UsePwaReturn {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isInstallDismissed: boolean;
  installApp: () => Promise<'accepted' | 'dismissed' | null>;
  dismissInstall: () => void;
}

export function usePwa(): UsePwaReturn {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallDismissed, setIsInstallDismissed] = useState<boolean>(() => {
    return getPwaDismissed();
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    return checkIsStandalone();
  });

  // Track online/offline status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!installPromptEvent) return null;

    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setInstallPromptEvent(null);
      return choice.outcome;
    } catch {
      return null;
    }
  }, [installPromptEvent]);

  const dismissInstall = useCallback(() => {
    setIsInstallDismissed(true);
    setPwaDismissed();
  }, []);

  return {
    isOnline,
    isInstallable: !!installPromptEvent && !isInstalled && !isInstallDismissed,
    isInstalled,
    isInstallDismissed,
    installApp,
    dismissInstall,
  };
}
