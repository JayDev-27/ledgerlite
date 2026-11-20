import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ArrowRight,
  BarChart3,
  Calendar,
} from 'lucide-react';
import {
  format,
  differenceInCalendarDays,
  getDay,
} from 'date-fns';
import { parseReferenceDate, todayInIndia } from '@/lib/periods/financialYear';
import { repository } from '@/data/repository';
import { Transaction, Category, Budget, PaymentMethod } from '@/types';
import {
  PeriodType,
  PeriodRange,
  getPeriodRange,
  getPreviousPeriod,
  getNextPeriod,
  calculateComparison,
} from '@/lib/periods';
import { calculateBudgetMetrics } from '@/lib/budget';
import { DashboardPeriodToolbar } from './components/DashboardPeriodToolbar';
import { DashboardKpis } from './components/DashboardKpis';
import { CategoryDonutChart, CategoryDonutItem } from './components/CategoryDonutChart';
import { SpendTrendChart, SpendTrendPoint } from './components/SpendTrendChart';
import {
  StackedCategoryBarChart,
  StackedBucketItem,
  CategoryBarMeta,
} from './components/StackedCategoryBarChart';
import { NeedWantSavingsSplit } from './components/NeedWantSavingsSplit';
import { TopMerchantsLeaderboard, TopMerchantItem } from './components/TopMerchantsLeaderboard';
import { PaymentMethodSplit, PaymentMethodItem } from './components/PaymentMethodSplit';
import { DayOfWeekHeatmap, DayOfWeekData } from './components/DayOfWeekHeatmap';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { useUiStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { openQuickAdd } = useUiStore();
  const { settings } = useSettingsStore();

  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [compareWithPrior, setCompareWithPrior] = useState(true);

  const [referenceDate, setReferenceDate] = useState(todayInIndia);
  const [customRange, setCustomRange] = useState<{ start?: string; end?: string }>({});

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [priorTransactions, setPriorTransactions] = useState<Transaction[]>([]);
  const [currentBudget, setCurrentBudget] = useState<Budget | undefined>();

  // Determine current and prior period range
  const currentPeriod: PeriodRange = useMemo(() => {
    return getPeriodRange(periodType, {
      referenceDate,
      weekStartsOn: settings.weekStartsOn,
      financialYearStartMonth: settings.financialYearStartMonth,
      customStartDate: customRange.start,
      customEndDate: customRange.end,
    });
  }, [
    periodType,
    referenceDate,
    settings.weekStartsOn,
    settings.financialYearStartMonth,
    customRange,
  ]);

  const priorPeriod: PeriodRange = useMemo(() => {
    return getPreviousPeriod(currentPeriod, {
      weekStartsOn: settings.weekStartsOn,
      financialYearStartMonth: settings.financialYearStartMonth,
    });
  }, [currentPeriod, settings.weekStartsOn, settings.financialYearStartMonth]);

  // Load Categories & Initial Reference Date
  useEffect(() => {
    const init = async () => {
      try {
        const cats = await repository.getCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load dashboard categories:', err);
      }
    };
    init();
  }, []);

  const isMonthlyView = periodType === 'month';

  // Fetch transactions for current and prior periods
  const loadPeriodData = useCallback(async () => {
    try {
      setLoading(true);
      const [currentTxs, priorTxs, monthBudget] = await Promise.all([
        repository.getTransactionsByDateRange(currentPeriod.startDate, currentPeriod.endDate),
        compareWithPrior
          ? repository.getTransactionsByDateRange(priorPeriod.startDate, priorPeriod.endDate)
          : Promise.resolve([]),
        isMonthlyView
          ? repository.getBudgetForMonth(currentPeriod.startDate.substring(0, 7))
          : Promise.resolve(undefined),
      ]);

      setTransactions(currentTxs);
      setPriorTransactions(priorTxs);
      setCurrentBudget(monthBudget);
    } catch (err) {
      console.error('Failed to load period transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPeriod, priorPeriod, compareWithPrior, isMonthlyView]);

  useEffect(() => {
    loadPeriodData();
  }, [loadPeriodData]);

  // Period Navigation Steppers
  const handlePreviousPeriod = () => {
    const prev = getPreviousPeriod(currentPeriod, {
      weekStartsOn: settings.weekStartsOn,
      financialYearStartMonth: settings.financialYearStartMonth,
    });
    if (periodType === 'custom') {
      setCustomRange({ start: prev.startDate, end: prev.endDate });
    } else {
      setReferenceDate(prev.startDate);
    }
  };

  const handleNextPeriod = () => {
    const next = getNextPeriod(currentPeriod, {
      weekStartsOn: settings.weekStartsOn,
      financialYearStartMonth: settings.financialYearStartMonth,
    });
    if (periodType === 'custom') {
      setCustomRange({ start: next.startDate, end: next.endDate });
    } else {
      setReferenceDate(next.startDate);
    }
  };

  const handleCustomRangeSubmit = (startDate: string, endDate: string) => {
    setCustomRange({ start: startDate, end: endDate });
    setPeriodType('custom');
  };

  // -----------------------------------------------------------------
  // DATA PROCESSORS & METRICS
  // -----------------------------------------------------------------
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // 1. Total Spend Comparison
  const currentTotalSpend = useMemo(
    () => transactions.reduce((sum, tx) => sum + tx.amount, 0),
    [transactions]
  );

  const priorTotalSpend = useMemo(
    () => priorTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    [priorTransactions]
  );

  const totalSpendComparison = useMemo(
    () => calculateComparison(currentTotalSpend, priorTotalSpend),
    [currentTotalSpend, priorTotalSpend]
  );

  // 2. Daily Average Spend Comparison
  const currentDaysCount = Math.max(
    1,
    differenceInCalendarDays(
      parseReferenceDate(currentPeriod.endDate),
      parseReferenceDate(currentPeriod.startDate)
    ) + 1
  );

  const priorDaysCount = Math.max(
    1,
    differenceInCalendarDays(
      parseReferenceDate(priorPeriod.endDate),
      parseReferenceDate(priorPeriod.startDate)
    ) + 1
  );

  const currentDailyAvg = currentTotalSpend / currentDaysCount;
  const priorDailyAvg = priorTotalSpend / priorDaysCount;
  const dailyAvgComparison = useMemo(
    () => calculateComparison(currentDailyAvg, priorDailyAvg),
    [currentDailyAvg, priorDailyAvg]
  );

  // 3. Top Spending Category (resolving subcategories to their top-level category)
  const categorySpendMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of transactions) {
      const cat = categoryMap.get(tx.categoryId);
      const topCatId = cat?.parentId || tx.categoryId;
      map[topCatId] = (map[topCatId] || 0) + tx.amount;
    }
    return map;
  }, [transactions, categoryMap]);

  const topCategory = useMemo(() => {
    let topCatId: string | undefined;
    let maxAmount = 0;
    for (const [catId, amount] of Object.entries(categorySpendMap)) {
      if (amount > maxAmount) {
        maxAmount = amount;
        topCatId = catId;
      }
    }
    if (!topCatId || maxAmount <= 0) return undefined;
    const cat = categoryMap.get(topCatId);
    return {
      name: cat?.name || 'Category',
      amount: maxAmount,
      percentOfTotal: currentTotalSpend > 0 ? (maxAmount / currentTotalSpend) * 100 : 0,
      color: cat?.color || '#847DFF',
    };
  }, [categorySpendMap, categoryMap, currentTotalSpend]);

  // 4. Budget Status (only active for monthly view per requirement 4)
  const budgetStatus = useMemo(() => {
    if (!isMonthlyView || !currentBudget) return undefined;
    const metrics = calculateBudgetMetrics(
      currentBudget,
      transactions,
      categories,
      { referenceDate: currentPeriod.startDate }
    );
    return {
      percentUsed: metrics.percentUsed,
      status: metrics.status,
      remaining: metrics.remaining,
    };
  }, [isMonthlyView, currentBudget, transactions, categories, currentPeriod]);

  // 5. 50/30/20 Need/Want/Savings Split
  const { needSpent, wantSpent, savingsSpent, split503020 } = useMemo(() => {
    let need = 0;
    let want = 0;
    let savings = 0;

    for (const tx of transactions) {
      const cat = categoryMap.get(tx.categoryId);
      if (cat?.type === 'need') need += tx.amount;
      else if (cat?.type === 'want') want += tx.amount;
      else if (cat?.type === 'savings') savings += tx.amount;
      else need += tx.amount; // default
    }

    const safeTotal = currentTotalSpend > 0 ? currentTotalSpend : 1;
    const needPercent = Math.round((need / safeTotal) * 100);
    const wantPercent = Math.round((want / safeTotal) * 100);
    const savingsPercent = Math.max(0, 100 - needPercent - wantPercent);

    return {
      needSpent: need,
      wantSpent: want,
      savingsSpent: savings,
      split503020: { needPercent, wantPercent, savingsPercent },
    };
  }, [transactions, categoryMap, currentTotalSpend]);

  // 6. Category Donut Data
  const donutData: CategoryDonutItem[] = useMemo(() => {
    const list: CategoryDonutItem[] = [];
    for (const [catId, amount] of Object.entries(categorySpendMap)) {
      const cat = categoryMap.get(catId);
      list.push({
        id: catId,
        name: cat?.name || 'Other',
        amount,
        color: cat?.color || '#847DFF',
        percent: currentTotalSpend > 0 ? (amount / currentTotalSpend) * 100 : 0,
      });
    }
    return list.sort((a, b) => b.amount - a.amount);
  }, [categorySpendMap, categoryMap, currentTotalSpend]);

  // 7. Spend Trend Curve (Daily or Weekly)
  const spendTrendData: SpendTrendPoint[] = useMemo(() => {
    const dayMap: Record<string, { amount: number; count: number }> = {};
    for (const tx of transactions) {
      const datePart = tx.date.substring(0, 10);
      if (!dayMap[datePart]) {
        dayMap[datePart] = { amount: 0, count: 0 };
      }
      dayMap[datePart].amount += tx.amount;
      dayMap[datePart].count += 1;
    }

    const sortedDates = Object.keys(dayMap).sort();
    return sortedDates.map((dateStr) => {
      const parsed = parseReferenceDate(dateStr);
      return {
        date: format(parsed, 'd MMM yyyy'),
        label: format(parsed, 'd MMM'),
        amount: dayMap[dateStr]?.amount ?? 0,
        txCount: dayMap[dateStr]?.count ?? 0,
      };
    });
  }, [transactions]);

  // 8. Stacked Category Bar Chart Data (over 4 equal sub-intervals or days)
  const { stackedData, stackedCategoryMeta } = useMemo(() => {
    const topCats = donutData.slice(0, 5);
    const meta: CategoryBarMeta[] = topCats.map((c) => ({
      key: c.id,
      name: c.name,
      color: c.color,
    }));

    // Break into buckets (e.g. 4 sub-periods)
    const bucketCount = 4;
    const bucketDuration = Math.ceil(currentDaysCount / bucketCount);
    const buckets: StackedBucketItem[] = [];

    const startObj = parseReferenceDate(currentPeriod.startDate);

    for (let b = 0; b < bucketCount; b++) {
      const bStartDay = b * bucketDuration;
      const bEndDay = Math.min(currentDaysCount, (b + 1) * bucketDuration);
      if (bStartDay >= currentDaysCount) break;

      const label = `Period ${b + 1} (d${bStartDay + 1}–${bEndDay})`;
      const bucketItem: StackedBucketItem = { bucketLabel: label };

      // Initialize all top categories to 0
      meta.forEach((m) => {
        bucketItem[m.key] = 0;
      });

      // Filter transactions falling in this interval
      for (const tx of transactions) {
        const txDate = parseReferenceDate(tx.date.substring(0, 10));
        const dayOffset = differenceInCalendarDays(txDate, startObj);
        if (dayOffset >= bStartDay && dayOffset < bEndDay) {
          const cat = categoryMap.get(tx.categoryId);
          const topCatId = cat?.parentId || tx.categoryId;
          if (meta.some((m) => m.key === topCatId)) {
            bucketItem[topCatId] =
              ((bucketItem[topCatId] as number) || 0) + tx.amount;
          }
        }
      }

      buckets.push(bucketItem);
    }

    return { stackedData: buckets, stackedCategoryMeta: meta };
  }, [donutData, currentDaysCount, currentPeriod, transactions, categoryMap]);

  // 9. Top Merchants Leaderboard
  const topMerchantsData: TopMerchantItem[] = useMemo(() => {
    const merchantMap: Record<string, { amount: number; count: number; catId: string }> = {};
    for (const tx of transactions) {
      const existing = merchantMap[tx.merchant] || { amount: 0, count: 0, catId: tx.categoryId };
      existing.amount += tx.amount;
      existing.count += 1;
      merchantMap[tx.merchant] = existing;
    }

    return Object.entries(merchantMap)
      .map(([merchant, val]) => ({
        merchant,
        totalAmount: val.amount,
        txCount: val.count,
        categoryName: categoryMap.get(val.catId)?.name,
        percent: currentTotalSpend > 0 ? (val.amount / currentTotalSpend) * 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);
  }, [transactions, categoryMap, currentTotalSpend]);

  // 10. Payment Method Split
  const paymentMethodData: PaymentMethodItem[] = useMemo(() => {
    const methodNames: Record<PaymentMethod, { label: string; color: string }> = {
      upi: { label: 'UPI', color: '#847DFF' },
      card: { label: 'Credit/Debit Card', color: '#00B3DD' },
      cash: { label: 'Cash', color: '#B86A04' },
      net_banking: { label: 'Net Banking', color: '#1B6B4C' },
      wallet: { label: 'Digital Wallet', color: '#90B8F0' },
    };

    const counts: Record<PaymentMethod, { amount: number; count: number }> = {
      upi: { amount: 0, count: 0 },
      card: { amount: 0, count: 0 },
      cash: { amount: 0, count: 0 },
      net_banking: { amount: 0, count: 0 },
      wallet: { amount: 0, count: 0 },
    };

    for (const tx of transactions) {
      const m = tx.paymentMethod || 'upi';
      if (counts[m]) {
        counts[m].amount += tx.amount;
        counts[m].count += 1;
      }
    }

    return (Object.keys(counts) as PaymentMethod[])
      .filter((k) => counts[k].amount > 0)
      .map((k) => ({
        id: k,
        name: methodNames[k].label,
        amount: counts[k].amount,
        txCount: counts[k].count,
        percent: currentTotalSpend > 0 ? (counts[k].amount / currentTotalSpend) * 100 : 0,
        color: methodNames[k].color,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, currentTotalSpend]);

  // 11. Day of Week Heatmap
  const dayOfWeekData: DayOfWeekData[] = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // Reorder starting Monday (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
    const orderedIndices = [1, 2, 3, 4, 5, 6, 0];

    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    for (const tx of transactions) {
      const dIndex = getDay(parseReferenceDate(tx.date.substring(0, 10)));
      dayTotals[dIndex] = (dayTotals[dIndex] || 0) + tx.amount;
      dayCounts[dIndex] = (dayCounts[dIndex] || 0) + 1;
    }

    const maxSpend = Math.max(...dayTotals);

    return orderedIndices.map((idx) => {
      const totalAmount = dayTotals[idx] || 0;
      const txCount = dayCounts[idx] || 0;
      const averageSpend = txCount > 0 ? Math.round(totalAmount / txCount) : 0;
      return {
        dayName: dayNames[idx] || '',
        dayIndex: idx,
        totalAmount,
        txCount,
        averageSpend,
        isPeak: maxSpend > 0 && totalAmount === maxSpend,
      };
    });
  }, [transactions]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Period Selector Toolbar */}
      <DashboardPeriodToolbar
        currentPeriod={currentPeriod}
        periodType={periodType}
        onPeriodTypeChange={setPeriodType}
        onPrevious={handlePreviousPeriod}
        onNext={handleNextPeriod}
        compareWithPrior={compareWithPrior}
        onToggleCompare={setCompareWithPrior}
        onCustomRangeSubmit={handleCustomRangeSubmit}
      />

      {loading ? (
        <div className="space-y-6">
          <SkeletonLoader count={5} variant="kpi" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonLoader count={1} variant="card" className="h-80" />
            <SkeletonLoader count={1} variant="card" className="h-80" />
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No Transactions Found"
          description={`There are no recorded expenses between ${currentPeriod.startDate} and ${currentPeriod.endDate}. Record a new expense or change the period view.`}
          actionLabel="Quick Add Expense"
          onAction={openQuickAdd}
        />
      ) : (
        <>
          {/* Executive KPI Cards */}
          <DashboardKpis
            data={{
              totalSpendComparison,
              dailyAvgComparison,
              topCategory,
              isMonthlyView,
              budgetStatus,
              split503020,
            }}
            compareWithPrior={compareWithPrior}
            priorPeriodLabel={priorPeriod.shortLabel}
          />

          {/* Visualisations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual 1: Category Donut Chart */}
            <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-cream-200 dark:border-dark-border shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-base font-semibold text-deep-blue-900 dark:text-cream-100">
                    Category Breakdown
                  </h2>
                  <p className="text-xs text-deep-blue-600 dark:text-cream-300">
                    Top expense categories and proportional distribution
                  </p>
                </div>
              </div>
              <CategoryDonutChart data={donutData} totalSpend={currentTotalSpend} />
            </div>

            {/* Visual 2: Spend Trend Line/Area Chart */}
            <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-cream-200 dark:border-dark-border shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-base font-semibold text-deep-blue-900 dark:text-cream-100">
                    Daily Spending Trend
                  </h2>
                  <p className="text-xs text-deep-blue-600 dark:text-cream-300">
                    Spending curve and transaction frequency over {currentPeriod.shortLabel}
                  </p>
                </div>
              </div>
              <SpendTrendChart data={spendTrendData} />
            </div>

            {/* Visual 3: Stacked Bar Chart Over Time */}
            <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-cream-200 dark:border-dark-border shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-base font-semibold text-deep-blue-900 dark:text-cream-100">
                    Category Spend Over Time
                  </h2>
                  <p className="text-xs text-deep-blue-600 dark:text-cream-300">
                    Stacked progression across period intervals
                  </p>
                </div>
              </div>
              <StackedCategoryBarChart
                data={stackedData}
                categories={stackedCategoryMeta}
              />
            </div>

            {/* Visual 4: 50/30/20 Need/Want/Savings Split */}
            <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-cream-200 dark:border-dark-border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-deep-blue-900 dark:text-cream-100">
                    50/30/20 Rule Analysis
                  </h2>
                  <p className="text-xs text-deep-blue-600 dark:text-cream-300">
                    Target vs Actual allocation of needs, wants, and savings
                  </p>
                </div>
              </div>
              <NeedWantSavingsSplit
                needSpent={needSpent}
                wantSpent={wantSpent}
                savingsSpent={savingsSpent}
                totalSpend={currentTotalSpend}
              />
            </div>

            {/* Visual 5: Top Merchants Leaderboard */}
            <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-cream-200 dark:border-dark-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold text-deep-blue-900 dark:text-cream-100">
                    Top Merchants
                  </h2>
                  <p className="text-xs text-deep-blue-600 dark:text-cream-300">
                    Ranked merchant spend and transaction count
                  </p>
                </div>
              </div>
              <TopMerchantsLeaderboard
                merchants={topMerchantsData}
                totalSpend={currentTotalSpend}
              />
            </div>

            {/* Visual 6: Payment Method Split */}
            <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-cream-200 dark:border-dark-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold text-deep-blue-900 dark:text-cream-100">
                    Payment Methods
                  </h2>
                  <p className="text-xs text-deep-blue-600 dark:text-cream-300">
                    Distribution by UPI, Card, Cash, Net Banking, Wallet
                  </p>
                </div>
              </div>
              <PaymentMethodSplit data={paymentMethodData} />
            </div>
          </div>

          {/* Visual 7: Day-of-Week Spending Heatmap (Full Width) */}
          <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-cream-200 dark:border-dark-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-base font-semibold text-deep-blue-900 dark:text-cream-100">
                  Day-of-Week Spending Distribution
                </h2>
                <p className="text-xs text-deep-blue-600 dark:text-cream-300">
                  Analyze high-spend weekdays vs weekend surges across Monday to Sunday
                </p>
              </div>
            </div>
            <DayOfWeekHeatmap data={dayOfWeekData} />
          </div>

          {/* Quick link to Budgets Page */}
          <div className="p-5 rounded-3xl bg-deep-blue-50 dark:bg-dark-surface border border-deep-blue-100 dark:border-dark-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white dark:bg-dark-elevated text-deep-blue-600 dark:text-cream-100 shadow-sm">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-deep-blue-900 dark:text-cream-100">
                  Detailed Monthly Budget Planning
                </h3>
                <p className="text-xs text-deep-blue-700 dark:text-cream-300">
                  Set category limits, rollover surplus, and burn-rate pacing in Budgets
                </p>
              </div>
            </div>
            <Link
              to="/app/budgets"
              className="px-4 py-2 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm dark:bg-white dark:text-black dark:hover:bg-cream-200"
            >
              <span>Go to Budgets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
};
