import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useWebApkInstall } from './useWebApkInstall';

export interface WebApkDownloadButtonProps {
  appName?: string;
  portalType?: 'rider' | 'vendor' | 'admin' | 'subadmin' | 'customer' | 'orders';
  className?: string;
  apkDownloadUrl?: string;
  buttonTitle?: string;
}

export const WebApkDownloadButton: React.FC<WebApkDownloadButtonProps> = ({
  appName = 'Customer App',
  className = 'absolute top-4 right-4 z-20',
  buttonTitle
}) => {
  const { isInstalled, install, deferredPrompt } = useWebApkInstall();
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running as installed WebAPK or standalone PWA, hide download button
  if (isInstalled) {
    return null;
  }

  const handleButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInstalling) return;
    setIsInstalling(true);

    try {
      // 1. If prompt is ready, immediately trigger Chrome's native WebAPK install dialog
      if (deferredPrompt || (typeof window !== 'undefined' && (window as any).deferredPwaPrompt)) {
        await install();
        return;
      }

      // 2. If prompt is still initializing, wait briefly and trigger
      const checkPrompt = () => {
        return (window as any).deferredPwaPrompt || deferredPrompt;
      };

      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 100));
        if (checkPrompt()) {
          await install();
          return;
        }
      }

      // 3. Final attempt
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
