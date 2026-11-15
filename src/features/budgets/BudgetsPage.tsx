import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Sparkles,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { format, parseISO, getDaysInMonth, getDate, isSameMonth } from 'date-fns';
import { repository } from '@/data/repository';
import { Budget, Category } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';

export const BudgetsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-11');
  const [budget, setBudget] = useState<Budget | undefined>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySpend, setCategorySpend] = useState<Record<string, number>>({});
  const [totalSpent, setTotalSpent] = useState(0);

  // Dynamic calendar calculations
  const monthDate = parseISO(`${selectedMonth}-01`);
  const totalDaysInMonth = getDaysInMonth(monthDate);
  const now = new Date();
  const isCurrent = isSameMonth(monthDate, now);
  const isPast = monthDate < now && !isCurrent;
  // If current month, use today's day; if past month, all days elapsed; if future, 0 elapsed
  const currentDay = isCurrent ? getDate(now) : isPast ? totalDaysInMonth : 0;
  const daysLeft = Math.max(0, totalDaysInMonth - currentDay);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [allBudgets, cats] = await Promise.all([
          repository.getBudgets(),
          repository.getCategories(),
        ]);

        const months = allBudgets.map((b) => b.month);
        setAvailableMonths(months);

        const currentActiveMonth = months.includes(selectedMonth)
          ? selectedMonth
          : months[0] || '2026-11';

        const lastDayStr = String(getDaysInMonth(parseISO(`${currentActiveMonth}-01`))).padStart(2, '0');
        const [b, txs] = await Promise.all([
          repository.getBudgetForMonth(currentActiveMonth),
          repository.getTransactionsByDateRange(
            `${currentActiveMonth}-01`,
            `${currentActiveMonth}-${lastDayStr}T23:59:59`
          ),
        ]);

        const spend: Record<string, number> = {};
        let total = 0;

        for (const tx of txs) {
          total += tx.amount;
          spend[tx.categoryId] = (spend[tx.categoryId] || 0) + tx.amount;
        }

        setBudget(b);
        setCategories(cats.filter((c) => !c.parentId));
        setCategorySpend(spend);
        setTotalSpent(total);
      } catch (e) {
        console.error('Failed to load budget data:', e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedMonth]);

  if (loading) {
    return <SkeletonLoader variant="kpi" count={4} />;
  }

  const totalLimit = budget?.totalLimit || 150000;
  const remaining = Math.max(0, totalLimit - totalSpent);
  const percentUsed = Math.min(100, Math.round((totalSpent / totalLimit) * 100));
  const burnRatePerDay = currentDay > 0 ? totalSpent / currentDay : 0;
  const safeSpendPerDay = daysLeft > 0 ? remaining / daysLeft : 0;
  const projectedMonthEnd = burnRatePerDay * totalDaysInMonth;
  const isOnTrack = projectedMonthEnd <= totalLimit;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Month Header & Overview Card */}
      <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-deep-blue-600 dark:text-cream-300">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')} Monthly Budget</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-deep-blue-950 dark:text-cream-100 mt-1">
              Budget Performance & Burn Rate
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {availableMonths.length > 1 && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {format(parseISO(`${m}-01`), 'MMM yyyy')}
                  </option>
                ))}
              </select>
            )}

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isOnTrack
                  ? 'bg-status-success-bg text-status-success dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-status-danger-bg text-status-danger dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {isOnTrack ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  On Track
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Pacing Above Budget
                </>
              )}
            </span>
          </div>
        </div>

        {/* Big Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline text-sm">
            <div className="font-bold text-deep-blue-950 dark:text-cream-100 tabular-nums text-lg">
              {formatCurrency(totalSpent)} <span className="text-xs font-normal text-deep-blue-600 dark:text-cream-400">spent</span>
            </div>
            <div className="text-xs text-deep-blue-700/80 dark:text-cream-300">
              Limit: <span className="font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">{formatCurrency(totalLimit, { hideDecimals: true })}</span> ({percentUsed}%)
            </div>
          </div>

          <div className="w-full bg-cream-200 dark:bg-dark-elevated rounded-full h-3.5 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentUsed > 90
                  ? 'bg-status-danger'
                  : percentUsed > 75
                  ? 'bg-status-warning'
                  : 'bg-deep-blue-500'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>

        {/* 4 Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-cream-100 dark:border-dark-border">
          <div>
            <div className="text-xs text-deep-blue-600/70 dark:text-cream-400">Remaining</div>
            <div className="text-lg font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">
              {formatCurrency(remaining)}
            </div>
            <div className="text-[11px] text-deep-blue-600/60 dark:text-cream-400">{daysLeft} days left</div>
          </div>

          <div>
            <div className="text-xs text-deep-blue-600/70 dark:text-cream-400">Safe-to-Spend / Day</div>
            <div className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatCurrency(Math.round(safeSpendPerDay))}
            </div>
            <div className="text-[11px] text-deep-blue-600/60 dark:text-cream-400">Ideal daily budget</div>
          </div>

          <div>
            <div className="text-xs text-deep-blue-600/70 dark:text-cream-400">Current Burn Rate</div>
            <div className="text-lg font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">
              {formatCurrency(Math.round(burnRatePerDay))} / day
            </div>
            <div className="text-[11px] text-deep-blue-600/60 dark:text-cream-400">Day 1 to 15 average</div>
          </div>

          <div>
            <div className="text-xs text-deep-blue-600/70 dark:text-cream-400">Projected Month-End</div>
            <div
              className={`text-lg font-bold tabular-nums ${
                isOnTrack ? 'text-deep-blue-950 dark:text-cream-100' : 'text-status-danger'
              }`}
            >
              {formatCurrency(Math.round(projectedMonthEnd))}
            </div>
            <div className="text-[11px] text-deep-blue-600/60 dark:text-cream-400">
              {isOnTrack ? 'Within total limit' : 'Projected overrun'}
            </div>
          </div>
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-deep-blue-950 dark:text-cream-100 text-base">
              Category Limits & Actual Spend
            </h3>
            <p className="text-xs text-deep-blue-700/70 dark:text-cream-400">
              Tracking allocations against monthly limits
            </p>
          </div>

          <button
            onClick={() => alert('AI Budget Suggestions will run with Gemini in Phase 5.')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-100 dark:bg-dark-elevated text-deep-blue-700 dark:text-cream-300 text-xs font-semibold hover:bg-sky-200 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
            <span>Suggest Budget (AI)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {categories.map((cat) => {
            const spent = categorySpend[cat.id] || 0;
            const limit = budget?.categoryLimits[cat.id] || 15000;
            const catPercent = Math.min(100, Math.round((spent / limit) * 100));
            const isOver = spent > limit;

            return (
              <div
                key={cat.id}
                className="p-4 rounded-xl bg-cream-50/60 dark:bg-dark-elevated/60 border border-cream-200 dark:border-dark-border space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-semibold text-sm text-deep-blue-900 dark:text-cream-100">
                      {cat.name}
                    </span>
                  </div>

                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      isOver ? 'text-status-danger' : 'text-deep-blue-700 dark:text-cream-300'
                    }`}
                  >
                    {formatCurrency(spent)} / {formatCurrency(limit, { hideDecimals: true })}
                  </span>
                </div>

                <div className="w-full bg-cream-200 dark:bg-dark-border rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${
                      isOver
                        ? 'bg-status-danger'
                        : catPercent > 80
                        ? 'bg-status-warning'
                        : 'bg-deep-blue-500'
                    }`}
                    style={{ width: `${catPercent}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-deep-blue-600/70 dark:text-cream-400">
                  <span>{cat.type.toUpperCase()}</span>
                  <span>{catPercent}% utilized</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
