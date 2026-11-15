import React, { useState, useEffect } from 'react';
import { X, Check, Calculator } from 'lucide-react';
import { Budget, Category } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { CategoryTypeBadge } from '@/components/common/Badge';

interface EditBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: string;
  budget?: Budget;
  categories: Category[];
  onSave: (budget: Budget) => Promise<void>;
  preselectedCategoryId?: string;
}

export const EditBudgetModal: React.FC<EditBudgetModalProps> = ({
  isOpen,
  onClose,
  month,
  budget,
  categories,
  onSave,
  preselectedCategoryId,
}) => {
  const topCategories = categories.filter((c) => !c.parentId);

  const [totalLimit, setTotalLimit] = useState<number>(100000);
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({});
  const [rollover, setRollover] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (budget) {
      setTotalLimit(budget.totalLimit);
      setCategoryLimits({ ...budget.categoryLimits });
      setRollover(budget.rollover ?? true);
    } else {
      // Default limits
      setTotalLimit(120000);
      const defaults: Record<string, number> = {};
      topCategories.forEach((c) => {
        defaults[c.id] = c.type === 'need' ? 20000 : c.type === 'want' ? 10000 : 15000;
      });
      setCategoryLimits(defaults);
      setRollover(true);
    }
  }, [budget, month, categories]);

  if (!isOpen) return null;

  const handleCategoryLimitChange = (catId: string, val: number) => {
    setCategoryLimits((prev) => ({
      ...prev,
      [catId]: Math.max(0, val || 0),
    }));
  };

  const sumOfCategories = Object.values(categoryLimits).reduce((a, b) => a + b, 0);

  const handleAutoSumTotal = () => {
    setTotalLimit(sumOfCategories);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const updatedBudget: Budget = {
        id: budget?.id || `budget_${month}`,
        month,
        totalLimit: Math.max(0, totalLimit || sumOfCategories),
        categoryLimits,
        rollover,
        createdAt: budget?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await onSave(updatedBudget);
      onClose();
    } catch (err) {
      console.error('Failed to save budget:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-dark-surface rounded-3xl border border-cream-200 dark:border-dark-border w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 border-b border-cream-100 dark:border-dark-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-deep-blue-900 dark:text-cream-100">
              Manage Monthly Budget ({month})
            </h2>
            <p className="text-xs text-deep-blue-600 dark:text-cream-300">
              Set spending limits and rollover preferences for this month
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-deep-blue-600 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
            {/* Total Budget & Rollover Toggle */}
            <div className="p-4 rounded-2xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-deep-blue-800 dark:text-cream-200">
                    Total Monthly Budget Limit
                  </label>
                  <p className="text-[11px] text-deep-blue-600 dark:text-cream-300">
                    Overall cap across all spending categories
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-deep-blue-600 dark:text-cream-300">
                      ₹
                    </span>
                    <input
                      type="number"
                      step={1000}
                      min={0}
                      required
                      value={totalLimit}
                      onChange={(e) => setTotalLimit(parseFloat(e.target.value) || 0)}
                      className="w-36 pl-7 pr-3 py-2 rounded-xl border border-cream-300 dark:border-dark-border bg-white dark:bg-dark-surface font-bold text-deep-blue-900 dark:text-cream-100 tabular-nums text-sm text-right focus:ring-2 focus:ring-deep-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoSumTotal}
                    title="Sum of categories"
                    className="p-2 rounded-xl bg-deep-blue-50 dark:bg-dark-surface border border-deep-blue-100 dark:border-dark-border text-deep-blue-600 dark:text-cream-200 hover:bg-deep-blue-100 transition-colors"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Rollover Toggle */}
              <div className="pt-3 border-t border-cream-200 dark:border-dark-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-deep-blue-900 dark:text-cream-100">
                    Unspent Rollover
                  </span>
                  <p className="text-[11px] text-deep-blue-600 dark:text-cream-300">
                    Automatically carry forward unused budget surplus from previous month
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rollover}
                    onChange={(e) => setRollover(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-cream-300 peer-focus:outline-none rounded-full peer dark:bg-dark-border peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-deep-blue-500" />
                </label>
              </div>
            </div>

            {/* Category Limits */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-deep-blue-800 dark:text-cream-200">
                  Per-Category Limits
                </h3>
                <span className="text-xs text-deep-blue-600 dark:text-cream-300">
                  Category sum: <strong className="tabular-nums font-semibold text-deep-blue-900 dark:text-cream-100">{formatCurrency(sumOfCategories, { hideDecimals: true })}</strong>
                </span>
              </div>

              <div className="space-y-2.5">
                {topCategories.map((cat) => {
                  const isHighlighted = preselectedCategoryId === cat.id;
                  return (
                    <div
                      key={cat.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                        isHighlighted
                          ? 'border-deep-blue-500 bg-deep-blue-50/50 dark:bg-dark-elevated ring-2 ring-deep-blue-400'
                          : 'border-cream-200 dark:border-dark-border bg-white dark:bg-dark-surface'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-semibold text-xs text-deep-blue-900 dark:text-cream-100 truncate">
                          {cat.name}
                        </span>
                        <CategoryTypeBadge type={cat.type} />
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs font-semibold text-deep-blue-600 dark:text-cream-300">
                          ₹
                        </span>
                        <input
                          type="number"
                          step={500}
                          min={0}
                          value={categoryLimits[cat.id] ?? 0}
                          onChange={(e) =>
                            handleCategoryLimitChange(cat.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-28 px-3 py-1.5 rounded-xl border border-cream-300 dark:border-dark-border bg-white dark:bg-dark-surface font-semibold text-deep-blue-900 dark:text-cream-100 tabular-nums text-xs text-right focus:ring-2 focus:ring-deep-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-cream-100 dark:border-dark-border flex items-center justify-end gap-3 bg-cream-50/50 dark:bg-dark-elevated/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-semibold text-xs text-deep-blue-700 dark:text-cream-200 hover:bg-cream-100 dark:hover:bg-dark-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-deep-blue-500 hover:bg-deep-blue-600 text-white shadow-md flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
