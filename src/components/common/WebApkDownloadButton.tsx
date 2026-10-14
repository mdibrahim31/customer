import React, { useState } from 'react';
import { Download } from 'lucide-react';
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
  const { isInstallable, install } = useWebApkInstall();
  const [isInstalling, setIsInstalling] = useState(false);

  const handleButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. If native PWA / WebAPK prompt is available, trigger it directly (Chrome shows its native OK / Cancel prompt)
    if (isInstallable) {
      try {
        const res = await install();
        if (res === 'accepted') {
          return;
        }
      } catch (err) {
        console.warn('Native install prompt error:', err);
      }
    }

    // 2. No custom DOM window/modal - show browser native prompt with only OK and Cancel
    let confirmed = false;
    try {
      confirmed = window.confirm(`Install ${appName} WebAPK?`);
    } catch {
      confirmed = true;
    }

    if (!confirmed) {
      return;
    }

    // 3. User clicked OK -> download APK or trigger installation
    setIsInstalling(true);
    try {
      const targetApk = apkDownloadUrl || (portalType === 'rider' ? './FoodHub-Rider.apk' : undefined);
      if (targetApk) {
        const link = document.createElement('a');
        link.href = targetApk;
        link.download = targetApk.split('/').pop() || `${portalType}-app.apk`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
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
        className={`w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-xl shadow-orange-500/30 flex items-center justify-center transition active:scale-95 border border-amber-300/60 cursor-pointer ${
          isInstalling ? 'opacity-70 animate-pulse' : ''
        }`}
        title={buttonTitle || `Install ${appName} WebAPK`}
        aria-label={`Install ${appName} WebAPK`}
      >
        <Download className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
};
