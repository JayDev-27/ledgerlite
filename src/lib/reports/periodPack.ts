import { differenceInCalendarDays, parseISO, format, addDays } from 'date-fns';
import { Transaction, Category, PaymentMethod } from '@/types';
import { calculateComparison } from '@/lib/periods/comparison';
import { detectPeriodAnomalies } from './anomalies';
import {
  PeriodPack,
  PeriodPackOptions,
  CategoryBreakdownItem,
  CategoryBreakdownSubitem,
  NeedWantSavingsSummary,
  BudgetStatusSummary,
  TopMerchantSummary,
  PaymentMethodSummary,
  RecurringPeriodSummary,
  DailySpendPoint,
  CategoryBudgetStatus,
} from './types';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  upi: 'UPI (GPay / PhonePe / Paytm)',
  card: 'Credit / Debit Cards',
  net_banking: 'Net Banking (NEFT / IMPS)',
  cash: 'Cash',
  wallet: 'Digital Wallets',
};

export function computePeriodPack(options: PeriodPackOptions): PeriodPack {
  const {
    transactions,
    priorTransactions = [],
    historicalTransactions,
    categories,
    budgets = [],
    recurring = [],
    periodRange,
  } = options;

  // 1. Calculate Period Duration
  const startD = parseISO(periodRange.startDate);
  const endD = parseISO(periodRange.endDate);
  const daysInPeriod = Math.max(1, differenceInCalendarDays(endD, startD) + 1);

  // 2. Compute KPIs & Largest Expense
  const totalSpend = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const transactionCount = transactions.length;
  const dailyAverage = totalSpend / daysInPeriod;

  let largestTx: Transaction | undefined;
  for (const tx of transactions) {
    if (!largestTx || tx.amount > largestTx.amount) {
      largestTx = tx;
    }
  }

  // Category mapping
  const categoryMap = new Map<string, Category>();
  for (const c of categories) {
    categoryMap.set(c.id, c);
  }

  const largestExpense = largestTx
    ? {
        merchant: largestTx.merchant,
        amount: largestTx.amount,
        date: largestTx.date,
        categoryName: categoryMap.get(largestTx.categoryId)?.name || 'Uncategorised',
      }
    : undefined;

  // Prior Period Comparison
  const priorSpend = priorTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const priorCount = priorTransactions.length;
  const priorDays = Math.max(1, daysInPeriod); // matching period length
  const priorDailyAvg = priorSpend / priorDays;

  const spendComp = calculateComparison(totalSpend, priorSpend);
  const countComp = calculateComparison(transactionCount, priorCount);
  const dailyComp = calculateComparison(dailyAverage, priorDailyAvg);

  const kpis = {
    totalSpend: {
      current: totalSpend,
      previous: priorSpend,
      delta: spendComp.delta,
      percentChange: spendComp.percentChange,
      trend: spendComp.trend,
    },
    transactionCount: {
      current: transactionCount,
      previous: priorCount,
      delta: countComp.delta,
      percentChange: countComp.percentChange,
      trend: countComp.trend,
    },
    dailyAverage: {
      current: dailyAverage,
      previous: priorDailyAvg,
      delta: dailyComp.delta,
      percentChange: dailyComp.percentChange,
      trend: dailyComp.trend,
    },
    daysInPeriod,
    largestExpense,
  };

  // 3. Find Matching Budget(s) for Period
  const startMonth = periodRange.startDate.slice(0, 7);
  const endMonth = periodRange.endDate.slice(0, 7);
  const matchingBudgets = budgets.filter((b) => b.month >= startMonth && b.month <= endMonth);

  // If matching budgets found, compute combined limit & category limits
  const hasBudget = matchingBudgets.length > 0;
  let totalLimit = 0;
  const combinedCategoryLimits: Record<string, number> = {};

  if (hasBudget) {
    for (const b of matchingBudgets) {
      totalLimit += b.totalLimit || 0;
      if (b.categoryLimits) {
        for (const [cId, lim] of Object.entries(b.categoryLimits)) {
          combinedCategoryLimits[cId] = (combinedCategoryLimits[cId] || 0) + lim;
        }
      }
    }
  }

  // 4. Category Breakdown & 50/30/20 Grouping
  const catSpendMap = new Map<string, { amount: number; count: number; subMap: Map<string, { amount: number; count: number }> }>();
  let needSpend = 0;
  let wantSpend = 0;
  let savingsSpend = 0;

  for (const tx of transactions) {
    const parentCat = categoryMap.get(tx.categoryId);
    const catId = parentCat ? (parentCat.parentId ? parentCat.parentId : parentCat.id) : tx.categoryId;
    const resolvedCat = categoryMap.get(catId);
    const catType = resolvedCat?.type || 'want';

    if (catType === 'need') needSpend += tx.amount;
    else if (catType === 'savings') savingsSpend += tx.amount;
    else wantSpend += tx.amount;

    let entry = catSpendMap.get(catId);
    if (!entry) {
      entry = { amount: 0, count: 0, subMap: new Map() };
      catSpendMap.set(catId, entry);
    }
    entry.amount += tx.amount;
    entry.count += 1;

    const subId = tx.subcategoryId || (parentCat?.parentId ? tx.categoryId : undefined);
    if (subId) {
      const sub = entry.subMap.get(subId) || { amount: 0, count: 0 };
      sub.amount += tx.amount;
      sub.count += 1;
      entry.subMap.set(subId, sub);
    }
  }

  // Build Category Breakdown Items
  const categoryBreakdown: CategoryBreakdownItem[] = [];
  // Ensure all parent categories with spend or in taxonomy are represented
  for (const [catId, data] of catSpendMap.entries()) {
    const cat = categoryMap.get(catId);
    const name = cat?.name || 'Other';
    const type = cat?.type || 'want';
    const color = cat?.color || '#847DFF';
    const icon = cat?.icon || 'Circle';
    const percentage = totalSpend > 0 ? (data.amount / totalSpend) * 100 : 0;

    const budgetLimit = hasBudget ? combinedCategoryLimits[catId] : undefined;
    const variance = budgetLimit !== undefined ? budgetLimit - data.amount : undefined;
    const percentUsed = budgetLimit !== undefined && budgetLimit > 0
      ? (data.amount / budgetLimit) * 100
      : undefined;

    const subcategories: CategoryBreakdownSubitem[] = [];
    for (const [subId, subData] of data.subMap.entries()) {
      const subCat = categoryMap.get(subId);
      subcategories.push({
        id: subId,
        name: subCat?.name || subId,
        amount: subData.amount,
        percentage: data.amount > 0 ? (subData.amount / data.amount) * 100 : 0,
        count: subData.count,
      });
    }
    subcategories.sort((a, b) => b.amount - a.amount);

    categoryBreakdown.push({
      categoryId: catId,
      categoryName: name,
      categoryType: type,
      color,
      icon,
      amount: data.amount,
      percentage,
      transactionCount: data.count,
      budgetLimit,
      variance,
      percentUsed,
      subcategories,
    });
  }

  categoryBreakdown.sort((a, b) => b.amount - a.amount);

  // 50/30/20 Distribution
  const distribution50_30_20: NeedWantSavingsSummary = {
    need: {
      amount: needSpend,
      percentage: totalSpend > 0 ? (needSpend / totalSpend) * 100 : 0,
      targetPercentage: 50,
    },
    want: {
      amount: wantSpend,
      percentage: totalSpend > 0 ? (wantSpend / totalSpend) * 100 : 0,
      targetPercentage: 30,
    },
    savings: {
      amount: savingsSpend,
      percentage: totalSpend > 0 ? (savingsSpend / totalSpend) * 100 : 0,
      targetPercentage: 20,
    },
    totalTracked: totalSpend,
  };

  // 5. Budget Status Summary
  const budgetVariance = totalLimit > 0 ? totalLimit - totalSpend : 0;
  const budgetPercentUsed = totalLimit > 0 ? (totalSpend / totalLimit) * 100 : 0;

  // Extrapolate projected end-of-period spend
  const today = new Date();
  let projectedEnd = totalSpend;
  if (today < startD) {
    projectedEnd = 0;
  } else if (today <= endD) {
    const elapsedDays = Math.max(1, differenceInCalendarDays(today, startD) + 1);
    projectedEnd = (totalSpend / elapsedDays) * daysInPeriod;
  } else {
    projectedEnd = totalSpend;
  }

  let budgetOverallStatus: 'on_track' | 'warning' | 'exceeded' = 'on_track';
  if (budgetPercentUsed > 100) budgetOverallStatus = 'exceeded';
  else if (budgetPercentUsed > 85) budgetOverallStatus = 'warning';

  const categoryBudgets: CategoryBudgetStatus[] = [];
  if (hasBudget && Object.keys(combinedCategoryLimits).length > 0) {
    for (const [cId, limit] of Object.entries(combinedCategoryLimits)) {
      if (limit > 0) {
        const spent = catSpendMap.get(cId)?.amount || 0;
        categoryBudgets.push({
          categoryId: cId,
          categoryName: categoryMap.get(cId)?.name || cId,
          limit,
          spent,
          variance: limit - spent,
          percentUsed: (spent / limit) * 100,
        });
      }
    }
  }
  categoryBudgets.sort((a, b) => b.limit - a.limit);

  const budgetStatus: BudgetStatusSummary = {
    hasBudget,
    month: matchingBudgets[0]?.month,
    totalLimit,
    totalSpent: totalSpend,
    variance: budgetVariance,
    percentUsed: budgetPercentUsed,
    projectedEnd,
    status: budgetOverallStatus,
    categoryBudgets,
  };

  // 6. Top Merchants
  const merchantMap = new Map<string, { amount: number; count: number; categoryId: string }>();
  for (const tx of transactions) {
    const m = tx.merchant.trim();
    const entry = merchantMap.get(m) || { amount: 0, count: 0, categoryId: tx.categoryId };
    entry.amount += tx.amount;
    entry.count += 1;
    merchantMap.set(m, entry);
  }

  const topMerchants: TopMerchantSummary[] = Array.from(merchantMap.entries())
    .map(([merchant, data]) => ({
      merchant,
      amount: data.amount,
      count: data.count,
      percentage: totalSpend > 0 ? (data.amount / totalSpend) * 100 : 0,
      categoryId: data.categoryId,
      categoryName: categoryMap.get(data.categoryId)?.name || 'General',
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // 7. Payment Methods Breakdown
  const methodMap = new Map<PaymentMethod, { amount: number; count: number }>();
  for (const tx of transactions) {
    const m = tx.paymentMethod || 'upi';
    const entry = methodMap.get(m) || { amount: 0, count: 0 };
    entry.amount += tx.amount;
    entry.count += 1;
    methodMap.set(m, entry);
  }

  const paymentMethods: PaymentMethodSummary[] = Array.from(methodMap.entries())
    .map(([method, data]) => ({
      method,
      label: PAYMENT_LABELS[method] || method.toUpperCase(),
      amount: data.amount,
      count: data.count,
      percentage: totalSpend > 0 ? (data.amount / totalSpend) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // 8. Recurring Costs Summary
  const recurringTxList = transactions.filter(
    (tx) => !!tx.recurringId || tx.source === 'recurring' || tx.tags?.includes('recurring')
  );
  const totalRecurringSpend = recurringTxList.reduce((sum, tx) => sum + tx.amount, 0);

  const activeRecurringItems = recurring
    .filter((r) => r.active)
    .map((r) => ({
      id: r.id,
      merchant: r.template.merchant,
      amount: r.template.amount,
      cadence: r.cadence,
      categoryName: categoryMap.get(r.template.categoryId)?.name || 'General',
      nextDue: r.nextDue,
    }));

  const recurringSummary: RecurringPeriodSummary = {
    totalRecurringSpend,
    percentageOfTotal: totalSpend > 0 ? (totalRecurringSpend / totalSpend) * 100 : 0,
    activeCount: activeRecurringItems.length,
    incurredCount: recurringTxList.length,
    items: activeRecurringItems,
  };

  // 9. Anomaly Detection
  const anomalies = detectPeriodAnomalies({
    transactions,
    categories,
    historicalTransactions,
  });

  // 10. Daily Spend Trend
  const dailyMap = new Map<string, { amount: number; count: number }>();
  for (const tx of transactions) {
    const day = tx.date.slice(0, 10);
    const entry = dailyMap.get(day) || { amount: 0, count: 0 };
    entry.amount += tx.amount;
    entry.count += 1;
    dailyMap.set(day, entry);
  }

  const dailyTrend: DailySpendPoint[] = [];
  // Build continuous timeline between startDate and endDate (cap at 90 days for chart readability)
  const maxDays = Math.min(daysInPeriod, 92);
  for (let i = 0; i < maxDays; i++) {
    const curDate = addDays(startD, i);
    const dayKey = format(curDate, 'yyyy-MM-dd');
    const dayData = dailyMap.get(dayKey) || { amount: 0, count: 0 };
    dailyTrend.push({
      date: dayKey,
      label: format(curDate, 'd MMM'),
      amount: dayData.amount,
      count: dayData.count,
    });
  }

  return {
    periodRange,
    generatedAt: new Date().toISOString(),
    kpis,
    categoryBreakdown,
    distribution50_30_20,
    budgetStatus,
    topMerchants,
    paymentMethods,
    recurringSummary,
    anomalies,
    dailyTrend,
  };
}
