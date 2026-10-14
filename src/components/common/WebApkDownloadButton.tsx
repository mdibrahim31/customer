import React, { useState } from 'react';
import { Download, X, Smartphone, Check, Sparkles } from 'lucide-react';
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
  const [showModal, setShowModal] = useState(false);

  const handleButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. If native PWA / WebAPK prompt is available, trigger it directly
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

    // 2. If an APK download URL exists (e.g. Rider APK), download it directly
    const targetApk = apkDownloadUrl || (portalType === 'rider' ? './FoodHub-Rider.apk' : undefined);
    if (targetApk) {
      setIsInstalling(true);
      try {
        const link = document.createElement('a');
        link.href = targetApk;
        link.download = targetApk.split('/').pop() || `${portalType}-app.apk`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      } finally {
        setIsInstalling(false);
      }
    }

    // 3. Otherwise show the beautiful WebAPK / PWA installation guide modal
    setShowModal(true);
  };

  return (
    <>
      <div className={className}>
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={isInstalling}
          className={`w-11 h-11 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center transition active:scale-95 border border-amber-300/60 cursor-pointer ${
            isInstalling ? 'opacity-70 animate-pulse' : ''
          }`}
          title={buttonTitle || `Install ${appName} WebAPK`}
          aria-label={`Install ${appName} WebAPK`}
        >
          <Download className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* WebAPK / PWA Installation Instructions Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-slate-900 text-left relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">Install {appName} App</h3>
                <p className="text-xs text-slate-500">Add to your phone home screen for instant access</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-black flex items-center justify-center shrink-0 text-[10px]">1</span>
                <p>Tap your browser menu icon (<b className="text-slate-900">⋮</b> or <b className="text-slate-900">share</b> button at top/bottom).</p>
              </div>
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-black flex items-center justify-center shrink-0 text-[10px]">2</span>
                <p>Select <b className="text-slate-900">"Install app"</b> or <b className="text-slate-900">"Add to Home screen"</b>.</p>
              </div>
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-black flex items-center justify-center shrink-0 text-[10px]">3</span>
                <p>Enjoy lightning-fast ordering like a native app!</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isInstallable) {
                  install();
                }
                setShowModal(false);
              }}
              className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-wider rounded-2xl transition shadow-lg shadow-orange-500/30 flex items-center justify-center space-x-2 cursor-pointer text-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Got It & Install</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
