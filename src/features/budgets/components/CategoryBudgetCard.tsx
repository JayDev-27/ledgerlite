import React from 'react';
import { Edit2, AlertTriangle } from 'lucide-react';
import { CategoryBudgetMetrics } from '@/lib/budget';
import { formatCurrency } from '@/lib/formatters';
import { CategoryTypeBadge } from '@/components/common/Badge';

interface CategoryBudgetCardProps {
  category: CategoryBudgetMetrics;
  onEdit: (categoryId: string) => void;
}

export const CategoryBudgetCard: React.FC<CategoryBudgetCardProps> = ({
  category,
  onEdit,
}) => {
  const {
    categoryId,
    categoryName,
    type,
    color,
    rolloverAmount,
    effectiveLimit,
    spent,
    remaining,
    percentUsed,
    status,
  } = category;

  const statusBg =
    status === 'over'
      ? 'bg-status-danger'
      : status === 'at-risk'
      ? 'bg-status-warning'
      : 'bg-status-success';

  return (
    <div className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-cream-200 dark:border-dark-border shadow-sm flex flex-col justify-between hover:border-sky-300 dark:hover:border-sky-500 transition-colors">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: color || '#847DFF' }}
            />
            <div>
              <h3 className="font-semibold text-sm text-deep-blue-900 dark:text-cream-100 line-clamp-1">
                {categoryName}
              </h3>
              <div className="mt-0.5">
                <CategoryTypeBadge type={type} />
              </div>
            </div>
          </div>

          <button
            onClick={() => onEdit(categoryId)}
            className="p-1.5 rounded-lg text-deep-blue-600 dark:text-cream-200 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
            title="Edit category budget"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Limit and Spend figures */}
        <div className="flex items-baseline justify-between mt-3 mb-1.5">
          <span className="text-xs text-deep-blue-700 dark:text-cream-300">
            Spent:{' '}
            <strong className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
              {formatCurrency(spent, { hideDecimals: true })}
            </strong>
          </span>
          <span className="text-xs text-deep-blue-700 dark:text-cream-300">
            Limit:{' '}
            <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
              {formatCurrency(effectiveLimit, { hideDecimals: true })}
            </span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-cream-100 dark:bg-dark-elevated h-2.5 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all ${statusBg}`}
            style={{ width: `${Math.min(100, percentUsed)}%` }}
          />
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-cream-100 dark:border-dark-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          {status === 'over' ? (
            <span className="flex items-center gap-1 text-status-danger font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              Over by {formatCurrency(Math.abs(remaining), { hideDecimals: true })}
            </span>
          ) : (
            <span className="text-deep-blue-700 dark:text-cream-300">
              Remaining:{' '}
              <span className="font-semibold text-deep-blue-900 dark:text-cream-100 tabular-nums">
                {formatCurrency(remaining, { hideDecimals: true })}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {rolloverAmount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-status-success-bg text-status-success">
              +{formatCurrency(rolloverAmount, { compact: true, hideDecimals: true })} roll
            </span>
          )}
          <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
            {percentUsed.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};
