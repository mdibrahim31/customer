import React, { useState } from 'react';
import { 
  Download, 
  Loader2, 
  Smartphone, 
  MoreVertical, 
  CheckCircle2, 
  X, 
  ArrowRight, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { useWebApkInstall } from './useWebApkInstall';

export interface WebApkDownloadButtonProps {
  appName?: string;
  portalType: 'rider' | 'vendor' | 'admin' | 'subadmin' | 'customer' | 'orders';
  className?: string;
  apkDownloadUrl?: string;
  buttonTitle?: string;
}

export const WebApkDownloadButton: React.FC<WebApkDownloadButtonProps> = ({
  appName = 'FoodHub',
  portalType,
  className = 'absolute top-4 right-4 z-20',
  apkDownloadUrl,
  buttonTitle
}) => {
  const { isInstallable, isInstalled, isIOS, install, deferredPrompt } = useWebApkInstall();
  const [isInstalling, setIsInstalling] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  const displayAppName = appName.includes('FoodHub') ? appName : `FoodHub ${appName}`;

  const showToast = (text: string, type: 'success' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInstalling) return;

    // 1. If already installed as WebAPK
    if (isInstalled) {
      showToast(`✅ ${displayAppName} অ্যাপ আগেই আপনার ফোনের App Drawer এ ইন্সটল করা আছে!`, 'success');
      return;
    }

    setIsInstalling(true);

    try {
      // 2. Direct WebAPK Installation if prompt is ready
      const promptObj = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null);
      if (promptObj || isInstallable) {
        const res = await install();
        if (res === 'accepted') {
          showToast('🎉 WebAPK অ্যাপ ড্রয়ারে ইন্সটল হচ্ছে! কিছুক্ষণ অপেক্ষা করুন...', 'success');
          setIsInstalling(false);
          return;
        } else if (res === 'dismissed') {
          showToast('ইনস্টলেশন বাতিল করা হয়েছে। আপনি যেকোনো সময় আবার চেষ্টা করতে পারেন।', 'info');
          setIsInstalling(false);
          return;
        }
      }

      // 3. Direct APK Download URL if provided (e.g. Rider APK)
      const targetApk = apkDownloadUrl || (portalType === 'rider' ? '/FoodHub-Rider.apk' : undefined);
      if (targetApk) {
        const link = document.createElement('a');
        link.href = targetApk;
        link.download = targetApk.split('/').pop() || `${portalType}-app.apk`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('⬇️ APK ফাইল ডাউনলোড শুরু হয়েছে...', 'success');
        setIsInstalling(false);
        return;
      }

      // 4. Brief 350ms wait in case beforeinstallprompt is in transit
      let promptFired = false;
      const promptPromise = new Promise<'accepted' | 'dismissed' | 'timeout'>((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('webapk-prompt-ready', handler);
          resolve('timeout');
        }, 400);

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
      if (outcome === 'accepted') {
        showToast('🎉 WebAPK অ্যাপ ড্রয়ারে ইন্সটল হচ্ছে! কিছুক্ষণ অপেক্ষা করুন...', 'success');
        setIsInstalling(false);
        return;
      } else if (outcome === 'dismissed') {
        showToast('ইনস্টলেশন বাতিল করা হয়েছে।', 'info');
        setIsInstalling(false);
        return;
      }

      // 5. If browser did not offer automatic prompt or it was dismissed previously:
      // Show the dedicated visual step-by-step WebAPK install modal
      setShowGuideModal(true);
    } catch (err) {
      console.warn('[WebAPK] Install error:', err);
      setShowGuideModal(true);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleModalTryAgain = async () => {
    const promptObj = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPwaPrompt : null);
    if (promptObj) {
      const res = await install();
      if (res === 'accepted') {
        setShowGuideModal(false);
        showToast('🎉 WebAPK অ্যাপ ড্রয়ারে ইন্সটল হচ্ছে!', 'success');
      }
    } else {
      // Set session flag and reload to trigger fresh prompt
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem('trigger_webapk_install', 'true');
        }
      } catch (e) {}
      window.location.reload();
    }
  };

  return (
    <>
      <div className={className}>
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={isInstalling}
          className={`w-11 h-11 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-90 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center transition-all border border-amber-300/60 cursor-pointer ${
            isInstalling ? 'opacity-80' : ''
          }`}
          title={buttonTitle || `Install ${displayAppName} WebAPK into App Drawer`}
          aria-label={`Install ${displayAppName} WebAPK`}
        >
          {isInstalling ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5 stroke-[2.5]" />
          )}
        </button>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 inset-x-4 z-[9999] max-w-sm mx-auto flex items-center space-x-2.5 p-3.5 bg-slate-900/95 text-white rounded-2xl shadow-2xl backdrop-blur-md border border-slate-700 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="flex-1 leading-snug">{toastMessage.text}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* WebAPK App Drawer Installation Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-6 text-white text-center relative">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 text-white flex items-center justify-center transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>

              <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Smartphone className="w-8 h-8 text-white stroke-[2.2]" />
              </div>

              <h3 className="text-xl font-black tracking-tight">{displayAppName} WebAPK</h3>
              <p className="text-orange-100 text-xs font-semibold mt-1">
                মোবাইল ফোনের App Drawer এ ইন্সটল করুন
              </p>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-slate-800">
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start space-x-2.5 text-xs text-amber-900 leading-relaxed font-medium">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  WebAPK ইন্সটল করলে অ্যাপটি সরাসরি মোবাইল ফোনের <strong>App Drawer</strong> এবং হোমস্ক্রিনে চলে আসবে এবং যেকোনো সাধারণ অ্যান্ড্রয়েড অ্যাপের মতো কাজ করবে।
                </span>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="space-y-2.5 pt-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {isIOS ? 'iPhone / iOS এ ইন্সটল করার নিয়ম:' : 'Chrome ব্রাউজারে ৩টি সহজ ধাপে ইন্সটল:'}
                </h4>

                {isIOS ? (
                  <div className="space-y-2 text-xs font-semibold text-slate-700">
                    <div className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs shrink-0">1</span>
                      <span>Safari এর নিচে <strong>Share (শেয়ার)</strong> বাটনে চাপ দিন</span>
                    </div>
                    <div className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs shrink-0">2</span>
                      <span>মেনু থেকে <strong>"Add to Home Screen"</strong> বেছে নিন</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs font-semibold text-slate-700">
                    <div className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs shrink-0">1</span>
                      <div className="flex-1 flex items-center justify-between">
                        <span>ব্রাউজারের উপরে ডানদিকের <strong>৩টি ডট</strong> মেনুতে চাপুন</span>
                        <MoreVertical className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs shrink-0">2</span>
                      <div className="flex-1 flex items-center justify-between">
                        <span>মেনু থেকে <strong>"Install app"</strong> (বা <strong>"Add to Home screen"</strong>) চাপুন</span>
                        <Download className="w-4 h-4 text-orange-600 shrink-0" />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5 p-2.5 bg-orange-50/60 rounded-xl border border-orange-200/60">
                      <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center font-black text-xs shrink-0">3</span>
                      <span><strong>"Install"</strong> বাটনে চাপ দিলেই App Drawer এ WebAPK তৈরি হয়ে যাবে!</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleModalTryAgain}
                  className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 active:scale-98 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-orange-600/25 transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>এখনই ইন্সটল করার চেষ্টা করুন</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs transition cursor-pointer"
                >
                  ঠিক আছে, বুঝেছি
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
