import React from 'react';
import { Lightbulb, Check } from 'lucide-react';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

interface RuleLearningModalProps {
  isOpen: boolean;
  merchant: string;
  categoryName: string;
  affectedCount: number;
  onConfirm: (applyToPast: boolean) => Promise<void>;
  onCancel: () => void;
}

export const RuleLearningModal: React.FC<RuleLearningModalProps> = ({
  isOpen,
  merchant,
  categoryName,
  affectedCount,
  onConfirm,
  onCancel,
}) => {
  const modalRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: onCancel });

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-learn-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white dark:bg-dark-surface rounded-modal border border-cream-200 dark:border-dark-border shadow-modal p-6 space-y-4"
      >
        <div className="flex items-center gap-2.5 text-deep-blue-900 dark:text-cream-100">
          <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950/50 text-deep-blue-600 dark:text-cream-200">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h3 id="rule-learn-title" className="font-semibold text-sm">
              Teach LedgerLite a Rule
            </h3>
            <p className="text-xs text-deep-blue-700/70 dark:text-cream-400">
              Automate future transaction classifications
            </p>
          </div>
        </div>

        <p className="text-xs text-deep-blue-800 dark:text-cream-200 leading-relaxed">
          Always categorize <strong className="font-semibold text-deep-blue-950 dark:text-cream-100">&ldquo;{merchant}&rdquo;</strong> as{' '}
          <strong className="font-semibold text-deep-blue-950 dark:text-cream-100">{categoryName}</strong>?
          {affectedCount > 0 && (
            <span className="block mt-1 text-deep-blue-700 dark:text-cream-200 font-medium">
              Found {affectedCount} existing transactions from &ldquo;{merchant}&rdquo; that can also be updated.
            </span>
          )}
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-cream-100 dark:border-dark-border">
          <button
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
          >
            No, Just Once
          </button>

          {affectedCount > 0 ? (
            <>
              <button
                onClick={() => onConfirm(false)}
                className="px-3.5 py-2 rounded-xl border border-cream-300 dark:border-dark-border text-xs font-semibold text-deep-blue-900 dark:text-cream-100 hover:bg-cream-50 dark:hover:bg-dark-elevated transition-colors"
              >
                Learn for Future Only
              </button>
              <button
                onClick={() => onConfirm(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold transition-all shadow-sm dark:bg-white dark:text-black dark:hover:bg-cream-200"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Learn & Update Past {affectedCount}</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onConfirm(false)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold transition-all shadow-sm dark:bg-white dark:text-black dark:hover:bg-cream-200"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Always Remember</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
