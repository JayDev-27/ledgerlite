import { describe, it, expect } from 'vitest';
import {
  calculateBudgetMetrics,
  determineStatus,
  generateThresholdAlerts,
  computeRolloverFromPreviousMonth,
  generateCumulativePaceData,
} from '@/lib/budget';
import { Budget, Category, Transaction } from '@/types';

const sampleCategories: Category[] = [
  { id: 'cat_housing', name: 'Housing & Rent', type: 'need', color: '#16587B', icon: 'Home' },
  { id: 'sub_rent', name: 'House Rent', parentId: 'cat_housing', type: 'need', color: '#16587B', icon: 'Key' },
  { id: 'cat_food', name: 'Food & Dining', type: 'need', color: '#84B3CE', icon: 'Utensils' },
  { id: 'cat_shopping', name: 'Shopping', type: 'want', color: '#B86A04', icon: 'ShoppingBag' },
];

const mockBudget: Budget = {
  id: 'budget_2026-11',
  month: '2026-11',
  totalLimit: 100000,
  categoryLimits: {
    cat_housing: 40000,
    cat_food: 30000,
    cat_shopping: 20000,
  },
  rollover: true,
};

describe('Budgeting Mathematics & Pace Calculations', () => {
  it('correctly calculates spent, remaining, daysLeft, and safeToSpendPerDay mid-month', () => {
    // 30 days in November. On day 15:
    // Spent 50,000 of 100,000 budget
    // Days elapsed = 15, Days left = 15
    // Remaining = 50,000
    // Safe to spend / day = 50,000 / 15 = 3333.33
    // Burn rate = 50,000 / 15 = 3333.33
    // Projected month end = 50,000 + 3333.33 * 15 = 100,000
    const txs: Transaction[] = [
      {
        id: 'tx_1',
        amount: 30000,
        currency: 'INR',
        date: '2026-11-05T10:00:00.000Z',
        merchant: 'Landlord Rent',
        categoryId: 'cat_housing',
        paymentMethod: 'net_banking',
        tags: [],
        source: 'manual',
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z',
      },
      {
        id: 'tx_2',
        amount: 20000,
        currency: 'INR',
        date: '2026-11-12T14:00:00.000Z',
        merchant: 'Supermarket',
        categoryId: 'cat_food',
        paymentMethod: 'upi',
        tags: [],
        source: 'manual',
        createdAt: '2026-11-12T14:00:00.000Z',
        updatedAt: '2026-11-12T14:00:00.000Z',
      },
    ];

    const metrics = calculateBudgetMetrics(mockBudget, txs, sampleCategories, {
      referenceDate: '2026-11-15T00:00:00.000Z',
    });

    expect(metrics.totalDays).toBe(30);
    expect(metrics.daysElapsed).toBe(15);
    expect(metrics.daysLeft).toBe(15);
    expect(metrics.spent).toBe(50000);
    expect(metrics.remaining).toBe(50000);
    expect(metrics.percentUsed).toBe(50);
    expect(metrics.burnRate).toBeCloseTo(3333.33, 1);
    expect(metrics.safeToSpendPerDay).toBeCloseTo(3333.33, 1);
    expect(metrics.projectedMonthEndSpend).toBeCloseTo(100000, 0);
    expect(metrics.status).toBe('on-track');
  });

  it('identifies at-risk status when pace projects overspending or spend is >= 80%', () => {
    // On day 10, spent 40,000 of 100,000 budget.
    // Burn rate = 4,000 / day.
    // Projected month end = 40,000 + 4,000 * 20 = 120,000 (> 100,000).
    // Status must be 'at-risk'.
    const statusOverPace = determineStatus(40000, 100000, 120000, 40);
    expect(statusOverPace).toBe('at-risk');

    // Currently at 85% spent even if projected is within limit:
    const statusHighSpend = determineStatus(85000, 100000, 95000, 85);
    expect(statusHighSpend).toBe('at-risk');
  });

  it('identifies over-budget status and sets safeToSpendPerDay to 0', () => {
    // Spent 110,000 of 100,000 budget
    const txs: Transaction[] = [
      {
        id: 'tx_1',
        amount: 110000,
        currency: 'INR',
        date: '2026-11-20T10:00:00.000Z',
        merchant: 'Mega Electronics',
        categoryId: 'cat_shopping',
        paymentMethod: 'card',
        tags: [],
        source: 'manual',
        createdAt: '2026-11-20T10:00:00.000Z',
        updatedAt: '2026-11-20T10:00:00.000Z',
      },
    ];

    const metrics = calculateBudgetMetrics(mockBudget, txs, sampleCategories, {
      referenceDate: '2026-11-20T00:00:00.000Z',
    });

    expect(metrics.spent).toBe(110000);
    expect(metrics.remaining).toBe(-10000);
    expect(metrics.safeToSpendPerDay).toBe(0);
    expect(metrics.status).toBe('over');
  });

  it('triggers threshold alerts at 50%, 80%, and 100%', () => {
    // 50% milestone
    const alerts50 = generateThresholdAlerts('overall', 50000, 100000, 50);
    expect(alerts50.length).toBe(1);
    expect(alerts50[0]?.threshold).toBe(50);
    expect(alerts50[0]?.level).toBe('info');

    // 85% warning
    const alerts85 = generateThresholdAlerts('overall', 85000, 100000, 85);
    expect(alerts85.length).toBe(1);
    expect(alerts85[0]?.threshold).toBe(80);
    expect(alerts85[0]?.level).toBe('warning');

    // 105% exceeded
    const alerts105 = generateThresholdAlerts('overall', 105000, 100000, 105);
    expect(alerts105.length).toBe(1);
    expect(alerts105[0]?.threshold).toBe(100);
    expect(alerts105[0]?.level).toBe('danger');
  });

  describe('Rollover Computation', () => {
    it('rolls over surplus unspent budget from previous month', () => {
      const prevBudget: Budget = {
        id: 'budget_2026-10',
        month: '2026-10',
        totalLimit: 100000,
        categoryLimits: {
          cat_housing: 40000,
          cat_food: 30000,
        },
        rollover: true,
      };

      const prevTxs: Transaction[] = [
        {
          id: 'tx_p1',
          amount: 35000,
          currency: 'INR',
          date: '2026-10-05T00:00:00.000Z',
          merchant: 'Rent',
          categoryId: 'cat_housing',
          paymentMethod: 'net_banking',
          tags: [],
          source: 'manual',
          createdAt: '2026-10-05T00:00:00.000Z',
          updatedAt: '2026-10-05T00:00:00.000Z',
        },
        {
          id: 'tx_p2',
          amount: 25000,
          currency: 'INR',
          date: '2026-10-15T00:00:00.000Z',
          merchant: 'Food',
          categoryId: 'cat_food',
          paymentMethod: 'upi',
          tags: [],
          source: 'manual',
          createdAt: '2026-10-15T00:00:00.000Z',
          updatedAt: '2026-10-15T00:00:00.000Z',
        },
      ];

      // Total spent = 60,000 out of 100,000 -> 40,000 surplus
      // Housing spent = 35,000 out of 40,000 -> 5,000 surplus
      // Food spent = 25,000 out of 30,000 -> 5,000 surplus
      const rollover = computeRolloverFromPreviousMonth('2026-11', prevBudget, prevTxs);
      expect(rollover.totalRollover).toBe(40000);
      expect(rollover.categoryRollovers['cat_housing']).toBe(5000);
      expect(rollover.categoryRollovers['cat_food']).toBe(5000);

      // Verify that effective limit reflects the rollover
      const metricsWithRollover = calculateBudgetMetrics(
        mockBudget,
        [],
        sampleCategories,
        {
          referenceDate: '2026-11-01T00:00:00.000Z',
          rolloverAmount: rollover.totalRollover,
          categoryRollovers: rollover.categoryRollovers,
        }
      );

      expect(metricsWithRollover.baseLimit).toBe(100000);
      expect(metricsWithRollover.rolloverAmount).toBe(40000);
      expect(metricsWithRollover.effectiveLimit).toBe(140000);
      expect(metricsWithRollover.remaining).toBe(140000);

      const housingCat = metricsWithRollover.categories.find((c) => c.categoryId === 'cat_housing');
      expect(housingCat?.baseLimit).toBe(40000);
      expect(housingCat?.rolloverAmount).toBe(5000);
      expect(housingCat?.effectiveLimit).toBe(45000);
    });

    it('does not create negative rollover if previous month had a deficit', () => {
      const prevBudget: Budget = {
        id: 'budget_2026-10',
        month: '2026-10',
        totalLimit: 50000,
        categoryLimits: { cat_food: 20000 },
        rollover: true,
      };

      const overTxs: Transaction[] = [
        {
          id: 'tx_p1',
          amount: 60000,
          currency: 'INR',
          date: '2026-10-10T00:00:00.000Z',
          merchant: 'Overspend',
          categoryId: 'cat_food',
          paymentMethod: 'card',
          tags: [],
          source: 'manual',
          createdAt: '2026-10-10T00:00:00.000Z',
          updatedAt: '2026-10-10T00:00:00.000Z',
        },
      ];

      const rollover = computeRolloverFromPreviousMonth('2026-11', prevBudget, overTxs);
      expect(rollover.totalRollover).toBe(0);
      expect(rollover.categoryRollovers['cat_food']).toBeUndefined();
    });
  });

  describe('Cumulative Spend vs Ideal Pace Line', () => {
    it('generates 30 daily points with actual, ideal, and projected series for November', () => {
      const txs: Transaction[] = [
        {
          id: 'tx_1',
          amount: 10000,
          currency: 'INR',
          date: '2026-11-05T00:00:00.000Z',
          merchant: 'Rent advance',
          categoryId: 'cat_housing',
          paymentMethod: 'net_banking',
          tags: [],
          source: 'manual',
          createdAt: '2026-11-05T00:00:00.000Z',
          updatedAt: '2026-11-05T00:00:00.000Z',
        },
        {
          id: 'tx_2',
          amount: 5000,
          currency: 'INR',
          date: '2026-11-10T00:00:00.000Z',
          merchant: 'Groceries',
          categoryId: 'cat_food',
          paymentMethod: 'upi',
          tags: [],
          source: 'manual',
          createdAt: '2026-11-10T00:00:00.000Z',
          updatedAt: '2026-11-10T00:00:00.000Z',
        },
      ];

      const points = generateCumulativePaceData('2026-11', 100000, txs, {
        referenceDate: '2026-11-10T00:00:00.000Z',
      });

      expect(points.length).toBe(30);

      // Day 1: actual spend = 0, ideal = 1/30 * 100,000 = 3333
      expect(points[0]?.day).toBe(1);
      expect(points[0]?.actualCumulative).toBe(0);
      expect(points[0]?.idealCumulative).toBe(3333);

      // Day 5: actual spend jumped by 10,000
      expect(points[4]?.day).toBe(5);
      expect(points[4]?.actualCumulative).toBe(10000);

      // Day 10 (current day): actual spend is 15,000
      expect(points[9]?.day).toBe(10);
      expect(points[9]?.actualCumulative).toBe(15000);
      expect(points[9]?.projectedCumulative).toBe(15000);

      // Day 11 (future day): actual is undefined, projected is continued linearly
      expect(points[10]?.day).toBe(11);
      expect(points[10]?.actualCumulative).toBeUndefined();
      expect(points[10]?.projectedCumulative).toBeGreaterThan(15000);

      // Day 30: ideal is 100,000
      expect(points[29]?.day).toBe(30);
      expect(points[29]?.idealCumulative).toBe(100000);
    });

    it('generates full actual trajectory for past months without cutting off at mid-month', () => {
      // For May 2026 viewed with referenceDate Nov 15, 2026:
      // all 31 days have elapsed, so all 31 points should have actualCumulative
      const txs: Transaction[] = [
        {
          id: 'tx_may_1',
          amount: 25000,
          currency: 'INR',
          date: '2026-05-10T00:00:00.000Z',
          merchant: 'Mid month',
          categoryId: 'cat_housing',
          paymentMethod: 'net_banking',
          tags: [],
          source: 'manual',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'tx_may_2',
          amount: 15000,
          currency: 'INR',
          date: '2026-05-25T00:00:00.000Z',
          merchant: 'Late month',
          categoryId: 'cat_food',
          paymentMethod: 'card',
          tags: [],
          source: 'manual',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const points = generateCumulativePaceData('2026-05', 80000, txs, {
        referenceDate: '2026-11-15',
      });

      expect(points.length).toBe(31);
      // All days should have actualCumulative, none should have undefined
      for (let i = 0; i < 31; i++) {
        expect(points[i]?.actualCumulative).toBeDefined();
      }
      expect(points[30]?.actualCumulative).toBe(40000);
    });
  });

  describe('Subcategory Roll-up & Calendar Boundaries', () => {
    it('correctly calculates daysElapsed on day 1 of month across timezones', () => {
      const metrics = calculateBudgetMetrics(mockBudget, [], sampleCategories, {
        referenceDate: '2026-11-01',
      });
      expect(metrics.daysElapsed).toBe(1);
      expect(metrics.daysLeft).toBe(29);
      expect(metrics.totalDays).toBe(30);
    });

    it('rolls up subcategory spending into top-level parent category metrics', () => {
      // Transaction has categoryId 'sub_rent' (child of 'cat_housing')
      const txs: Transaction[] = [
        {
          id: 'tx_sub_1',
          amount: 32000,
          currency: 'INR',
          date: '2026-11-05T00:00:00.000Z',
          merchant: 'Landlord Apartment',
          categoryId: 'sub_rent',
          paymentMethod: 'net_banking',
          tags: [],
          source: 'manual',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const metrics = calculateBudgetMetrics(mockBudget, txs, sampleCategories, {
        referenceDate: '2026-11-15',
      });

      // Total spent must include subcategory
      expect(metrics.spent).toBe(32000);

      // Parent category cat_housing must record the 32,000 spend
      const housing = metrics.categories.find((c) => c.categoryId === 'cat_housing');
      expect(housing).toBeDefined();
      expect(housing?.spent).toBe(32000);
      expect(housing?.remaining).toBe(8000); // 40000 limit - 32000
    });

    it('rolls up subcategory spend when computing previous month rollover', () => {
      const prevBudget: Budget = {
        id: 'budget_2026-10',
        month: '2026-10',
        totalLimit: 50000,
        categoryLimits: {
          cat_housing: 40000,
        },
        rollover: true,
      };

      const prevTxs: Transaction[] = [
        {
          id: 'tx_prev_sub',
          amount: 30000,
          currency: 'INR',
          date: '2026-10-05T00:00:00.000Z',
          merchant: 'Rent direct',
          categoryId: 'sub_rent', // child of cat_housing
          paymentMethod: 'net_banking',
          tags: [],
          source: 'manual',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const rollover = computeRolloverFromPreviousMonth(
        '2026-11',
        prevBudget,
        prevTxs,
        sampleCategories
      );

      // 40,000 limit - 30,000 spend = 10,000 surplus
      expect(rollover.categoryRollovers['cat_housing']).toBe(10000);
      expect(rollover.totalRollover).toBe(20000); // 50000 total - 30000
    });

    it('handles zero previous month transactions with rollover enabled', () => {
      const prevBudget: Budget = {
        id: 'budget_2026-10',
        month: '2026-10',
        totalLimit: 60000,
        categoryLimits: {
          cat_housing: 40000,
          cat_food: 20000,
        },
        rollover: true,
      };

      const rollover = computeRolloverFromPreviousMonth(
        '2026-11',
        prevBudget,
        [],
        sampleCategories
      );

      expect(rollover.totalRollover).toBe(60000);
      expect(rollover.categoryRollovers['cat_housing']).toBe(40000);
      expect(rollover.categoryRollovers['cat_food']).toBe(20000);
    });
  });
});
