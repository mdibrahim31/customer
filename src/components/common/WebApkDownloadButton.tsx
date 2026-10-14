import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useWebApkInstall } from './useWebApkInstall';

export interface WebApkDownloadButtonProps {
  appName: string;
  portalType: 'rider' | 'vendor' | 'admin' | 'subadmin' | 'customer' | 'orders';
  className?: string;
  apkDownloadUrl?: string;
  buttonTitle?: string;
}

export const WebApkDownloadButton: React.FC<WebApkDownloadButtonProps> = ({
  appName,
  portalType,
  className = 'absolute top-4 right-4 z-20',
  apkDownloadUrl,
  buttonTitle
}) => {
  const { isInstallable, isInstalled, install, deferredPrompt } = useWebApkInstall();
  const [isInstalling, setIsInstalling] = useState(false);

  const handleButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInstalling) return;

    // If already installed as WebAPK
    if (isInstalled) {
      alert(`✅ ${appName} is already installed on your device.`);
      return;
    }

    setIsInstalling(true);

    try {
      // 1. Direct WebAPK Installation if prompt is ready
      const promptObj = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null);
      if (promptObj || isInstallable) {
        const res = await install();
        if (res === 'accepted' || res === 'dismissed') {
          setIsInstalling(false);
          return;
        }
      }

      // 2. Direct APK Download URL if provided (e.g. Rider APK)
      const targetApk = apkDownloadUrl || (portalType === 'rider' ? '/FoodHub-Rider.apk' : undefined);
      if (targetApk) {
        const link = document.createElement('a');
        link.href = targetApk;
        link.download = targetApk.split('/').pop() || `${portalType}-app.apk`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsInstalling(false);
        return;
      }

      // 4. Wait a moment for beforeinstallprompt in case browser is still evaluating PWA criteria
      let promptFired = false;
      const promptPromise = new Promise<'accepted' | 'dismissed' | 'timeout'>((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('webapk-prompt-ready', handler);
          resolve('timeout');
        }, 1500);

        const handler = async () => {
          promptFired = true;
          clearTimeout(timeout);
          window.removeEventListener('webapk-prompt-ready', handler);
          const outcome = await install();
          resolve(outcome === 'unsupported' ? 'timeout' : outcome);
        };

        window.addEventListener('webapk-prompt-ready', handler);
      });

      const outcome = await promptPromise;
      if (outcome === 'accepted' || outcome === 'dismissed' || promptFired) {
        setIsInstalling(false);
        return;
      }

      // 5. Final attempt
      await install();
    } catch (err) {
      console.warn('Install error:', err);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={isInstalling}
        className={`w-11 h-11 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center transition active:scale-95 border border-amber-300/60 cursor-pointer ${
          isInstalling ? 'opacity-80' : ''
        }`}
        title={buttonTitle || `Install ${appName} WebAPK`}
        aria-label={`Install ${appName} WebAPK`}
      >
        {isInstalling ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Download className="w-5 h-5 stroke-[2.5]" />
        )}
      </button>
    </div>
  );
};
