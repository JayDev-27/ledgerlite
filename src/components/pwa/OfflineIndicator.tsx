import React from 'react';
import { WifiOff, ShieldCheck } from 'lucide-react';
import { usePwa } from '@/lib/pwa';

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = usePwa();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="print:hidden mx-4 sm:mx-6 mt-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-dark-elevated border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-cream-100 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-card animate-fadeIn"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
          <WifiOff className="w-4 h-4" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className="font-semibold flex items-center gap-1.5">
            Offline Mode Active
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </span>
          <span className="text-deep-blue-800/80 dark:text-cream-300 text-xs">
            100% Local-First. Your ledger, budgets, and reports are fully available on this device.
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full flex-shrink-0 font-medium">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>IndexedDB Ready</span>
      </div>
    </div>
  );
};
