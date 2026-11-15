import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface UndoToastProps {
  merchant: string;
  amount: number;
  onUndo: () => void;
  onDismiss: () => void;
  durationSeconds?: number;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  merchant,
  amount,
  onUndo,
  onDismiss,
  durationSeconds = 5,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(durationSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-6 right-6 z-50 flex items-center gap-3 p-4 rounded-card bg-deep-blue-950 text-cream-100 shadow-modal border border-deep-blue-800 animate-slideUp max-w-md"
    >
      <div className="flex-1 text-xs">
        <p className="font-semibold text-cream-100">
          Deleted &ldquo;{merchant}&rdquo; ({formatCurrency(amount)})
        </p>
        <p className="text-cream-300/80 text-[11px] mt-0.5">
          Undo available for {secondsRemaining}s...
        </p>
      </div>

      <button
        onClick={onUndo}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-deep-blue-950 text-xs font-bold transition-all shadow-sm active:scale-95"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Undo ({secondsRemaining}s)</span>
      </button>

      <button
        onClick={onDismiss}
        aria-label="Dismiss undo notification"
        title="Dismiss undo notification"
        className="p-1 rounded-md text-cream-400 hover:text-white hover:bg-deep-blue-900 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cream-200"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
