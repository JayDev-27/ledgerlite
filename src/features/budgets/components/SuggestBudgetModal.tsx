import React, { useState } from 'react';
import { Sparkles, X, Check, RefreshCw } from 'lucide-react';
import { BudgetSuggestionResult } from '@/lib/budget';
import { formatCurrency } from '@/lib/formatters';
import { CategoryTypeBadge } from '@/components/common/Badge';

interface SuggestBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: BudgetSuggestionResult | null;
  isLoading: boolean;
  onRegenerate: () => void;
  onApply: (totalLimit: number, categoryLimits: Record<string, number>) => Promise<void>;
}

export const SuggestBudgetModal: React.FC<SuggestBudgetModalProps> = ({
  isOpen,
  onClose,
  suggestion,
  isLoading,
  onRegenerate,
  onApply,
}) => {
  const [editedLimits, setEditedLimits] = useState<Record<string, number>>({});
  const [isApplying, setIsApplying] = useState(false);

  // Sync editedLimits with suggestion whenever suggestion changes
  React.useEffect(() => {
    if (suggestion) {
      setEditedLimits({ ...suggestion.categoryLimits });
    }
  }, [suggestion]);

  if (!isOpen) return null;

  const handleLimitChange = (catId: string, value: number) => {
    setEditedLimits((prev) => ({
      ...prev,
      [catId]: Math.max(0, value || 0),
    }));
  };

  const calculatedTotal = Object.values(editedLimits).reduce((a, b) => a + b, 0);

  const handleApply = async () => {
    try {
      setIsApplying(true);
      await onApply(calculatedTotal, editedLimits);
      onClose();
    } catch (e) {
      console.error('Failed to apply suggested budget:', e);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-dark-surface rounded-3xl border border-cream-200 dark:border-dark-border w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 border-b border-cream-100 dark:border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-deep-blue-50 dark:bg-dark-elevated text-deep-blue-600 dark:text-cream-100">
              <Sparkles className="w-5 h-5 text-deep-blue-500 dark:text-cream-100" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-deep-blue-900 dark:text-cream-100">
                AI Budget Recommendation
              </h2>
              <p className="text-xs text-deep-blue-600 dark:text-cream-300">
                {suggestion?.isAiGenerated
                  ? 'Optimized with Gemini 3.8 Flash & 50/30/20 wealth rules'
                  : 'Derived from 3-month spending trends & 50/30/20 heuristic'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-deep-blue-600 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-deep-blue-500 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-deep-blue-900 dark:text-cream-100">
                Analyzing 3-month spending patterns...
              </p>
              <p className="text-xs text-deep-blue-600 dark:text-cream-300 max-w-sm mx-auto">
                Synthesizing history across categories and balancing with 50/30/20 guidelines.
              </p>
            </div>
          ) : suggestion ? (
            <>
              {/* Rationale Callout */}
              <div className="p-4 rounded-2xl bg-deep-blue-50/70 dark:bg-dark-elevated border border-deep-blue-100 dark:border-dark-border text-xs text-deep-blue-800 dark:text-cream-200">
                <div className="font-bold text-deep-blue-900 dark:text-cream-100 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-deep-blue-500 dark:text-cream-100" />
                  Recommendation Rationale
                </div>
                <p className="leading-relaxed">{suggestion.rationale}</p>

                {/* 50/30/20 breakdown indicators */}
                <div className="mt-3 pt-3 border-t border-deep-blue-100 dark:border-dark-border grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-white/60 dark:bg-dark-surface/60">
                    <span className="text-[10px] text-deep-blue-600 dark:text-cream-300 uppercase font-semibold">
                      Needs
                    </span>
                    <div className="text-sm font-bold text-deep-blue-900 dark:text-cream-100 tabular-nums">
                      {suggestion.needPercent}%{' '}
                      <span className="text-[10px] font-normal text-deep-blue-500 dark:text-cream-300">
                        (target 50%)
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white/60 dark:bg-dark-surface/60">
                    <span className="text-[10px] text-deep-blue-600 dark:text-cream-300 uppercase font-semibold">
                      Wants
                    </span>
                    <div className="text-sm font-bold text-deep-blue-900 dark:text-cream-100 tabular-nums">
                      {suggestion.wantPercent}%{' '}
                      <span className="text-[10px] font-normal text-deep-blue-500 dark:text-cream-300">
                        (target 30%)
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white/60 dark:bg-dark-surface/60">
                    <span className="text-[10px] text-deep-blue-600 dark:text-cream-300 uppercase font-semibold">
                      Savings
                    </span>
                    <div className="text-sm font-bold text-deep-blue-900 dark:text-cream-100 tabular-nums">
                      {suggestion.savingsPercent}%{' '}
                      <span className="text-[10px] font-normal text-deep-blue-500 dark:text-cream-300">
                        (target 20%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Category Limits Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-deep-blue-700 dark:text-cream-300">
                    Review & Customize Limits
                  </h3>
                  <button
                    onClick={onRegenerate}
                    className="text-xs font-semibold text-deep-blue-600 dark:text-cream-200 hover:text-deep-blue-900 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </div>

                <div className="space-y-3">
                  {suggestion.items.map((item) => (
                    <div
                      key={item.categoryId}
                      className="p-3.5 rounded-2xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-sm text-deep-blue-900 dark:text-cream-100 truncate">
                            {item.categoryName}
                          </span>
                          <CategoryTypeBadge type={item.categoryType} />
                        </div>
                        <div className="text-xs text-deep-blue-600 dark:text-cream-300 truncate">
                          3-mo avg: {formatCurrency(item.threeMonthAverage, { hideDecimals: true })} • {item.reason}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs font-semibold text-deep-blue-600 dark:text-cream-300">
                          ₹
                        </span>
                        <input
                          type="number"
                          step={500}
                          min={0}
                          value={editedLimits[item.categoryId] ?? item.proposedLimit}
                          onChange={(e) =>
                            handleLimitChange(item.categoryId, parseFloat(e.target.value) || 0)
                          }
                          className="w-28 px-3 py-1.5 rounded-xl border border-cream-300 dark:border-dark-border bg-white dark:bg-dark-surface font-bold text-deep-blue-900 dark:text-cream-100 tabular-nums text-sm text-right focus:ring-2 focus:ring-deep-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-deep-blue-600 dark:text-cream-300">
              No recommendations available. Click generate to start.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-cream-100 dark:border-dark-border flex items-center justify-between bg-cream-50/50 dark:bg-dark-elevated/50">
          <div>
            <span className="text-xs text-deep-blue-600 dark:text-cream-300">
              Total Proposed Budget:
            </span>
            <div className="text-xl font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">
              {formatCurrency(calculatedTotal, { hideDecimals: true })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2.5 rounded-xl font-semibold text-xs text-deep-blue-700 dark:text-cream-200 hover:bg-cream-100 dark:hover:bg-dark-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || isLoading || !suggestion}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-deep-blue-500 hover:bg-deep-blue-600 text-white shadow-md flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
            >
              {isApplying ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Accept & Apply Budget
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
