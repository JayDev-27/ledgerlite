import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '@/lib/gemini/agent/tools';
import type { Repository } from '@/data/repository';
import type { Category, Transaction, Budget, MemoryItem } from '@/types';

describe('Chat Agent Tools — Local Deterministic Database Reasoning', () => {
  let mockTransactions: Transaction[];
  let mockCategories: Category[];
  let mockBudgets: Budget[];
  let mockMemories: MemoryItem[];
  let mockRepo: Repository;

  beforeEach(() => {
    mockCategories = [
      { id: 'cat_groceries', name: 'Groceries', type: 'need', color: '#10b981', icon: 'ShoppingCart' },
      { id: 'cat_dining', name: 'Dining Out', type: 'want', color: '#f59e0b', icon: 'Utensils' },
      { id: 'cat_invest', name: 'Investments', type: 'savings', color: '#3b82f6', icon: 'TrendingUp' },
    ];

    mockTransactions = [
      {
        id: 'tx-1',
        date: '2026-11-02',
        merchant: 'Swiggy',
        amount: 850,
        currency: 'INR',
        categoryId: 'cat_dining',
        paymentMethod: 'upi',
        tags: [],
        source: 'manual',
        createdAt: '2026-11-02T10:00:00Z',
        updatedAt: '2026-11-02T10:00:00Z',
      },
      {
        id: 'tx-2',
        date: '2026-11-05',
        merchant: 'Nature Basket',
        amount: 2400,
        currency: 'INR',
        categoryId: 'cat_groceries',
        paymentMethod: 'card',
        tags: [],
        source: 'manual',
        createdAt: '2026-11-05T12:00:00Z',
        updatedAt: '2026-11-05T12:00:00Z',
      },
      {
        id: 'tx-3',
        date: '2026-11-10',
        merchant: 'Zerodha Coin',
        amount: 15000,
        currency: 'INR',
        categoryId: 'cat_invest',
        paymentMethod: 'net_banking',
        tags: [],
        source: 'manual',
        createdAt: '2026-11-10T09:00:00Z',
        updatedAt: '2026-11-10T09:00:00Z',
      },
      {
        id: 'tx-4',
        date: '2026-10-15',
        merchant: 'Zomato',
        amount: 1200,
        currency: 'INR',
        categoryId: 'cat_dining',
        paymentMethod: 'upi',
        tags: [],
        source: 'manual',
        createdAt: '2026-10-15T19:00:00Z',
        updatedAt: '2026-10-15T19:00:00Z',
      },
    ];

    mockBudgets = [
      {
        id: 'b-2026-11',
        month: '2026-11',
        totalLimit: 25000,
        categoryLimits: {
          cat_dining: 5000,
          cat_groceries: 8000,
          cat_invest: 12000,
        },
        rollover: false,
      },
    ];

    mockMemories = [];

    mockRepo = {
      getAllTransactions: vi.fn(async () => mockTransactions),
      getCategories: vi.fn(async () => mockCategories),
      getBudgetForMonth: vi.fn(async (m: string) => mockBudgets.find((b) => b.month === m)),
      createMemoryItem: vi.fn(async (item) => {
        const created: MemoryItem = {
          ...item,
          id: `mem-${Date.now()}`,
          createdAt: new Date().toISOString(),
          approvedAt: item.approvedAt ?? null,
        };
        mockMemories.push(created);
        return created;
      }),
    } as unknown as Repository;
  });

  it('Tool 1: query_transactions filters by date range, category, merchant, and amount', async () => {
    // Search for dining in November
    const res1 = (await executeTool(
      'query_transactions',
      {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        category: 'Dining Out',
      },
      mockRepo
    )) as { count: number; totalAmount: number; transactions: Array<{ merchant: string; amount: number }> };

    expect(res1.count).toBe(1);
    expect(res1.totalAmount).toBe(850);
    expect(res1.transactions[0]?.merchant).toBe('Swiggy');

    // Search by min amount
    const res2 = (await executeTool(
      'query_transactions',
      { minAmount: 2000 },
      mockRepo
    )) as { count: number; totalAmount: number };

    expect(res2.count).toBe(2); // Nature Basket (2400) + Zerodha (15000)
    expect(res2.totalAmount).toBe(17400);
  });

  it('Tool 2: aggregate groups by category and payment method correctly', async () => {
    const resCat = (await executeTool(
      'aggregate',
      {
        groupBy: 'category',
        period: { startDate: '2026-11-01', endDate: '2026-11-30' },
      },
      mockRepo
    )) as { grandTotal: number; groups: Array<{ key: string; total: number; count: number }> };

    expect(resCat.grandTotal).toBe(18250);
    expect(resCat.groups[0]?.key).toBe('Investments');
    expect(resCat.groups[0]?.total).toBe(15000);

    const resPay = (await executeTool(
      'aggregate',
      { groupBy: 'paymentMethod' },
      mockRepo
    )) as { groups: Array<{ key: string; total: number }> };

    const upiGroup = resPay.groups.find((g) => g.key === 'upi');
    expect(upiGroup?.total).toBe(2050); // Swiggy 850 + Zomato 1200
  });

  it('Tool 3: compare_periods computes exact deltas and percentage changes', async () => {
    const res = (await executeTool(
      'compare_periods',
      {
        periodA: { startDate: '2026-10-01', endDate: '2026-10-31' },
        periodB: { startDate: '2026-11-01', endDate: '2026-11-30' },
      },
      mockRepo
    )) as {
      periodA: { totalSpend: number; count: number };
      periodB: { totalSpend: number; count: number };
      deltaAmount: number;
      percentageChange: number;
    };

    expect(res.periodA.totalSpend).toBe(1200);
    expect(res.periodA.count).toBe(1);
    expect(res.periodB.totalSpend).toBe(18250);
    expect(res.periodB.count).toBe(3);
    expect(res.deltaAmount).toBe(17050);
    expect(res.percentageChange).toBeGreaterThan(1000);
  });

  it('Tool 4: get_budget_status calculates total limit, spent, remaining, burn rate, and status', async () => {
    const res = (await executeTool(
      'get_budget_status',
      { month: '2026-11' },
      mockRepo
    )) as {
      hasBudget: boolean;
      totalLimit: number;
      totalSpent: number;
      remaining: number;
      burnRate: number;
      status: string;
      categoryBreakdown: Array<{ categoryName: string; spent: number; limit: number }>;
    };

    expect(res.hasBudget).toBe(true);
    expect(res.totalLimit).toBe(25000);
    expect(res.totalSpent).toBe(18250);
    expect(res.remaining).toBe(6750);
    expect(res.status).toBe('under_budget'); // 18250 / 25000 = 73% (under 90% threshold)
    expect(res.categoryBreakdown.length).toBe(3);
  });

  it('Tool 5: list_categories returns categories with Need/Want/Savings tags', async () => {
    const res = (await executeTool('list_categories', {}, mockRepo)) as {
      count: number;
      categories: Array<{ name: string; type: string }>;
    };

    expect(res.count).toBe(3);
    expect(res.categories.map((c) => c.type)).toEqual(['need', 'want', 'savings']);
  });

  it('Tool 6: propose_memory requires user approval and sets approvedAt to null', async () => {
    const res = (await executeTool(
      'propose_memory',
      {
        kind: 'goal',
        text: 'Save ₹1,00,000 for emergency reserve by end of Q1 2027',
      },
      mockRepo
    )) as {
      status: string;
      memoryId: string;
      requiresUserApproval: boolean;
    };

    expect(res.status).toBe('proposed');
    expect(res.requiresUserApproval).toBe(true);
    expect(mockMemories.length).toBe(1);
    expect(mockMemories[0]?.approvedAt).toBeNull();
  });

  it('Tool 1 respects Privacy Mode by stripping personal notes and redacting merchant identifiers', async () => {
    // Add transaction with sensitive notes and account details
    mockTransactions.push({
      id: 'tx-sensitive',
      date: '2026-11-15',
      merchant: 'A/C 12345678 Electricity Board',
      amount: 1450,
      currency: 'INR',
      categoryId: 'cat_groceries',
      paymentMethod: 'upi',
      notes: 'Confidential personal note with landlord phone 9876543210',
      tags: [],
      source: 'manual',
      createdAt: '2026-11-15T10:00:00Z',
      updatedAt: '2026-11-15T10:00:00Z',
    });

    // Query with privacyMode = true (default)
    const resPrivate = (await executeTool(
      'query_transactions',
      { startDate: '2026-11-15', endDate: '2026-11-15' },
      mockRepo,
      true
    )) as { transactions: Array<{ merchant: string; notes: string | null }> };

    expect(resPrivate.transactions[0]?.notes).toBeNull();
    expect(resPrivate.transactions[0]?.merchant).toContain('[ACCOUNT REDACTED]');
    expect(resPrivate.transactions[0]?.merchant).not.toContain('12345678');

    // Query with privacyMode = false
    const resPublic = (await executeTool(
      'query_transactions',
      { startDate: '2026-11-15', endDate: '2026-11-15' },
      mockRepo,
      false
    )) as { transactions: Array<{ merchant: string; notes: string | null }> };

    expect(resPublic.transactions[0]?.notes).toBe('Confidential personal note with landlord phone 9876543210');
    expect(resPublic.transactions[0]?.merchant).toBe('A/C 12345678 Electricity Board');
  });
});
