import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Global cached deferred prompt so it survives re-renders and page navigation within SPA
let globalDeferredPrompt: BeforeInstallPromptEvent | null = 
  typeof window !== 'undefined' ? (window as any).deferredPwaPrompt || null : null;

if (typeof window !== 'undefined') {

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

    const onPromptReady = () => {
      const p = (window as any).deferredPwaPrompt || globalDeferredPrompt;
      setDeferredPrompt(p);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('webapk-prompt-ready', onPromptReady);
    window.addEventListener('webapk-installed', onInstalled);

    if ((window as any).deferredPwaPrompt || globalDeferredPrompt) {
      setDeferredPrompt((window as any).deferredPwaPrompt || globalDeferredPrompt);
    }

    return () => {
      window.removeEventListener('webapk-prompt-ready', onPromptReady);
      window.removeEventListener('webapk-installed', onInstalled);
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

  return {
    isInstallable: Boolean(deferredPrompt || (typeof window !== 'undefined' && (window as any).deferredPwaPrompt) || globalDeferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    install,
    deferredPrompt: deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null) || globalDeferredPrompt,
  };
}
