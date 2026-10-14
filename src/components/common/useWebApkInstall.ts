import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Global cached deferred prompt so it survives re-renders and page navigation within SPA
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('webapk-prompt-ready'));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    window.dispatchEvent(new CustomEvent('webapk-installed'));
  });

  // Ensure service worker is registered with relative path support for GitHub Pages
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          console.log('✅ WebAPK PWA Service Worker active:', reg.scope);
        })
        .catch(() => {
          navigator.serviceWorker.register('/sw.js').catch((err) => {
            console.warn('[WebAPK] Service worker registration note:', err);
          });
        });
    });
  }
}

export function useWebApkInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => globalDeferredPrompt);
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
      setDeferredPrompt(globalDeferredPrompt);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('webapk-prompt-ready', onPromptReady);
    window.addEventListener('webapk-installed', onInstalled);

    // Initial check in case it was captured before hook mounted
    if (globalDeferredPrompt && !deferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
    }

    return () => {
      window.removeEventListener('webapk-prompt-ready', onPromptReady);
      window.removeEventListener('webapk-installed', onInstalled);
    };
  }, [deferredPrompt]);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unsupported'> => {
    const promptEvent = deferredPrompt || globalDeferredPrompt;
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
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      console.warn('[WebAPK] Install error:', err);
      return 'unsupported';
    }
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt || globalDeferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    install,
  };
}
