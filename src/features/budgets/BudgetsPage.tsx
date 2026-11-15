import React, { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  Sparkles,
  Sliders,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  getDaysInMonth,
} from 'date-fns';
import { parseReferenceDate } from '@/lib/periods/financialYear';
import { repository } from '@/data/repository';
import { Budget, Category, Transaction } from '@/types';
import {
  calculateBudgetMetrics,
  computeRolloverFromPreviousMonth,
  generateCumulativePaceData,
  suggestBudget,
  BudgetPaceMetrics,
  BudgetSuggestionResult,
  CumulativeDayPoint,
} from '@/lib/budget';
import { BudgetKpis } from './components/BudgetKpis';
import { BudgetAlertBanner } from './components/BudgetAlertBanner';
import { BudgetVsActualChart } from './components/BudgetVsActualChart';
import { CumulativePaceChart } from './components/CumulativePaceChart';
import { CategoryBudgetCard } from './components/CategoryBudgetCard';
import { SuggestBudgetModal } from './components/SuggestBudgetModal';
import { EditBudgetModal } from './components/EditBudgetModal';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { useSettingsStore } from '@/store/settingsStore';

export const BudgetsPage: React.FC = () => {
  const { settings } = useSettingsStore();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [budget, setBudget] = useState<Budget | undefined>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [, setTransactions] = useState<Transaction[]>([]);
  const [metrics, setMetrics] = useState<BudgetPaceMetrics | null>(null);
  const [cumulativePoints, setCumulativePoints] = useState<CumulativeDayPoint[]>([]);

  // Modals state
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<BudgetSuggestionResult | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | undefined>();

  // Load available budget months & categories
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [allBudgets, cats] = await Promise.all([
        repository.getBudgets(),
        repository.getCategories(),
      ]);

      const months = Array.from(new Set(allBudgets.map((b) => b.month))).sort();
      // Ensure seeded months are present
      const seededMonths = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
      const combinedMonths = Array.from(new Set([...months, ...seededMonths])).sort();
      setAvailableMonths(combinedMonths);
      setCategories(cats);

      // Default to latest available month
      const initialMonth = combinedMonths.includes('2026-11') ? '2026-11' : combinedMonths[combinedMonths.length - 1] || '2026-11';
      setSelectedMonth(initialMonth);
    } catch (err) {
      console.error('Failed to load budget initial data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load monthly budget details and transactions
  const loadMonthData = useCallback(async (monthStr: string) => {
    try {
      setLoading(true);
      const lastDay = getDaysInMonth(parseReferenceDate(`${monthStr}-01`));
      const startDate = `${monthStr}-01`;
      const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const prevMonthStr = format(subMonths(parseReferenceDate(`${monthStr}-01`), 1), 'yyyy-MM');
      const prevLastDay = getDaysInMonth(parseReferenceDate(`${prevMonthStr}-01`));
      const prevStartDate = `${prevMonthStr}-01`;
      const prevEndDate = `${prevMonthStr}-${String(prevLastDay).padStart(2, '0')}`;

      const [currentBudget, txs, prevBudget, prevTxs] = await Promise.all([
        repository.getBudgetForMonth(monthStr),
        repository.getTransactionsByDateRange(startDate, endDate),
        repository.getBudgetForMonth(prevMonthStr),
        repository.getTransactionsByDateRange(prevStartDate, prevEndDate),
      ]);

      // If budget record doesn't exist yet, build placeholder budget
      let effectiveBudget = currentBudget;
      if (!effectiveBudget) {
        effectiveBudget = {
          id: `budget_${monthStr}`,
          month: monthStr,
          totalLimit: 120000,
          categoryLimits: {},
          rollover: true,
        };
      }

      setBudget(effectiveBudget);
      setTransactions(txs);

      // Compute Rollover from previous month if enabled
      let rolloverAmount = 0;
      let categoryRollovers: Record<string, number> = {};

      if (effectiveBudget.rollover && prevBudget) {
        const rolloverComp = computeRolloverFromPreviousMonth(
          monthStr,
          prevBudget,
          prevTxs,
          categories
        );
        rolloverAmount = rolloverComp.totalRollover;
        categoryRollovers = rolloverComp.categoryRollovers;
      }

      // Benchmark date for pace tracking (simulated active date 2026-11-15)
      const benchmarkDate = '2026-11-15';
      const computedMetrics = calculateBudgetMetrics(
        effectiveBudget,
        txs,
        categories,
        {
          referenceDate: benchmarkDate,
          rolloverAmount,
          categoryRollovers,
        }
      );
      setMetrics(computedMetrics);

      // Generate cumulative pace curve data
      const pacePoints = generateCumulativePaceData(
        monthStr,
        computedMetrics.effectiveLimit,
        txs,
        { referenceDate: benchmarkDate }
      );
      setCumulativePoints(pacePoints);
    } catch (err) {
      console.error('Failed to load month budget data:', err);
    } finally {
      setLoading(false);
    }
  }, [categories]);

  useEffect(() => {
    if (categories.length > 0 && selectedMonth) {
      loadMonthData(selectedMonth);
    }
  }, [selectedMonth, categories, loadMonthData]);

  // Month navigation
  const handlePrevMonth = () => {
    const prevDate = subMonths(parseReferenceDate(`${selectedMonth}-01`), 1);
    const prevStr = format(prevDate, 'yyyy-MM');
    setSelectedMonth(prevStr);
  };

  const handleNextMonth = () => {
    const nextDate = addMonths(parseReferenceDate(`${selectedMonth}-01`), 1);
    const nextStr = format(nextDate, 'yyyy-MM');
    setSelectedMonth(nextStr);
  };

  // Launch AI Suggestion
  const handleOpenSuggestModal = async () => {
    setIsSuggestModalOpen(true);
    setSuggestionLoading(true);
    try {
      const allHistoricalTxs = await repository.getAllTransactions();
      const res = await suggestBudget(selectedMonth, allHistoricalTxs, categories, {
        model: settings.geminiHeavyModel || 'gemini-3.8-flash',
      });
      setSuggestion(res);
    } catch (err) {
      console.error('Failed to generate budget suggestion:', err);
    } finally {
      setSuggestionLoading(false);
    }
  };

  const handleApplySuggestion = async (
    newTotal: number,
    newCategoryLimits: Record<string, number>
  ) => {
    const updated: Budget = {
      id: budget?.id || `budget_${selectedMonth}`,
      month: selectedMonth,
      totalLimit: newTotal,
      categoryLimits: newCategoryLimits,
      rollover: budget?.rollover ?? true,
      updatedAt: new Date().toISOString(),
    };
    await repository.setBudget(updated);
    await loadMonthData(selectedMonth);
  };

  const handleSaveBudget = async (updatedBudget: Budget) => {
    await repository.setBudget(updatedBudget);
    await loadMonthData(selectedMonth);
  };

  const handleEditCategory = (catId: string) => {
    setEditCategoryId(catId);
    setIsEditModalOpen(true);
  };

  const formattedMonthLabel = format(parseReferenceDate(`${selectedMonth}-01`), 'MMMM yyyy');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header & Month Picker Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-deep-blue-900 dark:text-cream-100">
            Monthly Budgets
          </h1>
          <p className="text-xs text-deep-blue-600 dark:text-cream-300">
            Monitor real-time burn rate, linear pace variance, and category limits
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Stepper */}
          <div className="flex items-center bg-white dark:bg-dark-surface rounded-2xl border border-cream-200 dark:border-dark-border p-1 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl text-deep-blue-700 dark:text-cream-200 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-deep-blue-500 dark:text-cream-200" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-deep-blue-900 dark:text-cream-100 focus:outline-none cursor-pointer"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m} className="bg-white dark:bg-dark-surface text-deep-blue-900 dark:text-cream-100">
                    {format(parseReferenceDate(`${m}-01`), 'MMM yyyy')}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl text-deep-blue-700 dark:text-cream-200 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* AI Suggest Budget Button */}
          <button
            onClick={handleOpenSuggestModal}
            className="px-4 py-2 rounded-2xl bg-deep-blue-50 hover:bg-deep-blue-100 dark:bg-dark-elevated dark:hover:bg-dark-border border border-deep-blue-200 dark:border-dark-border text-deep-blue-700 dark:text-cream-100 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-deep-blue-500 dark:text-cream-100" />
            Suggest Budget (AI)
          </button>

          {/* Edit Budget Limits Button */}
          <button
            onClick={() => {
              setEditCategoryId(undefined);
              setIsEditModalOpen(true);
            }}
            className="px-4 py-2 rounded-2xl bg-deep-blue-500 hover:bg-deep-blue-600 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-transform active:scale-95"
          >
            <Sliders className="w-3.5 h-3.5" />
            Manage Limits
          </button>
        </div>
      </div>

      {loading && !metrics ? (
        <div className="space-y-6">
          <SkeletonLoader count={4} variant="kpi" />
          <SkeletonLoader count={2} variant="card" className="h-72" />
        </div>
      ) : metrics ? (
        <>
          {/* Threshold Alerts Banner (50%, 80%, 100%) */}
          <BudgetAlertBanner alerts={metrics.alerts} />

          {/* Executive KPI Cards */}
          <BudgetKpis metrics={metrics} />

          {/* Recharts Visualisations: Budget vs Actual & Cumulative Spend vs Ideal Pace */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Budget vs Actual per Category */}
            <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-cream-200 dark:border-dark-border shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-base font-bold text-deep-blue-900 dark:text-cream-100">
                    Budget vs Actual Spend
                  </h2>
                  <p className="text-xs text-deep-blue-600 dark:text-cream-300">
                    Category limit comparison for {formattedMonthLabel}
                  </p>
                </div>
              </div>
              <BudgetVsActualChart categories={metrics.categories} />
            </div>

            {/* Chart 2: Cumulative Spend vs Ideal Pace */}
            <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-cream-200 dark:border-dark-border shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-base font-bold text-deep-blue-900 dark:text-cream-100">
                    Cumulative Spend vs Ideal Pace
                  </h2>
                  <p className="text-xs text-deep-blue-600 dark:text-cream-300">
                    Linear pace tracking and projected month-end trajectory
                  </p>
                </div>
              </div>
              <CumulativePaceChart
                data={cumulativePoints}
                totalLimit={metrics.effectiveLimit}
              />
            </div>
          </div>

          {/* Category Budget Breakdown Cards */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-deep-blue-900 dark:text-cream-100">
                  Category Limits & Pace ({metrics.categories.length})
                </h2>
                <p className="text-xs text-deep-blue-600 dark:text-cream-300">
                  Track individual category burn rates and rollover surpluses
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.categories.map((cat) => (
                <CategoryBudgetCard
                  key={cat.categoryId}
                  category={cat}
                  onEdit={handleEditCategory}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* Suggest Budget Modal */}
      <SuggestBudgetModal
        isOpen={isSuggestModalOpen}
        onClose={() => setIsSuggestModalOpen(false)}
        suggestion={suggestion}
        isLoading={suggestionLoading}
        onRegenerate={handleOpenSuggestModal}
        onApply={handleApplySuggestion}
      />

      {/* Edit Budget Modal */}
      <EditBudgetModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        month={selectedMonth}
        budget={budget}
        categories={categories}
        onSave={handleSaveBudget}
        preselectedCategoryId={editCategoryId}
      />
    </div>
  );
};
