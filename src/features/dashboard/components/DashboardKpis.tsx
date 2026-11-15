import React from 'react';
import {
  TrendingUp,
  CreditCard,
  PieChart,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { MetricComparison, formatPercentDelta } from '@/lib/periods';

interface DashboardKpiData {
  totalSpendComparison: MetricComparison;
  dailyAvgComparison: MetricComparison;
  topCategory?: {
    name: string;
    amount: number;
    percentOfTotal: number;
    color: string;
  };
  isMonthlyView?: boolean;
  budgetStatus?: {
    percentUsed: number;
    status: 'on-track' | 'at-risk' | 'over';
    remaining: number;
  };
  split503020: {
    needPercent: number;
    wantPercent: number;
    savingsPercent: number;
  };
}

interface DashboardKpisProps {
  data: DashboardKpiData;
  compareWithPrior: boolean;
  priorPeriodLabel?: string;
}

export const DashboardKpis: React.FC<DashboardKpisProps> = ({
  data,
  compareWithPrior,
  priorPeriodLabel,
}) => {
  const {
    totalSpendComparison,
    dailyAvgComparison,
    topCategory,
    budgetStatus,
    split503020,
  } = data;

  const renderDeltaBadge = (comp: MetricComparison) => {
    if (!compareWithPrior) return null;

    // For spending, going down is favorable (green), going up is more spend (red/amber)
    const isFavorable = comp.delta <= 0;
    const badgeBg = isFavorable
      ? 'bg-status-success-bg text-status-success'
      : 'bg-status-danger-bg text-status-danger';

    return (
      <div
        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${badgeBg}`}
        title={`Prior: ${formatCurrency(comp.previous, { hideDecimals: true })}`}
      >
        {comp.trend === 'down' ? (
          <ArrowDownRight className="w-3 h-3" />
        ) : comp.trend === 'up' ? (
          <ArrowUpRight className="w-3 h-3" />
        ) : (
          <Minus className="w-3 h-3" />
        )}
        <span>{formatPercentDelta(comp.percentChange)}</span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Total Spend */}
      <div className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-cream-200 dark:border-dark-border shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-deep-blue-500 dark:text-cream-200">
              Total Spend
            </span>
            <div className="p-2 rounded-xl bg-deep-blue-50 dark:bg-dark-elevated text-deep-blue-500 dark:text-cream-100">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
            {formatCurrency(totalSpendComparison.current, { hideDecimals: true })}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-deep-blue-700 dark:text-cream-300">
          {compareWithPrior ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {renderDeltaBadge(totalSpendComparison)}
              <span className="text-[11px] text-deep-blue-600 dark:text-cream-300 truncate max-w-[120px]">
                vs {priorPeriodLabel || 'prior'}
              </span>
            </div>
          ) : (
            <span>In selected period</span>
          )}
        </div>
      </div>

      {/* 2. Daily Average Spend */}
      <div className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-cream-200 dark:border-dark-border shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-deep-blue-500 dark:text-cream-200">
              Daily Average
            </span>
            <div className="p-2 rounded-xl bg-deep-blue-50 dark:bg-dark-elevated text-deep-blue-500 dark:text-cream-100">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
            {formatCurrency(dailyAvgComparison.current, { hideDecimals: true })}
            <span className="text-xs font-medium text-deep-blue-600 dark:text-cream-300 ml-0.5">
              /day
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-deep-blue-700 dark:text-cream-300">
          {compareWithPrior ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {renderDeltaBadge(dailyAvgComparison)}
              <span className="text-[11px] text-deep-blue-600 dark:text-cream-300 truncate max-w-[120px]">
                vs {priorPeriodLabel || 'prior'}
              </span>
            </div>
          ) : (
            <span>Daily burn rate</span>
          )}
        </div>
      </div>

      {/* 3. Top Spending Category */}
      <div className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-cream-200 dark:border-dark-border shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-deep-blue-500 dark:text-cream-200">
              Top Category
            </span>
            <div className="p-2 rounded-xl bg-deep-blue-50 dark:bg-dark-elevated text-deep-blue-500 dark:text-cream-100">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-semibold text-deep-blue-900 dark:text-cream-100 truncate">
            {topCategory?.name || 'No spend'}
          </div>
          <div className="text-sm font-semibold tabular-nums text-deep-blue-700 dark:text-cream-200 mt-0.5">
            {topCategory ? formatCurrency(topCategory.amount, { hideDecimals: true }) : '₹0'}
          </div>
        </div>
        <div className="mt-2 text-xs text-deep-blue-600 dark:text-cream-300 flex items-center gap-1.5">
          {topCategory && (
            <>
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: topCategory.color }}
              />
              <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                {topCategory.percentOfTotal.toFixed(1)}%
              </span>{' '}
              of period spend
            </>
          )}
        </div>
      </div>

      {/* 4. Budget Status */}
      <div className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-cream-200 dark:border-dark-border shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-deep-blue-500 dark:text-cream-200">
              Budget Status
            </span>
            <div className="p-2 rounded-xl bg-deep-blue-50 dark:bg-dark-elevated text-deep-blue-500 dark:text-cream-100">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
            {data.isMonthlyView === false
              ? 'N/A'
              : budgetStatus
              ? `${budgetStatus.percentUsed.toFixed(0)}%`
              : 'Not Set'}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
              data.isMonthlyView === false || !budgetStatus
                ? 'bg-cream-200 dark:bg-dark-elevated text-deep-blue-700 dark:text-cream-300'
                : budgetStatus.status === 'over'
                ? 'bg-status-danger-bg text-status-danger'
                : budgetStatus.status === 'at-risk'
                ? 'bg-status-warning-bg text-status-warning'
                : 'bg-status-success-bg text-status-success'
            }`}
          >
            {data.isMonthlyView === false
              ? 'Monthly Only'
              : !budgetStatus
              ? 'No Budget'
              : budgetStatus.status === 'over'
              ? 'Over Budget'
              : budgetStatus.status === 'at-risk'
              ? 'At Risk'
              : 'On Track'}
          </span>
          <span className="text-[11px] text-deep-blue-600 dark:text-cream-300 tabular-nums">
            {data.isMonthlyView === false
              ? 'Select month view'
              : !budgetStatus
              ? 'Configure in Budgets'
              : budgetStatus.remaining >= 0
              ? `${formatCurrency(budgetStatus.remaining, { compact: true, hideDecimals: true })} left`
              : `Over by ${formatCurrency(Math.abs(budgetStatus.remaining), { compact: true, hideDecimals: true })}`}
          </span>
        </div>
      </div>

      {/* 5. 50/30/20 Need/Want/Savings Summary */}
      <div className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-cream-200 dark:border-dark-border shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-deep-blue-500 dark:text-cream-200">
              50/30/20 Rule
            </span>
            <span className="text-[10px] font-semibold text-deep-blue-600 dark:text-cream-300">
              Target
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tabular-nums">
            <span className="text-deep-blue-900 dark:text-cream-100">
              {split503020.needPercent}%N
            </span>
            <span className="text-deep-blue-400 dark:text-cream-400">•</span>
            <span className="text-deep-blue-900 dark:text-cream-100">
              {split503020.wantPercent}%W
            </span>
            <span className="text-deep-blue-400 dark:text-cream-400">•</span>
            <span className="text-deep-blue-900 dark:text-cream-100">
              {split503020.savingsPercent}%S
            </span>
          </div>
        </div>

        {/* Visual micro progress bar */}
        <div className="mt-3">
          <div className="w-full h-2 rounded-full flex overflow-hidden bg-cream-200 dark:bg-dark-elevated">
            <div
              className="bg-deep-blue-500 h-full dark:bg-white dark:text-black dark:hover:bg-cream-200"
              style={{ width: `${split503020.needPercent}%` }}
              title={`Needs: ${split503020.needPercent}% (target 50%)`}
            />
            <div
              className="bg-sky-400 h-full"
              style={{ width: `${split503020.wantPercent}%` }}
              title={`Wants: ${split503020.wantPercent}% (target 30%)`}
            />
            <div
              className="bg-status-success h-full"
              style={{ width: `${split503020.savingsPercent}%` }}
              title={`Savings: ${split503020.savingsPercent}% (target 20%)`}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-deep-blue-600 dark:text-cream-300 font-medium">
            <span>Needs 50%</span>
            <span>Wants 30%</span>
            <span>Save 20%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
