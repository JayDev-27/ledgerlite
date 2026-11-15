import React from 'react';
import {
  TrendingUp,
  Wallet,
  AlertTriangle,
  CheckCircle,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import { BudgetPaceMetrics } from '@/lib/budget';
import { formatCurrency } from '@/lib/formatters';

interface BudgetKpisProps {
  metrics: BudgetPaceMetrics;
}

export const BudgetKpis: React.FC<BudgetKpisProps> = ({ metrics }) => {
  const {
    baseLimit,
    rolloverAmount,
    effectiveLimit,
    spent,
    remaining,
    percentUsed,
    safeToSpendPerDay,
    projectedMonthEndSpend,
    projectedVariance,
    status,
    daysLeft,
    totalDays,
  } = metrics;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Budget & Rollover */}
      <div className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-cream-200 dark:border-dark-border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-deep-blue-500 dark:text-cream-200">
            Total Budget
          </span>
          <div className="p-2 rounded-xl bg-deep-blue-50 dark:bg-dark-elevated text-deep-blue-500 dark:text-cream-100">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">
          {formatCurrency(effectiveLimit, { hideDecimals: true })}
        </div>
        <div className="mt-2 text-xs text-deep-blue-600 dark:text-cream-300">
          {rolloverAmount > 0 ? (
            <span>
              Base: {formatCurrency(baseLimit, { hideDecimals: true })} +{' '}
              <span className="font-semibold text-status-success">
                {formatCurrency(rolloverAmount, { hideDecimals: true })} rollover
              </span>
            </span>
          ) : (
            <span>Base monthly allocation</span>
          )}
        </div>
      </div>

      {/* 2. Total Spent & Pace */}
      <div className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-cream-200 dark:border-dark-border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-deep-blue-500 dark:text-cream-200">
            Total Spent
          </span>
          <div className="p-2 rounded-xl bg-deep-blue-50 dark:bg-dark-elevated text-deep-blue-500 dark:text-cream-100">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">
          {formatCurrency(spent, { hideDecimals: true })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-cream-100 dark:bg-dark-elevated h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                status === 'over'
                  ? 'bg-status-danger'
                  : status === 'at-risk'
                  ? 'bg-status-warning'
                  : 'bg-status-success'
              }`}
              style={{ width: `${Math.min(100, percentUsed)}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-deep-blue-900 dark:text-cream-200">
            {percentUsed.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* 3. Remaining & Safe Spend / Day */}
      <div className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-cream-200 dark:border-dark-border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-deep-blue-500 dark:text-cream-200">
            Remaining Budget
          </span>
          <div className="p-2 rounded-xl bg-deep-blue-50 dark:bg-dark-elevated text-deep-blue-500 dark:text-cream-100">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div
          className={`text-2xl font-bold tabular-nums ${
            remaining < 0
              ? 'text-status-danger'
              : 'text-deep-blue-900 dark:text-cream-100'
          }`}
        >
          {formatCurrency(remaining, { hideDecimals: true })}
        </div>
        <div className="mt-2 text-xs text-deep-blue-700 dark:text-cream-300">
          {daysLeft > 0 ? (
            <span>
              Safe to spend:{' '}
              <strong className="font-semibold text-deep-blue-900 dark:text-cream-100 tabular-nums">
                {formatCurrency(safeToSpendPerDay, { hideDecimals: true })}/day
              </strong>{' '}
              ({daysLeft}d left)
            </span>
          ) : (
            <span>Month ended ({totalDays} days elapsed)</span>
          )}
        </div>
      </div>

      {/* 4. Projected Month-End & Status */}
      <div className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-cream-200 dark:border-dark-border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-deep-blue-500 dark:text-cream-200">
            Projected Month-End
          </span>
          <div
            className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
              status === 'over'
                ? 'bg-status-danger-bg text-status-danger'
                : status === 'at-risk'
                ? 'bg-status-warning-bg text-status-warning'
                : 'bg-status-success-bg text-status-success'
            }`}
          >
            {status === 'over' ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : status === 'at-risk' ? (
              <Flame className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            <span className="capitalize">
              {status === 'over' ? 'Over Budget' : status === 'at-risk' ? 'At Risk' : 'On Track'}
            </span>
          </div>
        </div>
        <div className="text-2xl font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">
          {formatCurrency(projectedMonthEndSpend, { hideDecimals: true })}
        </div>
        <div className="mt-2 text-xs text-deep-blue-700 dark:text-cream-300">
          {projectedVariance > 0 ? (
            <span className="text-status-danger font-medium">
              Over budget by {formatCurrency(projectedVariance, { hideDecimals: true })}
            </span>
          ) : (
            <span className="text-status-success font-medium">
              Under budget by {formatCurrency(Math.abs(projectedVariance), { hideDecimals: true })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
