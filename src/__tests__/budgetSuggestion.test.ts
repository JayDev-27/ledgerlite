import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
  aggregateThreeMonthSpend,
  generateDeterministicBudget,
  suggestBudget,
} from '@/lib/budget';
import { Category, Transaction } from '@/types';

const sampleCategories: Category[] = [
  { id: 'cat_rent', name: 'Rent', type: 'need', color: '#16587B', icon: 'Home' },
  { id: 'sub_rent_flat', name: 'Apartment Rent', parentId: 'cat_rent', type: 'need', color: '#16587B', icon: 'Key' },
  { id: 'cat_groceries', name: 'Groceries', type: 'need', color: '#84B3CE', icon: 'ShoppingBag' },
  { id: 'cat_dining', name: 'Dining & Drinks', type: 'want', color: '#B86A04', icon: 'Utensils' },
  { id: 'cat_mutual_funds', name: 'SIP & Investments', type: 'savings', color: '#1B6B4C', icon: 'PiggyBank' },
];

describe('Budget Suggestion Engine (Heuristic & AI Fallback)', () => {
  const transactions: Transaction[] = [
    // Month 2026-08
    { id: 't1', amount: 30000, currency: 'INR', date: '2026-08-05T00:00:00.000Z', merchant: 'Rent', categoryId: 'cat_rent', paymentMethod: 'net_banking', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    { id: 't2', amount: 12000, currency: 'INR', date: '2026-08-12T00:00:00.000Z', merchant: 'Supermarket', categoryId: 'cat_groceries', paymentMethod: 'card', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    { id: 't3', amount: 8000, currency: 'INR', date: '2026-08-18T00:00:00.000Z', merchant: 'Restaurants', categoryId: 'cat_dining', paymentMethod: 'upi', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    { id: 't4', amount: 15000, currency: 'INR', date: '2026-08-20T00:00:00.000Z', merchant: 'SIP Mutual Fund', categoryId: 'cat_mutual_funds', paymentMethod: 'net_banking', tags: [], source: 'manual', createdAt: '', updatedAt: '' },

    // Month 2026-09
    { id: 't5', amount: 30000, currency: 'INR', date: '2026-09-05T00:00:00.000Z', merchant: 'Rent', categoryId: 'cat_rent', paymentMethod: 'net_banking', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    { id: 't6', amount: 13000, currency: 'INR', date: '2026-09-12T00:00:00.000Z', merchant: 'Supermarket', categoryId: 'cat_groceries', paymentMethod: 'card', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    { id: 't7', amount: 7000, currency: 'INR', date: '2026-09-18T00:00:00.000Z', merchant: 'Restaurants', categoryId: 'cat_dining', paymentMethod: 'upi', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    { id: 't8', amount: 15000, currency: 'INR', date: '2026-09-20T00:00:00.000Z', merchant: 'SIP Mutual Fund', categoryId: 'cat_mutual_funds', paymentMethod: 'net_banking', tags: [], source: 'manual', createdAt: '', updatedAt: '' },

    // Month 2026-10
    { id: 't9', amount: 30000, currency: 'INR', date: '2026-10-05T00:00:00.000Z', merchant: 'Rent', categoryId: 'cat_rent', paymentMethod: 'net_banking', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    { id: 't10', amount: 14000, currency: 'INR', date: '2026-10-12T00:00:00.000Z', merchant: 'Supermarket', categoryId: 'cat_groceries', paymentMethod: 'card', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    { id: 't11', amount: 9000, currency: 'INR', date: '2026-10-18T00:00:00.000Z', merchant: 'Restaurants', categoryId: 'cat_dining', paymentMethod: 'upi', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    { id: 't12', amount: 15000, currency: 'INR', date: '2026-10-20T00:00:00.000Z', merchant: 'SIP Mutual Fund', categoryId: 'cat_mutual_funds', paymentMethod: 'net_banking', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
  ];

  it('aggregates exact 3-month spending prior to target month', () => {
    const agg = aggregateThreeMonthSpend('2026-11', transactions, sampleCategories);
    expect(agg.targetMonth).toBe('2026-11');
    expect(agg.monthsEvaluated).toEqual(['2026-08', '2026-09', '2026-10']);

    const rent = agg.categorySummaries.find((c) => c.categoryId === 'cat_rent');
    expect(rent?.averageSpend).toBe(30000);

    const groceries = agg.categorySummaries.find((c) => c.categoryId === 'cat_groceries');
    // (12000 + 13000 + 14000) / 3 = 13000
    expect(groceries?.averageSpend).toBe(13000);

    const dining = agg.categorySummaries.find((c) => c.categoryId === 'cat_dining');
    // (8000 + 7000 + 9000) / 3 = 8000
    expect(dining?.averageSpend).toBe(8000);

    const savings = agg.categorySummaries.find((c) => c.categoryId === 'cat_mutual_funds');
    expect(savings?.averageSpend).toBe(15000);
  });

  it('generates deterministic heuristic budget with 50/30/20 sanity adjustments', () => {
    const agg = aggregateThreeMonthSpend('2026-11', transactions, sampleCategories);
    const suggestion = generateDeterministicBudget(agg);

    expect(suggestion.month).toBe('2026-11');
    expect(suggestion.isAiGenerated).toBe(false);

    // Rent is Need: 30,000 * 1.05 = 31,500
    expect(suggestion.categoryLimits['cat_rent']).toBe(31500);

    // Groceries is Need: 13,000 * 1.05 = 13,650 -> rounded to 13,700
    expect(suggestion.categoryLimits['cat_groceries']).toBe(13700);

    // Dining is Want: 8,000 * 0.95 = 7,600
    expect(suggestion.categoryLimits['cat_dining']).toBe(7600);

    // Savings: 15,000 * 1.1 = 16,500
    expect(suggestion.categoryLimits['cat_mutual_funds']).toBe(16500);

    // Total should equal sum of categories
    expect(suggestion.totalLimit).toBe(31500 + 13700 + 7600 + 16500);
    expect(suggestion.rationale).toContain('50/30/20');
  });

  it('suggestBudget gracefully falls back to deterministic heuristic when no API key is provided', async () => {
    const result = await suggestBudget('2026-11', transactions, sampleCategories, { apiKey: '' });
    expect(result.month).toBe('2026-11');
    expect(result.isAiGenerated).toBe(false);
    expect(result.items.length).toBe(sampleCategories.filter((c) => !c.parentId).length);
    expect(result.totalLimit).toBeGreaterThan(0);
  });

  it('rolls up subcategory spending into top-level parent category in 3-month aggregation', () => {
    const txWithSubcat: Transaction[] = [
      {
        id: 'ts1',
        amount: 25000,
        currency: 'INR',
        date: '2026-08-05T00:00:00.000Z',
        merchant: 'Apartment',
        categoryId: 'sub_rent_flat', // child of cat_rent
        paymentMethod: 'net_banking',
        tags: [],
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'ts2',
        amount: 25000,
        currency: 'INR',
        date: '2026-09-05T00:00:00.000Z',
        merchant: 'Apartment',
        categoryId: 'sub_rent_flat',
        paymentMethod: 'net_banking',
        tags: [],
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'ts3',
        amount: 25000,
        currency: 'INR',
        date: '2026-10-05T00:00:00.000Z',
        merchant: 'Apartment',
        categoryId: 'sub_rent_flat',
        paymentMethod: 'net_banking',
        tags: [],
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const agg = aggregateThreeMonthSpend('2026-11', txWithSubcat, sampleCategories);
    const rentSummary = agg.categorySummaries.find((c) => c.categoryId === 'cat_rent');
    expect(rentSummary).toBeDefined();
    expect(rentSummary?.averageSpend).toBe(25000);
  });
});
