import { describe, it, expect } from 'vitest';
import { computePeriodPack } from '@/lib/reports/periodPack';
import { detectPeriodAnomalies } from '@/lib/reports/anomalies';
import { DEFAULT_CATEGORIES } from '@/data/categories';
import { Transaction, Budget, RecurringExpense } from '@/types';
import { PeriodRange } from '@/lib/periods/types';

describe('Period Pack & Anomaly Detection Engine', () => {
  const mockPeriodRange: PeriodRange = {
    type: 'month',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    label: 'November 2026',
    shortLabel: 'Nov 2026',
  };

  const sampleTransactions: Transaction[] = [
    {
      id: 'tx_1',
      amount: 32000,
      currency: 'INR',
      date: '2026-11-01T10:00:00.000Z',
      merchant: 'Sobha Developers',
      categoryId: 'cat_housing',
      subcategoryId: 'sub_rent',
      paymentMethod: 'net_banking',
      tags: ['rent', 'fixed'],
      source: 'recurring',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
    {
      id: 'tx_2',
      amount: 4500,
      currency: 'INR',
      date: '2026-11-03T14:30:00.000Z',
      merchant: 'Nature Basket',
      categoryId: 'cat_groceries',
      subcategoryId: 'sub_supermarket',
      paymentMethod: 'card',
      tags: ['groceries'],
      source: 'manual',
      createdAt: '2026-11-03T14:30:00.000Z',
      updatedAt: '2026-11-03T14:30:00.000Z',
    },
    {
      id: 'tx_3',
      amount: 1800,
      currency: 'INR',
      date: '2026-11-05T19:00:00.000Z',
      merchant: 'Swiggy',
      categoryId: 'cat_food_dining',
      subcategoryId: 'sub_delivery',
      paymentMethod: 'upi',
      tags: ['food'],
      source: 'quick_add',
      createdAt: '2026-11-05T19:00:00.000Z',
      updatedAt: '2026-11-05T19:00:00.000Z',
    },
    {
      id: 'tx_4',
      amount: 25000,
      currency: 'INR',
      date: '2026-11-10T11:00:00.000Z',
      merchant: 'Zerodha Coin SIP',
      categoryId: 'cat_investments',
      subcategoryId: 'sub_mutual_funds',
      paymentMethod: 'net_banking',
      tags: ['sip', 'wealth'],
      source: 'recurring',
      createdAt: '2026-11-10T11:00:00.000Z',
      updatedAt: '2026-11-10T11:00:00.000Z',
    },
  ];

  const priorTransactions: Transaction[] = [
    {
      id: 'tx_prior_1',
      amount: 32000,
      currency: 'INR',
      date: '2026-10-01T10:00:00.000Z',
      merchant: 'Sobha Developers',
      categoryId: 'cat_housing',
      paymentMethod: 'net_banking',
      tags: [],
      source: 'recurring',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'tx_prior_2',
      amount: 20000,
      currency: 'INR',
      date: '2026-10-10T10:00:00.000Z',
      merchant: 'Zerodha Coin SIP',
      categoryId: 'cat_investments',
      paymentMethod: 'net_banking',
      tags: [],
      source: 'recurring',
      createdAt: '2026-10-10T10:00:00.000Z',
      updatedAt: '2026-10-10T10:00:00.000Z',
    },
  ];

  const sampleBudget: Budget = {
    id: 'b_nov_2026',
    month: '2026-11',
    totalLimit: 80000,
    categoryLimits: {
      cat_housing: 35000,
      cat_groceries: 15000,
      cat_food_dining: 8000,
    },
    rollover: false,
  };

  const sampleRecurring: RecurringExpense[] = [
    {
      id: 'rec_rent',
      template: {
        merchant: 'Sobha Developers',
        amount: 32000,
        currency: 'INR',
        categoryId: 'cat_housing',
        paymentMethod: 'net_banking',
      },
      cadence: 'monthly',
      nextDue: '2026-12-01',
      active: true,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
  ];

  it('computes correct KPIs, totals, daily averages, and prior comparisons', () => {
    const pack = computePeriodPack({
      transactions: sampleTransactions,
      priorTransactions,
      categories: DEFAULT_CATEGORIES,
      budgets: [sampleBudget],
      recurring: sampleRecurring,
      periodRange: mockPeriodRange,
    });

    const expectedTotal = 32000 + 4500 + 1800 + 25000; // 63,300
    expect(pack.kpis.totalSpend.current).toBe(expectedTotal);
    expect(pack.kpis.transactionCount.current).toBe(4);
    expect(pack.kpis.daysInPeriod).toBe(30);
    expect(pack.kpis.dailyAverage.current).toBeCloseTo(expectedTotal / 30, 2);

    // Prior comparison check
    const expectedPrior = 32000 + 20000; // 52,000
    expect(pack.kpis.totalSpend.previous).toBe(expectedPrior);
    expect(pack.kpis.totalSpend.delta).toBe(expectedTotal - expectedPrior);
    expect(pack.kpis.totalSpend.trend).toBe('up');

    // Largest expense
    expect(pack.kpis.largestExpense?.merchant).toBe('Sobha Developers');
    expect(pack.kpis.largestExpense?.amount).toBe(32000);
  });

  it('computes 50/30/20 Need/Want/Savings distribution accurately', () => {
    const pack = computePeriodPack({
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      periodRange: mockPeriodRange,
    });

    // Housing (Need) = 32,000; Groceries (Need) = 4,500 => Need total = 36,500
    // Food & Dining (Want) = 1,800 => Want total = 1,800
    // Investments (Savings) = 25,000 => Savings total = 25,000
    const total = 63300;
    expect(pack.distribution50_30_20.need.amount).toBe(36500);
    expect(pack.distribution50_30_20.want.amount).toBe(1800);
    expect(pack.distribution50_30_20.savings.amount).toBe(25000);

    expect(pack.distribution50_30_20.need.percentage).toBeCloseTo((36500 / total) * 100, 1);
    expect(pack.distribution50_30_20.want.percentage).toBeCloseTo((1800 / total) * 100, 1);
    expect(pack.distribution50_30_20.savings.percentage).toBeCloseTo((25000 / total) * 100, 1);
  });

  it('computes budget headroom and category variances', () => {
    const pack = computePeriodPack({
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      budgets: [sampleBudget],
      periodRange: mockPeriodRange,
    });

    expect(pack.budgetStatus.hasBudget).toBe(true);
    expect(pack.budgetStatus.totalLimit).toBe(80000);
    expect(pack.budgetStatus.totalSpent).toBe(63300);
    expect(pack.budgetStatus.variance).toBe(80000 - 63300);
    expect(pack.budgetStatus.status).toBe('on_track');

    const housingBudget = pack.budgetStatus.categoryBudgets.find((b) => b.categoryId === 'cat_housing');
    expect(housingBudget?.limit).toBe(35000);
    expect(housingBudget?.spent).toBe(32000);
    expect(housingBudget?.variance).toBe(3000);
  });

  it('computes top merchants and payment method split', () => {
    const pack = computePeriodPack({
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      periodRange: mockPeriodRange,
    });

    expect(pack.topMerchants.length).toBe(4);
    expect(pack.topMerchants[0]?.merchant).toBe('Sobha Developers');
    expect(pack.topMerchants[0]?.amount).toBe(32000);

    const netBanking = pack.paymentMethods.find((p) => p.method === 'net_banking');
    expect(netBanking?.amount).toBe(32000 + 25000);
    expect(netBanking?.count).toBe(2);
  });

  it('detects category average multiple anomalies (>3x category average)', () => {
    // Normal baseline: 5 cafe transactions averaging ₹300
    const historicalTxs: Transaction[] = [
      { id: 'h1', amount: 300, currency: 'INR', date: '2026-10-01', merchant: 'Blue Tokai', categoryId: 'cat_food_dining', paymentMethod: 'upi', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
      { id: 'h2', amount: 350, currency: 'INR', date: '2026-10-05', merchant: 'Third Wave', categoryId: 'cat_food_dining', paymentMethod: 'upi', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
      { id: 'h3', amount: 250, currency: 'INR', date: '2026-10-10', merchant: 'Starbucks', categoryId: 'cat_food_dining', paymentMethod: 'upi', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
      { id: 'h4', amount: 400, currency: 'INR', date: '2026-10-15', merchant: 'Subway', categoryId: 'cat_food_dining', paymentMethod: 'upi', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
      { id: 'h5', amount: 300, currency: 'INR', date: '2026-10-20', merchant: 'KFC', categoryId: 'cat_food_dining', paymentMethod: 'upi', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    ];

    // Current period: massive dining spike of ₹8,500 (> 20x category average)
    const currentTxs: Transaction[] = [
      { id: 'c1', amount: 8500, currency: 'INR', date: '2026-11-12', merchant: 'Taj Falaknuma Palace', categoryId: 'cat_food_dining', paymentMethod: 'card', tags: ['fine-dining'], source: 'manual', createdAt: '', updatedAt: '' },
      { id: 'c2', amount: 320, currency: 'INR', date: '2026-11-14', merchant: 'Blue Tokai', categoryId: 'cat_food_dining', paymentMethod: 'upi', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    ];

    const anomalies = detectPeriodAnomalies({
      transactions: currentTxs,
      categories: DEFAULT_CATEGORIES,
      historicalTransactions: historicalTxs,
    });

    expect(anomalies.length).toBe(1);
    expect(anomalies[0]?.merchant).toBe('Taj Falaknuma Palace');
    expect(anomalies[0]?.amount).toBe(8500);
    expect(anomalies[0]?.rule).toBe('category_multiple');
  });

  it('detects first-time high-value merchant anomalies (>= ₹5,000)', () => {
    const historicalTxs: Transaction[] = [
      { id: 'h1', amount: 10000, currency: 'INR', date: '2026-10-01', merchant: 'Amazon', categoryId: 'cat_shopping', paymentMethod: 'card', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
      { id: 'h2', amount: 11000, currency: 'INR', date: '2026-10-15', merchant: 'Amazon', categoryId: 'cat_shopping', paymentMethod: 'card', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    ];

    const currentTxs: Transaction[] = [
      { id: 'c1', amount: 12000, currency: 'INR', date: '2026-11-05', merchant: 'Croma Megastore', categoryId: 'cat_shopping', paymentMethod: 'card', tags: ['electronics'], source: 'manual', createdAt: '', updatedAt: '' },
    ];

    const anomalies = detectPeriodAnomalies({
      transactions: currentTxs,
      categories: DEFAULT_CATEGORIES,
      historicalTransactions: historicalTxs,
    });

    expect(anomalies.length).toBe(1);
    expect(anomalies[0]?.merchant).toBe('Croma Megastore');
    expect(anomalies[0]?.rule).toBe('first_time_high_value');
    expect(anomalies[0]?.severity).toBe('medium'); // 12,000 is >= 10,000
  });

  it('detects statistical deviation anomalies (>2.5 std devs)', () => {
    // Baseline: 4 transactions with mean ~5500, stdDev ~500
    const historicalTxs: Transaction[] = [
      { id: 'h1', amount: 5000, currency: 'INR', date: '2026-10-01', merchant: 'Supermarket A', categoryId: 'cat_groceries', paymentMethod: 'card', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
      { id: 'h2', amount: 6000, currency: 'INR', date: '2026-10-10', merchant: 'Supermarket B', categoryId: 'cat_groceries', paymentMethod: 'card', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
      { id: 'h3', amount: 5200, currency: 'INR', date: '2026-10-15', merchant: 'Supermarket C', categoryId: 'cat_groceries', paymentMethod: 'card', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
      { id: 'h4', amount: 5800, currency: 'INR', date: '2026-10-20', merchant: 'Supermarket D', categoryId: 'cat_groceries', paymentMethod: 'card', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    ];

    // Current period: spike to ₹8,000 (~5 std devs above mean, but 8000 / 5500 is only 1.45x < 3x)
    const currentTxs: Transaction[] = [
      { id: 'c1', amount: 8000, currency: 'INR', date: '2026-11-05', merchant: 'Supermarket Bulk Store', categoryId: 'cat_groceries', paymentMethod: 'card', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    ];

    const anomalies = detectPeriodAnomalies({
      transactions: currentTxs,
      categories: DEFAULT_CATEGORIES,
      historicalTransactions: historicalTxs,
    });

    expect(anomalies.length).toBe(1);
    expect(anomalies[0]?.merchant).toBe('Supermarket Bulk Store');
    expect(anomalies[0]?.rule).toBe('statistical_deviation');
  });

  it('aggregates multi-month budgets across a quarter and handles periods without budgets', () => {
    const quarterPeriod: PeriodRange = {
      type: 'quarter',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
      label: 'Q3 FY26-27',
      shortLabel: 'Q3',
    };

    const monthlyBudgets: Budget[] = [
      { id: 'b_oct', month: '2026-10', totalLimit: 50000, categoryLimits: { cat_groceries: 15000 }, rollover: false },
      { id: 'b_nov', month: '2026-11', totalLimit: 60000, categoryLimits: { cat_groceries: 15000 }, rollover: false },
      { id: 'b_dec', month: '2026-12', totalLimit: 55000, categoryLimits: { cat_groceries: 20000 }, rollover: false },
    ];

    const pack = computePeriodPack({
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      budgets: monthlyBudgets,
      periodRange: quarterPeriod,
    });

    expect(pack.budgetStatus.hasBudget).toBe(true);
    expect(pack.budgetStatus.totalLimit).toBe(50000 + 60000 + 55000); // 165,000
    const groceryBudget = pack.budgetStatus.categoryBudgets.find((b) => b.categoryId === 'cat_groceries');
    expect(groceryBudget?.limit).toBe(15000 + 15000 + 20000); // 50,000

    // Period without budget should NOT fallback to unrelated month
    const futurePeriod: PeriodRange = {
      type: 'month',
      startDate: '2027-08-01',
      endDate: '2027-08-31',
      label: 'August 2027',
      shortLabel: 'Aug 2027',
    };

    const futurePack = computePeriodPack({
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      budgets: monthlyBudgets,
      periodRange: futurePeriod,
    });

    expect(futurePack.budgetStatus.hasBudget).toBe(false);
    expect(futurePack.budgetStatus.totalLimit).toBe(0);
  });

  it('handles empty periods gracefully without crashing', () => {
    const pack = computePeriodPack({
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      periodRange: mockPeriodRange,
    });

    expect(pack.kpis.totalSpend.current).toBe(0);
    expect(pack.kpis.transactionCount.current).toBe(0);
    expect(pack.kpis.dailyAverage.current).toBe(0);
    expect(pack.anomalies).toEqual([]);
    expect(pack.topMerchants).toEqual([]);
  });
});
