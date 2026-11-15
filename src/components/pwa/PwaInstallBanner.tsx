import React, { useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { usePwa } from '@/lib/pwa';
import { APP_NAME } from '@/constants/app';

export const PwaInstallBanner: React.FC = () => {
  const { isInstallable, installApp, dismissInstall } = usePwa();
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isInstallable) return null;

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await installApp();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div
      role="banner"
      aria-label="Install Application Prompt"
      className="print:hidden mx-4 sm:mx-6 mt-3 p-3.5 rounded-xl bg-deep-blue-500 text-cream-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-modal animate-fadeIn"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-deep-blue-600 border border-sky-400/30 flex items-center justify-center flex-shrink-0 text-cream-100">
          <Smartphone className="w-5 h-5 text-cream-200" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
            <span>Install {APP_NAME}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-deep-blue-700 text-cream-200">
              PWA
            </span>
          </div>
          <p className="text-xs text-cream-200/90 leading-tight">
            Install on your desktop or mobile home screen for instant offline launch, full-screen view, and dock shortcuts.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          aria-label={`Install ${APP_NAME} application`}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cream-100 hover:bg-white text-deep-blue-900 font-bold text-xs shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cream-200 focus-visible:ring-offset-2"
        >
          <Download className="w-3.5 h-3.5 text-deep-blue-700" />
          <span>{isInstalling ? 'Installing...' : 'Install App'}</span>
        </button>

        <button
          onClick={dismissInstall}
          aria-label="Dismiss install prompt"
          title="Dismiss install prompt"
          className="p-1.5 rounded-lg text-cream-200 hover:text-white hover:bg-deep-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cream-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
