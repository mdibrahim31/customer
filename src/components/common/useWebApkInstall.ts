import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function useWebApkInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && (window as any).deferredPwaPrompt) {
      return (window as any).deferredPwaPrompt;
    }
    return null;
  });

  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://') ||
      window.location.search.includes('source=webapk') ||
      window.location.search.includes('source=pwa')
    );
  });

  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandalone =
        typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          window.matchMedia('(display-mode: minimal-ui)').matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
          document.referrer.includes('android-app://') ||
          window.location.search.includes('source=webapk') ||
          window.location.search.includes('source=pwa'));
      setIsInstalled(Boolean(isStandalone));
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkStandalone);

    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(userAgent));
      setIsAndroid(/android/.test(userAgent));
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPwaPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      if (typeof window !== 'undefined') {
        (window as any).deferredPwaPrompt = null;
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (typeof window !== 'undefined' && (window as any).deferredPwaPrompt) {
      setDeferredPrompt((window as any).deferredPwaPrompt);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null);
    if (!promptEvent) return false;
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        if (typeof window !== 'undefined') {
          (window as any).deferredPwaPrompt = null;
        }
        return true;
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt || (typeof window !== 'undefined' && (window as any).deferredPwaPrompt)),
    isInstalled,
    isIOS,
    isAndroid,
    install,
    deferredPrompt: deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null),
  };
}
