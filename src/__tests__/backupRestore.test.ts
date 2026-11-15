import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { FinanceDatabase } from '@/data/db';
import { DexieRepository } from '@/data/repository/DexieRepository';
import { validateBackupPayload } from '@/lib/backup/backupService';
import { seedDatabase } from '@/data/seed';

describe('Backup & Restore System (All 9 Dexie Tables)', () => {
  let db: FinanceDatabase;
  let repo: DexieRepository;

  beforeEach(async () => {
    db = new FinanceDatabase(`TestBackupDb_${Date.now()}_${Math.random()}`);
    await db.open();
    repo = new DexieRepository(db);
  });

  it('exports all 9 Dexie tables in backup export', async () => {
    // Seed database
    await seedDatabase(repo, false);

    // Save a report into reports table
    await repo.saveReport({
      id: 'rep_test',
      period: 'month_2026-11',
      spec: {
        title: 'Test Report',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        totalSpend: 50000,
        categoryBreakdown: {},
      },
      createdAt: new Date().toISOString(),
    });

    const backup = await repo.exportAll();

    expect(backup['version']).toBe(1);
    expect(backup['exportedAt']).toBeDefined();

    // Verify all 9 Dexie tables exist as arrays
    expect(Array.isArray(backup['transactions'])).toBe(true);
    expect(Array.isArray(backup['categories'])).toBe(true);
    expect(Array.isArray(backup['budgets'])).toBe(true);
    expect(Array.isArray(backup['rules'])).toBe(true);
    expect(Array.isArray(backup['recurring'])).toBe(true);
    expect(Array.isArray(backup['memory'])).toBe(true);
    expect(Array.isArray(backup['reports'])).toBe(true);
    expect(Array.isArray(backup['aiUsage'])).toBe(true);
    expect(Array.isArray(backup['settings'])).toBe(true);

    expect((backup['transactions'] as unknown[]).length).toBeGreaterThan(0);
    expect((backup['categories'] as unknown[]).length).toBeGreaterThan(0);
    expect((backup['reports'] as unknown[]).length).toBe(1);
  });

  it('rejects corrupt or malformed backups during pre-validation', () => {
    // Null or non-object
    expect(validateBackupPayload(null).valid).toBe(false);
    expect(validateBackupPayload('string').valid).toBe(false);

    // Missing categories
    expect(validateBackupPayload({ transactions: [] }).valid).toBe(false);

    // Missing transactions
    expect(validateBackupPayload({ categories: [] }).valid).toBe(false);

    // Corrupt category item
    const badCategory = {
      categories: [{ id: 123, invalid: true }],
      transactions: [],
    };
    expect(validateBackupPayload(badCategory).valid).toBe(false);

    // Corrupt transaction item
    const badTx = {
      categories: [{ id: 'cat_1', name: 'Housing', type: 'need' }],
      transactions: [{ id: 'tx_1', amount: 'not_a_number', date: '2026-11-01', categoryId: 'cat_1' }],
    };
    expect(validateBackupPayload(badTx).valid).toBe(false);
  });

  it('accepts valid backup payload and returns summary counts', () => {
    const validData = {
      version: 1,
      appName: 'LedgerLite',
      exportedAt: new Date().toISOString(),
      categories: [
        { id: 'cat_1', name: 'Housing', type: 'need', color: '#16587B', icon: 'Home' },
      ],
      transactions: [
        {
          id: 'tx_1',
          amount: 25000,
          currency: 'INR',
          date: '2026-11-01',
          merchant: 'Landlord',
          categoryId: 'cat_1',
          paymentMethod: 'net_banking',
          tags: [],
          source: 'manual',
          createdAt: '',
          updatedAt: '',
        },
      ],
      budgets: [],
      rules: [],
      recurring: [],
      memory: [],
      reports: [],
      aiUsage: [],
      settings: [],
    };

    const result = validateBackupPayload(validData);
    expect(result.valid).toBe(true);
    expect(result.summary?.categoriesCount).toBe(1);
    expect(result.summary?.transactionsCount).toBe(1);
  });

  it('restores full backup atomically into database', async () => {
    const validData = {
      version: 1,
      appName: 'LedgerLite',
      exportedAt: new Date().toISOString(),
      categories: [
        { id: 'cat_test_restore', name: 'Restored Category', type: 'need', color: '#16587B', icon: 'Home' },
      ],
      transactions: [
        {
          id: 'tx_restored_1',
          amount: 12500,
          currency: 'INR',
          date: '2026-11-02',
          merchant: 'Restored Merchant',
          categoryId: 'cat_test_restore',
          paymentMethod: 'card',
          tags: ['restored'],
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      budgets: [
        {
          id: 'b_restored',
          month: '2026-11',
          totalLimit: 50000,
          categoryLimits: { cat_test_restore: 20000 },
          rollover: false,
        },
      ],
      rules: [],
      recurring: [],
      memory: [],
      reports: [
        {
          id: 'rep_restored',
          period: 'month_2026-11',
          spec: {
            title: 'Restored Report',
            startDate: '2026-11-01',
            endDate: '2026-11-30',
            totalSpend: 12500,
            categoryBreakdown: {},
          },
          createdAt: new Date().toISOString(),
        },
      ],
      aiUsage: [],
      settings: [{ key: 'theme', value: 'dark' }],
    };

    await repo.importAll(validData);

    const txs = await repo.getTransactions();
    expect(txs.total).toBe(1);
    expect(txs.data[0]?.merchant).toBe('Restored Merchant');

    const cats = await repo.getCategories();
    expect(cats.length).toBe(1);
    expect(cats[0]?.name).toBe('Restored Category');

    const reports = await repo.getReports();
    expect(reports.length).toBe(1);
    expect(reports[0]?.id).toBe('rep_restored');

    const settingTheme = await repo.getSetting('theme');
    expect(settingTheme).toBe('dark');
  });

  it('retrieves YYYY-MM-DD formatted transactions on exact startDate and endDate', async () => {
    // Add transactions with date format YYYY-MM-DD
    await repo.createCategory({ id: 'cat_test_date', name: 'Test Date', type: 'need', color: '#16587B', icon: 'Tag' });
    await repo.createTransaction({
      id: 'tx_start_day',
      amount: 1000,
      currency: 'INR',
      date: '2026-11-01', // Date string without time
      merchant: 'Day One Vendor',
      categoryId: 'cat_test_date',
      paymentMethod: 'upi',
      tags: [],
      source: 'manual',
    });
    await repo.createTransaction({
      id: 'tx_mid_day',
      amount: 2000,
      currency: 'INR',
      date: '2026-11-15T10:00:00.000Z',
      merchant: 'Mid Month Vendor',
      categoryId: 'cat_test_date',
      paymentMethod: 'card',
      tags: [],
      source: 'manual',
    });
    await repo.createTransaction({
      id: 'tx_end_day',
      amount: 3000,
      currency: 'INR',
      date: '2026-11-30', // End day without time
      merchant: 'End Day Vendor',
      categoryId: 'cat_test_date',
      paymentMethod: 'cash',
      tags: [],
      source: 'manual',
    });

    const txs = await repo.getTransactionsByDateRange('2026-11-01', '2026-11-30');
    expect(txs.length).toBe(3);
    expect(txs.map((t) => t.id)).toContain('tx_start_day');
    expect(txs.map((t) => t.id)).toContain('tx_mid_day');
    expect(txs.map((t) => t.id)).toContain('tx_end_day');
  });
});
