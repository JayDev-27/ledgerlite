import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { FinanceDatabase } from '@/data/db';
import { DexieRepository } from '@/data/repository/DexieRepository';
import { seedDatabase } from '@/data/seed';

describe('DexieRepository with IndexedDB', () => {
  let db: FinanceDatabase;
  let repo: DexieRepository;

  beforeEach(() => {
    // Unique in-memory test database for each test run
    db = new FinanceDatabase(`test_db_${Date.now()}_${Math.random()}`);
    repo = new DexieRepository(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('detects empty database initially and seeds all entities', async () => {
    const emptyBefore = await repo.isDatabaseEmpty();
    expect(emptyBefore).toBe(true);

    const result = await seedDatabase(repo, false);
    expect(result.categoriesCount).toBe(70); // 18 root + 52 subcategories
    expect(result.transactionsCount).toBeGreaterThan(600);
    expect(result.budgetsCount).toBe(7);
    expect(result.rulesCount).toBeGreaterThanOrEqual(10);
    expect(result.recurringCount).toBeGreaterThanOrEqual(8);
    expect(result.memoryCount).toBeGreaterThanOrEqual(5);

    const emptyAfter = await repo.isDatabaseEmpty();
    expect(emptyAfter).toBe(false);
  });

  it('queries transactions using fast-path indexed queries and pagination', async () => {
    await seedDatabase(repo, false);

    const page1 = await repo.getTransactions(undefined, {
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortDirection: 'desc',
    });

    expect(page1.data.length).toBe(20);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(20);
    expect(page1.total).toBeGreaterThan(600);
    expect(page1.totalPages).toBe(Math.ceil(page1.total / 20));

    // Verify descending sort by date
    const t0 = new Date(page1.data[0]!.date).getTime();
    const t1 = new Date(page1.data[1]!.date).getTime();
    expect(t0).toBeGreaterThanOrEqual(t1);

    // Page 2
    const page2 = await repo.getTransactions(undefined, {
      page: 2,
      pageSize: 20,
      sortBy: 'date',
      sortDirection: 'desc',
    });
    expect(page2.data.length).toBe(20);
    expect(page2.data[0]!.id).not.toBe(page1.data[0]!.id);
  });

  it('filters transactions by date range, payment method, and search keyword', async () => {
    await seedDatabase(repo, false);

    // Date range filter
    const octTxs = await repo.getTransactions({
      startDate: '2026-10-01',
      endDate: '2026-10-31T23:59:59',
    });
    expect(octTxs.data.length).toBeGreaterThan(0);
    for (const tx of octTxs.data) {
      expect(tx.date >= '2026-10-01').toBe(true);
      expect(tx.date <= '2026-10-31T23:59:59').toBe(true);
    }

    // Payment method filter
    const upiTxs = await repo.getTransactions({
      paymentMethods: ['upi'],
    });
    expect(upiTxs.data.length).toBeGreaterThan(0);
    for (const tx of upiTxs.data) {
      expect(tx.paymentMethod).toBe('upi');
    }

    // Search query
    const searchResult = await repo.getTransactions({
      search: 'zomato',
    });
    expect(searchResult.data.length).toBeGreaterThan(0);
    for (const tx of searchResult.data) {
      expect(tx.merchant.toLowerCase()).toContain('zomato');
    }
  });

  it('matches learned merchant rules with exact, contains, and regex operators', async () => {
    await repo.createRule({
      matcher: { field: 'merchant', operator: 'contains', value: 'zepto' },
      categoryId: 'cat_groceries',
      subcategoryId: 'sub_supermarket',
    });

    await repo.createRule({
      matcher: { field: 'merchant', operator: 'startsWith', value: 'uber' },
      categoryId: 'cat_transport',
      subcategoryId: 'sub_cabs',
    });

    await repo.createRule({
      matcher: { field: 'merchant', operator: 'regex', value: '^swiggy.*' },
      categoryId: 'cat_food_dining',
      subcategoryId: 'sub_delivery',
    });

    const m1 = await repo.findMatchingRule('Zepto Instant Grocery');
    expect(m1).toBeDefined();
    expect(m1?.categoryId).toBe('cat_groceries');

    const m2 = await repo.findMatchingRule('Uber Premier Ride');
    expect(m2).toBeDefined();
    expect(m2?.categoryId).toBe('cat_transport');

    const m3 = await repo.findMatchingRule('Swiggy Instamart Order');
    expect(m3).toBeDefined();
    expect(m3?.categoryId).toBe('cat_food_dining');

    const mNone = await repo.findMatchingRule('Completely Unrelated Shop');
    expect(mNone).toBeUndefined();
  });

  it('safely handles importAll and rejects malformed backups without data loss', async () => {
    await seedDatabase(repo, false);
    const initialCount = await repo.countTransactions();
    expect(initialCount).toBeGreaterThan(0);

    // Attempt to import invalid data
    await expect(repo.importAll({} as Record<string, unknown>)).rejects.toThrow(
      'Invalid backup file: missing categories or transactions arrays'
    );

    // Confirm existing data was NOT wiped
    const countAfterFailedImport = await repo.countTransactions();
    expect(countAfterFailedImport).toBe(initialCount);

    // Valid export and restore
    const backup = await repo.exportAll();
    expect(backup.version).toBe(1);
    expect(Array.isArray(backup.transactions)).toBe(true);

    await repo.importAll(backup);
    const restoredCount = await repo.countTransactions();
    expect(restoredCount).toBe(initialCount);
  });
});
