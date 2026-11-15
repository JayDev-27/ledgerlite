import { getDaysInMonth, getDate, isSameMonth } from 'date-fns';
import { Budget, Category, Transaction } from '@/types';
import {
  BudgetPaceMetrics,
  CategoryBudgetMetrics,
  BudgetAlert,
  BudgetStatus,
} from './types';
import { parseReferenceDate } from '@/lib/periods/financialYear';

export interface CalculateBudgetOptions {
  referenceDate?: Date | string;
  rolloverAmount?: number;
  categoryRollovers?: Record<string, number>;
}

export function determineStatus(
  spent: number,
  effectiveLimit: number,
  projectedMonthEndSpend: number,
  percentUsed: number
): BudgetStatus {
  if (effectiveLimit <= 0) {
    return spent > 0 ? 'over' : 'on-track';
  }
  if (spent > effectiveLimit) {
    return 'over';
  }
  if (percentUsed >= 80 || projectedMonthEndSpend > effectiveLimit) {
    return 'at-risk';
  }
  return 'on-track';
}

export function generateThresholdAlerts(
  scope: 'overall' | 'category',
  spent: number,
  limit: number,
  percentUsed: number,
  categoryInfo?: { id: string; name: string }
): BudgetAlert[] {
  if (limit <= 0) return [];
  const alerts: BudgetAlert[] = [];
  const idPrefix = categoryInfo ? `cat_${categoryInfo.id}` : 'overall';
  const targetName = categoryInfo ? categoryInfo.name : 'Total budget';

  if (percentUsed >= 100) {
    alerts.push({
      id: `${idPrefix}_alert_100`,
      level: 'danger',
      threshold: 100,
      scope,
      categoryId: categoryInfo?.id,
      categoryName: categoryInfo?.name,
      message: `${targetName} exceeded limit (${percentUsed.toFixed(1)}% used)`,
      spent,
      limit,
      percentUsed,
    });
  } else if (percentUsed >= 80) {
    alerts.push({
      id: `${idPrefix}_alert_80`,
      level: 'warning',
      threshold: 80,
      scope,
      categoryId: categoryInfo?.id,
      categoryName: categoryInfo?.name,
      message: `${targetName} at ${percentUsed.toFixed(1)}% of limit (caution)`,
      spent,
      limit,
      percentUsed,
    });
  } else if (percentUsed >= 50) {
    alerts.push({
      id: `${idPrefix}_alert_50`,
      level: 'info',
      threshold: 50,
      scope,
      categoryId: categoryInfo?.id,
      categoryName: categoryInfo?.name,
      message: `${targetName} reached 50% milestone (${percentUsed.toFixed(1)}% used)`,
      spent,
      limit,
      percentUsed,
    });
  }

  return alerts;
}

export function calculateBudgetMetrics(
  budget: Budget,
  transactions: Transaction[],
  categories: Category[],
  options?: CalculateBudgetOptions
): BudgetPaceMetrics {
  const month = budget.month;
  const monthDate = parseReferenceDate(`${month}-01`);
  const totalDays = getDaysInMonth(monthDate);
  const refDate = parseReferenceDate(options?.referenceDate);

  let daysElapsed: number;
  if (isSameMonth(refDate, monthDate)) {
    daysElapsed = Math.min(totalDays, Math.max(1, getDate(refDate)));
  } else if (refDate > monthDate) {
    // Month is in the past
    daysElapsed = totalDays;
  } else {
    // Future month
    daysElapsed = 0;
  }

  const daysLeft = Math.max(0, totalDays - daysElapsed);

  // Filter transactions belonging to this month
  const monthTxs = transactions.filter((t) => t.date.startsWith(month));

  // Category spend map (resolving subcategories to their top-level parent category)
  const catLookup = new Map(categories.map((c) => [c.id, c]));
  const catSpendMap: Record<string, number> = {};
  let totalSpent = 0;

  for (const tx of monthTxs) {
    const cat = catLookup.get(tx.categoryId);
    const topCatId = cat?.parentId || tx.categoryId;
    catSpendMap[topCatId] = (catSpendMap[topCatId] || 0) + tx.amount;
    totalSpent += tx.amount;
  }

  // Base limit and rollover
  const baseLimit = budget.totalLimit;
  const rolloverAmount = options?.rolloverAmount || 0;
  const effectiveLimit = baseLimit + rolloverAmount;
  const remaining = effectiveLimit - totalSpent;
  const percentUsed = effectiveLimit > 0 ? (totalSpent / effectiveLimit) * 100 : 0;

  // Pace calculations
  const burnRate = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
  const safeToSpendPerDay =
    remaining > 0 && daysLeft > 0 ? remaining / daysLeft : 0;
  const projectedMonthEndSpend =
    daysElapsed > 0 ? totalSpent + burnRate * daysLeft : totalSpent;
  const projectedVariance = projectedMonthEndSpend - effectiveLimit;

  const status = determineStatus(
    totalSpent,
    effectiveLimit,
    projectedMonthEndSpend,
    percentUsed
  );

  const overallAlerts = generateThresholdAlerts(
    'overall',
    totalSpent,
    effectiveLimit,
    percentUsed
  );

  // Calculate category-level metrics
  const categoryMetrics: CategoryBudgetMetrics[] = categories
    .filter((c) => !c.parentId) // Only top-level categories have budget limits
    .map((cat) => {
      const catBaseLimit = budget.categoryLimits[cat.id] || 0;
      const catRollover = options?.categoryRollovers?.[cat.id] || 0;
      const catEffectiveLimit = catBaseLimit + catRollover;
      const catSpent = catSpendMap[cat.id] || 0;
      const catRemaining = catEffectiveLimit - catSpent;
      const catPercentUsed =
        catEffectiveLimit > 0 ? (catSpent / catEffectiveLimit) * 100 : 0;
      const catBurnRate = daysElapsed > 0 ? catSpent / daysElapsed : 0;
      const catProjected =
        daysElapsed > 0 ? catSpent + catBurnRate * daysLeft : catSpent;

      const catStatus = determineStatus(
        catSpent,
        catEffectiveLimit,
        catProjected,
        catPercentUsed
      );

      const catAlerts = generateThresholdAlerts(
        'category',
        catSpent,
        catEffectiveLimit,
        catPercentUsed,
        { id: cat.id, name: cat.name }
      );

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        type: cat.type,
        color: cat.color,
        baseLimit: catBaseLimit,
        rolloverAmount: catRollover,
        effectiveLimit: catEffectiveLimit,
        spent: catSpent,
        remaining: catRemaining,
        percentUsed: catPercentUsed,
        status: catStatus,
        alerts: catAlerts,
      };
    });

  // Combine overall alerts and category alerts for top-level warning banners
  const allAlerts: BudgetAlert[] = [
    ...overallAlerts,
    ...categoryMetrics.flatMap((c) => c.alerts),
  ];

  return {
    month,
    baseLimit,
    rolloverAmount,
    effectiveLimit,
    spent: totalSpent,
    remaining,
    percentUsed,
    totalDays,
    daysElapsed,
    daysLeft,
    burnRate,
    safeToSpendPerDay,
    projectedMonthEndSpend,
    projectedVariance,
    status,
    alerts: allAlerts,
    categories: categoryMetrics,
  };
}
