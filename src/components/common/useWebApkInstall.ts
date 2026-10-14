import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Global cached deferred prompt so it survives re-renders and page navigation within SPA
let globalDeferredPrompt: BeforeInstallPromptEvent | null = 
  typeof window !== 'undefined' ? (window as any).deferredPwaPrompt || null : null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    (window as any).deferredPwaPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    if ((window as any).deferredPwaPrompt) {
      (window as any).deferredPwaPrompt = null;
    }
  });
}

export function useWebApkInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && (window as any).deferredPwaPrompt) {
      return (window as any).deferredPwaPrompt;
    }
    return globalDeferredPrompt;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check standalone mode (already running as installed WebAPK or iOS home screen)
    const checkStandalone = () => {
      if (typeof window === 'undefined') return false;
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://')
      );
    };

    setIsInstalled(checkStandalone());

    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(ua));
      setIsAndroid(/android/.test(ua));
    }

    const syncPrompt = (e?: Event) => {
      if (e && 'prompt' in e) {
        globalDeferredPrompt = e as BeforeInstallPromptEvent;
        (window as any).deferredPwaPrompt = e;
      }
      const p = (window as any).deferredPwaPrompt || globalDeferredPrompt;
      setDeferredPrompt(p);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      if (typeof window !== 'undefined') {
        (window as any).deferredPwaPrompt = null;
      }
    };

    window.addEventListener('beforeinstallprompt', syncPrompt);
    window.addEventListener('webapk-prompt-ready', syncPrompt);
    window.addEventListener('appinstalled', onInstalled);

    syncPrompt();

    return () => {
      window.removeEventListener('beforeinstallprompt', syncPrompt);
      window.removeEventListener('webapk-prompt-ready', syncPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unsupported'> => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null) || globalDeferredPrompt;
    if (!promptEvent) {
      return 'unsupported';
    }

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        globalDeferredPrompt = null;
        if (typeof window !== 'undefined') {
          (window as any).deferredPwaPrompt = null;
        }
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      console.warn('[WebAPK] Install error:', err);
      return 'unsupported';
    }
  }, [deferredPrompt]);

  const currentPrompt = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null) || globalDeferredPrompt;

  return {
    isInstallable: Boolean(currentPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    install,
    deferredPrompt: currentPrompt,
  };
}
