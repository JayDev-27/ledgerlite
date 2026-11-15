import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { FinanceDatabase } from '@/data/db';
import { DexieRepository } from '@/data/repository/DexieRepository';
import { seedDatabase, purgeDemoData, seedCategoriesOnly } from '@/data/seed';

describe('Hosted first run — no demo data in real vaults', () => {
  it('seedCategoriesOnly creates the taxonomy and nothing else', async () => {
    const repo = new DexieRepository(new FinanceDatabase(`purge_a_${Date.now()}`));
    expect(await seedCategoriesOnly(repo)).toBe(true);
    expect((await repo.getCategories()).length).toBeGreaterThan(10);
    expect(await repo.countTransactions()).toBe(0);
    expect(await repo.getBudgets()).toEqual([]);
    expect(await seedCategoriesOnly(repo)).toBe(false); // idempotent
  });

  it('purgeDemoData removes seeded records but keeps user-created ones', async () => {
    const repo = new DexieRepository(new FinanceDatabase(`purge_b_${Date.now()}`));
    await seedDatabase(repo, false);
    expect(await repo.countTransactions()).toBeGreaterThan(500);

    // User activity after the seed
    const mine = await repo.createTransaction({
      date: '2026-11-15',
      amount: 250,
      merchant: 'Chai Point',
      categoryId: 'cat_food_dining',
      paymentMethod: 'upi',
      source: 'manual',
      tags: [],
    } as unknown as Parameters<typeof repo.createTransaction>[0]);
    const later = new Date(Date.now() + 120_000).toISOString();
    await repo.setBudget({
      id: 'budget_2026-12',
      month: '2026-12',
      totalLimit: 90000,
      categoryLimits: {},
      rollover: false,
      createdAt: later,
      updatedAt: later,
    });

    const removed = await purgeDemoData(repo);
    expect(removed).toBeGreaterThan(500);

    expect((await repo.getAllTransactions()).map((t) => t.id)).toEqual([mine.id]);
    expect((await repo.getBudgets()).map((b) => b.id)).toEqual(['budget_2026-12']);
    expect(await repo.getRules()).toEqual([]);
    expect(await repo.getRecurring()).toEqual([]);
    expect((await repo.getCategories()).length).toBeGreaterThan(10); // taxonomy kept

    expect(await purgeDemoData(repo)).toBe(0); // runs once
  });
});
