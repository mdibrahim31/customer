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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      // Direct native PWA install prompt triggering WebAPK generation
      const success = await install();
      if (!success) {
        // If prompt wasn't provided by browser yet or already completed
        const hasPrompt = Boolean(deferredPrompt || (typeof window !== 'undefined' && (window as any).deferredPwaPrompt));
        if (!hasPrompt) {
          setToastMessage('ক্রোম ব্রাউজার মেন্যু (⋮) থেকে "Install app" এ ট্যাপ করুন');
          setTimeout(() => setToastMessage(null), 3500);
        }
      }
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
        title={buttonTitle || `Install ${appName}`}
        aria-label={`Install ${appName}`}
      >
        {isInstalling ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Download className="w-5 h-5 stroke-[2.5]" />
        )}
      </button>

      {/* Quick toast if browser prompt is suppressed */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/95 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-2xl backdrop-blur border border-slate-700/80 animate-in fade-in slide-in-from-top-2 text-center pointer-events-none max-w-[90vw]">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
