import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  CreditCard,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  Plus,
  ArrowRight,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { format, parseISO, getDaysInMonth, getDate, isSameMonth } from 'date-fns';
import { repository } from '@/data/repository';
import { Transaction, Budget, Category } from '@/types';
import { formatCurrency, formatRelativeDate } from '@/lib/formatters';
import { CategoryTypeBadge } from '@/components/common/Badge';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { useUiStore } from '@/store/uiStore';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { openQuickAdd } = useUiStore();
  const [loading, setLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentBudget, setCurrentBudget] = useState<Budget | undefined>();
  const [activeMonth, setActiveMonth] = useState('2026-11');
  const [stats, setStats] = useState({
    totalSpentThisMonth: 0,
    needSpent: 0,
    wantSpent: 0,
    savingsSpent: 0,
    transactionCount: 0,
  });

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [cats, txResult, budgets] = await Promise.all([
        repository.getCategories(),
        repository.getTransactions(undefined, { page: 1, pageSize: 6, sortBy: 'date', sortDirection: 'desc' }),
        repository.getBudgets(),
      ]);

      const latestBudgetMonth = budgets[0]?.month || '2026-11';
      const currentRealMonth = format(new Date(), 'yyyy-MM');
      const selectedMonth = budgets.some((b) => b.month === currentRealMonth)
        ? currentRealMonth
        : latestBudgetMonth;

      setActiveMonth(selectedMonth);

      const lastDayStr = String(getDaysInMonth(parseISO(`${selectedMonth}-01`))).padStart(2, '0');
      const [budget, allTxs] = await Promise.all([
        repository.getBudgetForMonth(selectedMonth),
        repository.getTransactionsByDateRange(
          `${selectedMonth}-01`,
          `${selectedMonth}-${lastDayStr}T23:59:59`
        ),
      ]);

      const catMap = new Map(cats.map((c) => [c.id, c]));

      let monthTotal = 0;
      let need = 0;
      let want = 0;
      let savings = 0;

      for (const tx of allTxs) {
        monthTotal += tx.amount;
        const cat = catMap.get(tx.categoryId);
        if (cat) {
          if (cat.type === 'need') need += tx.amount;
          else if (cat.type === 'want') want += tx.amount;
          else if (cat.type === 'savings') savings += tx.amount;
        }
      }

      setCategories(cats);
      setRecentTransactions(txResult.data);
      setCurrentBudget(budget);
      setStats({
        totalSpentThisMonth: monthTotal,
        needSpent: need,
        wantSpent: want,
        savingsSpent: savings,
        transactionCount: allTxs.length,
      });
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    const handleUpdate = () => loadDashboardData();
    window.addEventListener('transactions-updated', handleUpdate);
    return () => window.removeEventListener('transactions-updated', handleUpdate);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="kpi" count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SkeletonLoader variant="table-row" count={5} />
          </div>
          <div>
            <SkeletonLoader variant="card" />
          </div>
        </div>
      </div>
    );
  }

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const budgetLimit = currentBudget?.totalLimit || 150000;
  const budgetRemaining = Math.max(0, budgetLimit - stats.totalSpentThisMonth);
  const budgetPercent = Math.min(100, Math.round((stats.totalSpentThisMonth / budgetLimit) * 100));

  const monthDate = parseISO(`${activeMonth}-01`);
  const totalDaysInMonth = getDaysInMonth(monthDate);
  const now = new Date();
  const isCurrent = isSameMonth(monthDate, now);
  const isPast = monthDate < now && !isCurrent;
  const currentDay = isCurrent ? getDate(now) : isPast ? totalDaysInMonth : 0;
  const daysLeft = Math.max(1, totalDaysInMonth - currentDay);
  const safeSpendPerDay = Math.round(budgetRemaining / daysLeft);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-card bg-gradient-to-r from-deep-blue-500 via-deep-blue-600 to-deep-blue-700 text-cream-100 shadow-card">
        <div>
          <div className="flex items-center gap-2 text-cream-200 text-xs font-semibold uppercase tracking-wider mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(parseISO(`${activeMonth}-01`), 'MMMM yyyy')} • Private Ledger</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Wealth & Expense Overview
          </h2>
          <p className="text-xs sm:text-sm text-cream-200/90 mt-1 max-w-xl">
            Track daily burn rate, 50/30/20 allocation, and local-first private transactions.
          </p>
        </div>

        <button
          onClick={openQuickAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cream-100 text-deep-blue-900 font-semibold text-sm hover:bg-white active:scale-95 transition-all shadow-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4 text-deep-blue-700" />
          Quick Add (N)
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Spent This Month */}
        <div className="p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
          <div className="flex items-center justify-between text-deep-blue-700 dark:text-cream-300 text-xs font-medium mb-2">
            <span>Spent This Month</span>
            <span className="p-1.5 rounded-lg bg-deep-blue-50 dark:bg-dark-elevated text-deep-blue-600 dark:text-cream-300">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-deep-blue-950 dark:text-cream-100 tracking-tight">
            {formatCurrency(stats.totalSpentThisMonth)}
          </div>
          <div className="text-xs text-deep-blue-600/70 dark:text-cream-400 mt-2 flex items-center gap-1">
            <span>{stats.transactionCount} transactions recorded</span>
          </div>
        </div>

        {/* Budget Remaining */}
        <div className="p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
          <div className="flex items-center justify-between text-deep-blue-700 dark:text-cream-300 text-xs font-medium mb-2">
            <span>Budget Remaining</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-dark-elevated text-emerald-600 dark:text-emerald-400">
              <PiggyBank className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-deep-blue-950 dark:text-cream-100 tracking-tight">
            {formatCurrency(budgetRemaining)}
          </div>
          <div className="text-xs text-deep-blue-600/70 dark:text-cream-400 mt-2 flex items-center justify-between">
            <span>{budgetPercent}% of {formatCurrency(budgetLimit, { hideDecimals: true })} limit</span>
          </div>
        </div>

        {/* Safe-to-Spend Per Day */}
        <div className="p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
          <div className="flex items-center justify-between text-deep-blue-700 dark:text-cream-300 text-xs font-medium mb-2">
            <span>Safe-to-Spend / Day</span>
            <span className="p-1.5 rounded-lg bg-sky-50 dark:bg-dark-elevated text-deep-blue-600 dark:text-cream-300">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-deep-blue-950 dark:text-cream-100 tracking-tight">
            {formatCurrency(safeSpendPerDay)}
          </div>
          <div className="text-xs text-deep-blue-600/70 dark:text-cream-400 mt-2">
            <span>Based on {daysLeft} remaining days</span>
          </div>
        </div>

        {/* Savings & Investments */}
        <div className="p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
          <div className="flex items-center justify-between text-deep-blue-700 dark:text-cream-300 text-xs font-medium mb-2">
            <span>Invested & Saved</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-dark-elevated text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 tracking-tight">
            {formatCurrency(stats.savingsSpent)}
          </div>
          <div className="text-xs text-deep-blue-600/70 dark:text-cream-400 mt-2">
            <span>SIPs & wealth allocation</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Transactions & 50/30/20 Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions List */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-deep-blue-950 dark:text-cream-100 text-base">
                Recent Transactions
              </h3>
              <p className="text-xs text-deep-blue-700/70 dark:text-cream-400">
                Latest logged expenses from your private ledger
              </p>
            </div>
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1 text-xs font-semibold text-deep-blue-500 hover:text-deep-blue-700 dark:text-cream-200 transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No transactions logged yet"
              description="Press 'N' anywhere or tap Quick Add to log your first expense."
              actionLabel="Log Expense"
              onAction={openQuickAdd}
            />
          ) : (
            <div className="divide-y divide-cream-100 dark:divide-dark-border">
              {recentTransactions.map((tx) => {
                const cat = catMap.get(tx.categoryId);
                return (
                  <div
                    key={tx.id}
                    className="py-3.5 flex items-center justify-between gap-3 hover:bg-cream-50/50 dark:hover:bg-dark-elevated/40 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"
                        style={{ backgroundColor: cat?.color || '#16587B' }}
                      >
                        {tx.merchant.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-deep-blue-900 dark:text-cream-100 truncate">
                          {tx.merchant}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-deep-blue-600/70 dark:text-cream-400">
                          <span>{formatRelativeDate(tx.date)}</span>
                          <span>•</span>
                          <span className="uppercase text-[10px] font-mono">{tx.paymentMethod}</span>
                          {cat && (
                            <>
                              <span>•</span>
                              <span className="truncate">{cat.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm tabular-nums text-deep-blue-950 dark:text-cream-100">
                        {formatCurrency(tx.amount)}
                      </div>
                      {cat && <CategoryTypeBadge type={cat.type} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 50/30/20 Allocation Card */}
        <div className="space-y-6">
          <div className="p-5 sm:p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-5">
            <div>
              <h3 className="font-semibold text-deep-blue-950 dark:text-cream-100 text-base">
                50/30/20 Rule Breakdown
              </h3>
              <p className="text-xs text-deep-blue-700/70 dark:text-cream-400">
                Recommended financial planning balance
              </p>
            </div>

            {/* Needs */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-deep-blue-800 dark:text-cream-200">
                  Needs (Housing, Food, Bills)
                </span>
                <span className="tabular-nums font-bold text-deep-blue-950 dark:text-cream-100">
                  {formatCurrency(stats.needSpent)}
                </span>
              </div>
              <div className="w-full bg-cream-200 dark:bg-dark-elevated rounded-full h-2 overflow-hidden">
                <div
                  className="bg-deep-blue-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((stats.needSpent / (stats.totalSpentThisMonth || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Wants */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-amber-800 dark:text-amber-300">
                  Wants (Dining, Shopping, Entertainment)
                </span>
                <span className="tabular-nums font-bold text-deep-blue-950 dark:text-cream-100">
                  {formatCurrency(stats.wantSpent)}
                </span>
              </div>
              <div className="w-full bg-cream-200 dark:bg-dark-elevated rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((stats.wantSpent / (stats.totalSpentThisMonth || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Savings */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-emerald-800 dark:text-emerald-300">
                  Savings & Investments (20% Target)
                </span>
                <span className="tabular-nums font-bold text-deep-blue-950 dark:text-cream-100">
                  {formatCurrency(stats.savingsSpent)}
                </span>
              </div>
              <div className="w-full bg-cream-200 dark:bg-dark-elevated rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((stats.savingsSpent / (stats.totalSpentThisMonth || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Quick AI Prompt Card */}
          <div className="p-5 rounded-card bg-cream-50 dark:bg-dark-elevated border border-sky-300/60 dark:border-dark-border space-y-3">
            <div className="flex items-center gap-2 text-deep-blue-800 dark:text-cream-300 font-semibold text-xs uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
              <span>Gemini Wealth Insight</span>
            </div>
            <p className="text-xs text-deep-blue-700/80 dark:text-cream-300 leading-relaxed">
              &ldquo;Your grocery spend is pacing 12% lower than last month, while investments are consistently on track.&rdquo;
            </p>
            <Link
              to="/assistant"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-deep-blue-600 dark:text-cream-200 hover:underline pt-1"
            >
              <span>Ask Assistant a Question</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
