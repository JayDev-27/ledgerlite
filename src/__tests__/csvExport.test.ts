import { describe, it, expect } from 'vitest';
import { generateTransactionsCsv, escapeCsvField } from '@/lib/export/csvExport';
import { Transaction } from '@/types';
import { DEFAULT_CATEGORIES } from '@/data/categories';

describe('CSV Export Engine (RFC 4180 Compliance)', () => {
  it('escapes fields with commas, double quotes, and newlines per RFC 4180', () => {
    expect(escapeCsvField('Hello, world')).toBe('"Hello, world"');
    expect(escapeCsvField('Quote "test"')).toBe('"Quote ""test"""');
    expect(escapeCsvField('Multi\nline')).toBe('"Multi\nline"');
    expect(escapeCsvField('Simple text')).toBe('Simple text');
    expect(escapeCsvField(1234.5)).toBe('1234.5');
    expect(escapeCsvField(-50.25)).toBe('-50.25');
    expect(escapeCsvField(0)).toBe('0');
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('mitigates CSV formula injection attacks by prepending single quote', () => {
    expect(escapeCsvField('=SUM(A1:A10)')).toBe(`'=SUM(A1:A10)`);
    expect(escapeCsvField('+12345')).toBe(`'+12345`);
    expect(escapeCsvField('-cmd|...')).toBe(`'-cmd|...`);
    expect(escapeCsvField('@special')).toBe(`'@special`);
  });

  it('generates full CSV with UTF-8 BOM and correct transaction headers', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_1',
        amount: 1500,
        currency: 'INR',
        date: '2026-11-10',
        merchant: 'Blue Tokai Coffee, Roasters', // Contains comma
        categoryId: 'cat_food_dining',
        subcategoryId: 'sub_cafes',
        paymentMethod: 'upi',
        notes: 'Coffee & "croissant" breakfast', // Contains quotes
        tags: ['breakfast', 'weekend'],
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const csv = generateTransactionsCsv(transactions, DEFAULT_CATEGORIES);

    // Verify UTF-8 BOM
    expect(csv.startsWith('\uFEFF')).toBe(true);

    const lines = csv.replace('\uFEFF', '').split('\r\n');
    expect(lines.length).toBe(2); // Header + 1 row

    // Verify Header
    expect(lines[0]).toBe('Date,Merchant,Category,Subcategory,Payment Method,Amount,Currency,Notes,Tags,Recurring,Source');

    // Verify Data Row escaping
    const row = lines[1]!;
    expect(row).toContain('"Blue Tokai Coffee, Roasters"');
    expect(row).toContain('"Coffee & ""croissant"" breakfast"');
    expect(row).toContain('breakfast; weekend');
    expect(row).toContain('Food & Dining');
  });

  it('handles empty transaction list with header only', () => {
    const csv = generateTransactionsCsv([], DEFAULT_CATEGORIES);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.replace('\uFEFF', '').split('\r\n');
    expect(lines.length).toBe(1);
  });
});
