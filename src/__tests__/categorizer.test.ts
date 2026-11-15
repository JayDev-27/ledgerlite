import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { FinanceDatabase } from '@/data/db';
import { DexieRepository } from '@/data/repository/DexieRepository';
import {
  matchMerchantDictionary,
  classifyTransaction,
  batchClassifyTransactions,
} from '@/lib/categorizer';

describe('Categorisation Pipeline & 3-Tier Precedence', () => {
  let db: FinanceDatabase;
  let repo: DexieRepository;

  beforeEach(async () => {
    db = new FinanceDatabase(`TestCategorizerDB_${Date.now()}_${Math.random()}`);
    repo = new DexieRepository(db);
  });

  describe('Tier 2: Built-in Merchant Dictionary', () => {
    it('matches common Indian food delivery & dining merchants', () => {
      const swiggy = matchMerchantDictionary('Swiggy Instamart Order');
      expect(swiggy).toBeDefined();
      expect(swiggy?.categoryId).toBe('cat_food_dining');

      const zomato = matchMerchantDictionary('ZOMATO LIMITED');
      expect(zomato).toBeDefined();
      expect(zomato?.categoryId).toBe('cat_food_dining');

      const starbucks = matchMerchantDictionary('Starbucks Coffee');
      expect(starbucks?.categoryId).toBe('cat_food_dining');
      expect(starbucks?.subcategoryId).toBe('sub_cafes');
    });

    it('matches grocery and quick commerce merchants', () => {
      const blinkit = matchMerchantDictionary('Blinkit Commerce');
      expect(blinkit?.categoryId).toBe('cat_groceries');

      const zepto = matchMerchantDictionary('Zepto Quick');
      expect(zepto?.categoryId).toBe('cat_groceries');

      const dmart = matchMerchantDictionary('DMART AVENUE SUPERMARTS');
      expect(dmart?.categoryId).toBe('cat_groceries');
    });

    it('matches transport, utilities, subscriptions, and investments', () => {
      expect(matchMerchantDictionary('Uber India')?.categoryId).toBe('cat_transport');
      expect(matchMerchantDictionary('Shell Petrol Pump')?.categoryId).toBe('cat_transport');
      expect(matchMerchantDictionary('BESCOM ELECTRICITY')?.categoryId).toBe('cat_utilities');
      expect(matchMerchantDictionary('Netflix India')?.categoryId).toBe('cat_subscriptions');
      expect(matchMerchantDictionary('Zerodha Broking')?.categoryId).toBe('cat_investments');
      expect(matchMerchantDictionary('Apollo Pharmacy Bangalore')?.categoryId).toBe('cat_health');
    });

    it('returns undefined for unknown merchants and short queries without false positive matches', () => {
      expect(matchMerchantDictionary('Random Unknown Merchant 12345')).toBeUndefined();
      // Probe Bug 1 edge cases: single letters or short subwords must NOT trigger false matches
      expect(matchMerchantDictionary('c')).toBeUndefined();
      expect(matchMerchantDictionary('in')).toBeUndefined();
      expect(matchMerchantDictionary('a')).toBeUndefined();
      expect(matchMerchantDictionary('')).toBeUndefined();
    });
  });

  describe('Category Normalization', () => {
    it('normalizes arbitrary AI category variants to valid category IDs', async () => {
      const { normalizeCategoryId } = await import('@/lib/categorizer');

      expect(normalizeCategoryId('food_and_dining')).toEqual({
        categoryId: 'cat_food_dining',
        subcategoryId: null,
      });
      expect(normalizeCategoryId('Food & Dining')).toEqual({
        categoryId: 'cat_food_dining',
        subcategoryId: null,
      });
      expect(normalizeCategoryId('groceries')).toEqual({
        categoryId: 'cat_groceries',
        subcategoryId: null,
      });
      expect(normalizeCategoryId('sub_delivery')).toEqual({
        categoryId: 'cat_food_dining',
        subcategoryId: 'sub_delivery',
      });
      expect(normalizeCategoryId('completely_unknown_category')).toEqual({
        categoryId: 'cat_misc',
        subcategoryId: null,
      });
    });
  });

  describe('Tier 1 Precedence: Learned Rules Override Dictionary and AI', () => {
    it('prioritizes learned rule over built-in dictionary match', async () => {
      // By dictionary, 'Swiggy' belongs to 'cat_food_dining'
      const dictMatch = matchMerchantDictionary('Swiggy');
      expect(dictMatch?.categoryId).toBe('cat_food_dining');

      // User creates a rule: classify Swiggy as Business / Miscellaneous
      await repo.createRule({
        matcher: {
          field: 'merchant',
          operator: 'contains',
          value: 'Swiggy',
        },
        categoryId: 'cat_misc',
        subcategoryId: 'sub_general',
      });

      // Pipeline execution
      const result = await classifyTransaction(repo, {
        merchant: 'Swiggy Bangalore',
        amount: 450,
      });

      // Rule must win!
      expect(result.source).toBe('rule');
      expect(result.categoryId).toBe('cat_misc');
      expect(result.confidence).toBe(1.0);
    });

    it('falls back to dictionary when no rule exists', async () => {
      const result = await classifyTransaction(repo, {
        merchant: 'Uber Rides',
        amount: 320,
      });

      expect(result.source).toBe('dictionary');
      expect(result.categoryId).toBe('cat_transport');
      expect(result.confidence).toBe(0.95);
    });

    it('falls back to default when neither rule nor dictionary match exists without AI', async () => {
      const result = await classifyTransaction(
        repo,
        {
          merchant: 'Unknown Mystery Corner Store',
          amount: 50,
        },
        { useAi: false }
      );

      expect(result.source).toBe('fallback');
      expect(result.categoryId).toBe('cat_misc');
      expect(result.confidence).toBe(0.3);
    });
  });

  describe('Batch Classification Pipeline', () => {
    it('correctly processes mixed batch with rules, dictionary, and fallbacks', async () => {
      // Add one rule
      await repo.createRule({
        matcher: { field: 'merchant', operator: 'exact', value: 'Special Cafe' },
        categoryId: 'cat_food_dining',
        subcategoryId: 'sub_cafes',
      });

      const inputs = [
        { merchant: 'Special Cafe' }, // Tier 1: Rule
        { merchant: 'Netflix' }, // Tier 2: Dictionary
        { merchant: 'Zepto' }, // Tier 2: Dictionary
        { merchant: 'Unrecognized Random Place' }, // Tier 4: Fallback
        { merchant: '' }, // Empty -> fallback
      ];

      const results = await batchClassifyTransactions(repo, inputs, { useAi: false });

      expect(results).toHaveLength(5);
      expect(results[0]?.source).toBe('rule');
      expect(results[0]?.categoryId).toBe('cat_food_dining');

      expect(results[1]?.source).toBe('dictionary');
      expect(results[1]?.categoryId).toBe('cat_subscriptions');

      expect(results[2]?.source).toBe('dictionary');
      expect(results[2]?.categoryId).toBe('cat_groceries');

      expect(results[3]?.source).toBe('fallback');
      expect(results[3]?.confidence).toBeLessThan(0.7); // Routed to review queue

      expect(results[4]?.source).toBe('fallback');
    });
  });
});
