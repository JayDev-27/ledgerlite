import { describe, it, expect } from 'vitest';
import { generateSeedData } from '@/data/seed';
import { DEFAULT_CATEGORIES } from '@/data/categories';

describe('Seed Data Generator', () => {
  it('generates ~800 realistic transactions across 6 months', () => {
    const data = generateSeedData();

    // Check transactions
    expect(data.transactions.length).toBeGreaterThan(600);
    expect(data.transactions.length).toBeLessThan(1000);

    // Verify all transactions have valid IDs, positive amounts, valid dates
    for (const tx of data.transactions) {
      expect(tx.id).toBeTruthy();
      expect(tx.amount).toBeGreaterThan(0);
      expect(tx.currency).toBe('INR');
      expect(new Date(tx.date).toString()).not.toBe('Invalid Date');
      expect(tx.merchant.length).toBeGreaterThan(0);
      expect(['upi', 'card', 'cash', 'net_banking', 'wallet']).toContain(tx.paymentMethod);
    }
  });

  it('generates recurring rules and monthly budgets', () => {
    const data = generateSeedData();

    // Recurring templates
    expect(data.recurring.length).toBeGreaterThanOrEqual(8);
    const rent = data.recurring.find((r) => r.template.merchant.includes('Rent'));
    expect(rent).toBeDefined();
    expect(rent?.template.amount).toBe(35000);

    // Budgets
    expect(data.budgets.length).toBe(7); // May 2026 to Nov 2026
    const novBudget = data.budgets.find((b) => b.month === '2026-11');
    expect(novBudget).toBeDefined();
    expect(novBudget?.totalLimit).toBe(150000);

    // Rules
    expect(data.rules.length).toBeGreaterThanOrEqual(10);

    // Memory
    expect(data.memory.length).toBeGreaterThanOrEqual(5);
  });

  it('has comprehensive category taxonomy with Need/Want/Savings', () => {
    expect(DEFAULT_CATEGORIES.length).toBeGreaterThan(30);

    const rootCategories = DEFAULT_CATEGORIES.filter((c) => !c.parentId);
    expect(rootCategories.length).toBe(18);

    const needs = DEFAULT_CATEGORIES.filter((c) => c.type === 'need');
    const wants = DEFAULT_CATEGORIES.filter((c) => c.type === 'want');
    const savings = DEFAULT_CATEGORIES.filter((c) => c.type === 'savings');

    expect(needs.length).toBeGreaterThan(5);
    expect(wants.length).toBeGreaterThan(5);
    expect(savings.length).toBeGreaterThan(1);
  });
});
