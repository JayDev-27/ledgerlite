import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { FinanceDatabase } from '@/data/db';
import { DexieRepository } from '@/data/repository/DexieRepository';
import {
  advanceDueDate,
  generateDueRecurringTransactions,
} from '@/features/recurring/recurringService';
import type { Category } from '@/types';

describe('Undo Deletion, Category Merging & Recurring Auto-Generation', () => {
  let db: FinanceDatabase;
  let repo: DexieRepository;

  beforeEach(async () => {
    db = new FinanceDatabase(`TestUndoCategoryDB_${Date.now()}_${Math.random()}`);
    repo = new DexieRepository(db);
  });

  describe('Undo Deletion Functionality', () => {
    it('restores a deleted transaction with exact original state', async () => {
      const tx = await repo.createTransaction({
        amount: 850,
        currency: 'INR',
        date: '2026-11-12T10:00:00.000Z',
        merchant: 'Cult.fit Gym',
        categoryId: 'cat_health',
        paymentMethod: 'upi',
        tags: ['fitness'],
        source: 'manual',
      });

      // Verify transaction exists
      expect(await repo.getTransaction(tx.id)).toBeDefined();

      // Delete
      await repo.deleteTransaction(tx.id);
      expect(await repo.getTransaction(tx.id)).toBeUndefined();

      // Undo Restore
      await repo.restoreTransaction(tx);
      const restored = await repo.getTransaction(tx.id);
      expect(restored).toBeDefined();
      expect(restored?.id).toBe(tx.id);
      expect(restored?.merchant).toBe('Cult.fit Gym');
      expect(restored?.amount).toBe(850);
      expect(restored?.tags).toEqual(['fitness']);
    });
  });

  describe('Category Management: Merge & Cascade Deletion', () => {
    const parentFood: Category = {
      id: 'cat_test_food',
      name: 'Food & Groceries',
      parentId: null,
      type: 'need',
      color: '#16587B',
      icon: 'Utensils',
    };

    const subDining: Category = {
      id: 'sub_test_dining',
      name: 'Dining Out',
      parentId: 'cat_test_food',
      type: 'want',
      color: '#C05621',
      icon: 'Coffee',
    };

    const parentDining: Category = {
      id: 'cat_test_dining',
      name: 'Standalone Dining',
      parentId: null,
      type: 'want',
      color: '#C05621',
      icon: 'UtensilsCrossed',
    };

    beforeEach(async () => {
      await repo.createCategory(parentFood);
      await repo.createCategory(subDining);
      await repo.createCategory(parentDining);
    });

    it('cascades category deletion to subcategories and reassigns transactions', async () => {
      // Create transaction under parentFood
      const tx = await repo.createTransaction({
        amount: 300,
        currency: 'INR',
        date: '2026-11-10T12:00:00.000Z',
        merchant: 'Local Dhaba',
        categoryId: 'cat_test_food',
        subcategoryId: 'sub_test_dining',
        paymentMethod: 'cash',
        tags: [],
        source: 'manual',
      });

      // Delete category with reassignment target
      await repo.deleteCategory('cat_test_food', 'cat_misc');

      // Parent category and its subcategory should be deleted
      expect(await repo.getCategory('cat_test_food')).toBeUndefined();
      expect(await repo.getCategory('sub_test_dining')).toBeUndefined();

      // Transaction category should be reassigned to target (cat_misc)
      const updatedTx = await repo.getTransaction(tx.id);
      expect(updatedTx?.categoryId).toBe('cat_misc');
      expect(updatedTx?.subcategoryId).toBeNull();
    });

    it('merges source category into target category and moves subcategories and transactions', async () => {
      // Transaction in source category
      const txSource = await repo.createTransaction({
        amount: 900,
        currency: 'INR',
        date: '2026-11-08T20:00:00.000Z',
        merchant: 'Bikanervala',
        categoryId: 'cat_test_food',
        paymentMethod: 'upi',
        tags: [],
        source: 'manual',
      });

      // Merge cat_test_food into cat_test_dining
      await repo.mergeCategories('cat_test_food', 'cat_test_dining');

      // Source should be removed
      expect(await repo.getCategory('cat_test_food')).toBeUndefined();
      // Target should remain
      expect(await repo.getCategory('cat_test_dining')).toBeDefined();

      // Transaction should be moved to target
      const movedTx = await repo.getTransaction(txSource.id);
      expect(movedTx?.categoryId).toBe('cat_test_dining');

      // Subcategories of source should be re-parented to target
      const sub = await repo.getCategory('sub_test_dining');
      expect(sub?.parentId).toBe('cat_test_dining');
    });

    it('clears subcategoryId reference on transactions and rules when deleting a subcategory', async () => {
      // Transaction using sub_test_dining
      const tx = await repo.createTransaction({
        amount: 500,
        currency: 'INR',
        date: '2026-11-10T12:00:00.000Z',
        merchant: 'Cafe Mocha',
        categoryId: 'cat_test_food',
        subcategoryId: 'sub_test_dining',
        paymentMethod: 'card',
        tags: [],
        source: 'manual',
      });

      // Rule using sub_test_dining
      const rule = await repo.createRule({
        matcher: { field: 'merchant', operator: 'exact', value: 'Cafe Mocha' },
        categoryId: 'cat_test_food',
        subcategoryId: 'sub_test_dining',
      });

      // Delete only the subcategory
      await repo.deleteCategory('sub_test_dining');

      // Subcategory should be deleted
      expect(await repo.getCategory('sub_test_dining')).toBeUndefined();
      // Parent category still exists
      expect(await repo.getCategory('cat_test_food')).toBeDefined();

      // Transaction's subcategoryId must be cleared to null, keeping its parent category
      const updatedTx = await repo.getTransaction(tx.id);
      expect(updatedTx?.categoryId).toBe('cat_test_food');
      expect(updatedTx?.subcategoryId).toBeNull();

      // Rule's subcategoryId must also be cleared to null
      const updatedRules = await repo.getRules();
      const updatedRule = updatedRules.find((r) => r.id === rule.id);
      expect(updatedRule?.categoryId).toBe('cat_test_food');
      expect(updatedRule?.subcategoryId).toBeNull();
    });
  });

  describe('Recurring Cadence & Due Date Calculations', () => {
    it('correctly advances due date across cadences without month overflow or leap year drift', () => {
      expect(advanceDueDate('2026-11-01', 'daily')).toBe('2026-11-02');
      expect(advanceDueDate('2026-11-01', 'weekly')).toBe('2026-11-08');
      expect(advanceDueDate('2026-11-01', 'biweekly')).toBe('2026-11-15');
      expect(advanceDueDate('2026-11-01', 'monthly')).toBe('2026-12-01');
      expect(advanceDueDate('2026-11-01', 'quarterly')).toBe('2027-02-01');
      expect(advanceDueDate('2026-11-01', 'yearly')).toBe('2027-11-01');

      // Month-boundary clamping (Jan 31 -> Feb 28 in non-leap year, not Mar 3)
      expect(advanceDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
      // Leap year clamping (Feb 29, 2024 -> Feb 28, 2025 in yearly)
      expect(advanceDueDate('2024-02-29', 'yearly')).toBe('2025-02-28');
    });

    it('auto-generates due recurring transactions up to current date', async () => {
      // Create monthly recurring expense template due on 2026-11-01
      const rec = await repo.createRecurring({
        template: {
          amount: 25000,
          currency: 'INR',
          merchant: 'Landlord Rent',
          categoryId: 'cat_housing',
          paymentMethod: 'net_banking',
          notes: 'November Flat Rent',
          tags: ['rent'],
        },
        cadence: 'monthly',
        nextDue: '2026-11-01',
        active: true,
      });

      // Run generation as of 2026-11-05
      const result = await generateDueRecurringTransactions(repo, '2026-11-05');

      expect(result.generatedCount).toBe(1);
      expect(result.generatedTransactions[0]?.merchant).toBe('Landlord Rent');
      expect(result.generatedTransactions[0]?.amount).toBe(25000);
      expect(result.generatedTransactions[0]?.recurringId).toBe(rec.id);
      expect(result.generatedTransactions[0]?.source).toBe('recurring');

      // Check that template's nextDue advanced to 2026-12-01
      const updatedRec = (await repo.getRecurring()).find((r) => r.id === rec.id);
      expect(updatedRec?.nextDue).toBe('2026-12-01');

      // Running generation again immediately should generate 0 additional transactions
      const secondRun = await generateDueRecurringTransactions(repo, '2026-11-05');
      expect(secondRun.generatedCount).toBe(0);
    });
  });
});
