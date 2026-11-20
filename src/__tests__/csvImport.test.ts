import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  detectColumnMapping,
  detectDuplicates,
  normalizePaymentMethod,
  parseDateString,
  parseAmount,
  PreparedImportTransaction,
} from '@/lib/csv';
import type { Transaction } from '@/types';

describe('CSV Import & Duplicate Detection Engine', () => {
  describe('parseCsv', () => {
    it('parses basic comma-separated rows', () => {
      const csv = `Date,Amount,Merchant\n2026-11-01,450,Swiggy\n2026-11-02,1200,Shell`;
      const result = parseCsv(csv);

      expect(result.headers).toEqual(['Date', 'Amount', 'Merchant']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual(['2026-11-01', '450', 'Swiggy']);
      expect(result.rows[1]).toEqual(['2026-11-02', '1200', 'Shell']);
    });

    it('correctly handles quoted fields with internal commas and escaped quotes', () => {
      const csv = `"Txn Date","Amount","Narration"\n"2026-11-05","1,450.50","Swiggy, Bangalore"\n"2026-11-06","200","Coffee with ""Friend"""`;
      const result = parseCsv(csv);

      expect(result.headers).toEqual(['Txn Date', 'Amount', 'Narration']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual(['2026-11-05', '1,450.50', 'Swiggy, Bangalore']);
      expect(result.rows[1]).toEqual(['2026-11-06', '200', 'Coffee with "Friend"']);
    });

    it('handles Windows CRLF line breaks and trailing newlines', () => {
      const csv = "Date,Amount,Merchant\r\n2026-11-01,100,Milk\r\n2026-11-02,200,Bread\r\n";
      const result = parseCsv(csv);

      expect(result.headers).toEqual(['Date', 'Amount', 'Merchant']);
      expect(result.rows).toHaveLength(2);
    });
  });

  describe('detectColumnMapping', () => {
    it('auto-detects standard bank export headers', () => {
      const headers = ['Txn Date', 'Withdrawal Amount', 'Narration', 'Payment Mode', 'Remarks'];
      const mapping = detectColumnMapping(headers);

      expect(mapping.date).toBe(0);
      expect(mapping.amount).toBe(1);
      expect(mapping.merchant).toBe(2);
      expect(mapping.paymentMethod).toBe(3);
      expect(mapping.notes).toBe(4);
    });

    it('auto-detects generic personal finance export headers', () => {
      const headers = ['date', 'amount', 'merchant', 'category'];
      const mapping = detectColumnMapping(headers);

      expect(mapping.date).toBe(0);
      expect(mapping.amount).toBe(1);
      expect(mapping.merchant).toBe(2);
      expect(mapping.category).toBe(3);
    });
  });

  describe('Value Parsing Helpers', () => {
    it('parses formatted amounts stripping currency symbols and commas', () => {
      expect(parseAmount('₹1,250.50')).toBe(1250.5);
      expect(parseAmount('$450')).toBe(450);
      expect(parseAmount('-500.00')).toBe(500);
      expect(parseAmount('invalid')).toBe(0);
    });

    it('normalizes dates from DD/MM/YYYY, DD-MM-YYYY, and ISO format', () => {
      expect(parseDateString('2026-11-10')).toBe('2026-11-10');
      expect(parseDateString('10/11/2026')).toBe('2026-11-10');
      expect(parseDateString('05-08-2026')).toBe('2026-08-05');
    });

    it('normalizes payment methods to union type', () => {
      expect(normalizePaymentMethod('UPI / GPay')).toBe('upi');
      expect(normalizePaymentMethod('Debit Card Pos')).toBe('card');
      expect(normalizePaymentMethod('NEFT NetBanking')).toBe('net_banking');
      expect(normalizePaymentMethod('Cash Withdrawal')).toBe('cash');
      expect(normalizePaymentMethod('Paytm Wallet')).toBe('wallet');
    });
  });

  describe('detectDuplicates', () => {
    const existingTransactions: Transaction[] = [
      {
        id: 'tx_existing_1',
        amount: 450,
        currency: 'INR',
        date: '2026-11-10T14:30:00.000Z',
        merchant: 'Swiggy',
        categoryId: 'cat_food_dining',
        paymentMethod: 'upi',
        tags: [],
        source: 'manual',
        createdAt: '2026-11-10T14:30:00.000Z',
        updatedAt: '2026-11-10T14:30:00.000Z',
      },
      {
        id: 'tx_existing_2',
        amount: 1200,
        currency: 'INR',
        date: '2026-11-05T08:00:00.000Z',
        merchant: 'Shell Petrol',
        categoryId: 'cat_transport',
        paymentMethod: 'card',
        tags: [],
        source: 'manual',
        createdAt: '2026-11-05T08:00:00.000Z',
        updatedAt: '2026-11-05T08:00:00.000Z',
      },
    ];

    it('detects duplicate on exact date and amount and merchant', () => {
      const incoming: PreparedImportTransaction[] = [
        {
          date: '2026-11-10',
          amount: 450,
          merchant: 'Swiggy',
          paymentMethod: 'upi',
          isDuplicate: false,
          selectedForImport: true,
        },
      ];

      const checked = detectDuplicates(incoming, existingTransactions);
      expect(checked[0]?.isDuplicate).toBe(true);
      expect(checked[0]?.duplicateOf?.id).toBe('tx_existing_1');
      expect(checked[0]?.selectedForImport).toBe(false); // skipped by default
    });

    it('detects duplicate within +/- 1 day window with substring merchant match', () => {
      // 1 day after existing transaction
      const incoming: PreparedImportTransaction[] = [
        {
          date: '2026-11-11',
          amount: 450,
          merchant: 'Swiggy Bangalore Order',
          paymentMethod: 'upi',
          isDuplicate: false,
          selectedForImport: true,
        },
      ];

      const checked = detectDuplicates(incoming, existingTransactions);
      expect(checked[0]?.isDuplicate).toBe(true);
      expect(checked[0]?.duplicateOf?.id).toBe('tx_existing_1');
    });

    it('detects duplicate across calendar day boundary even when timestamps differ by >24 hours', () => {
      // Existing is Nov 10 at 01:00 AM, incoming is Nov 11 at 23:00 PM (46 hours apart, exactly +1 calendar day)
      const lateIncoming: PreparedImportTransaction[] = [
        {
          date: '2026-11-11T23:00:00.000Z',
          amount: 450,
          merchant: 'Swiggy',
          paymentMethod: 'upi',
          isDuplicate: false,
          selectedForImport: true,
        },
      ];

      const checked = detectDuplicates(lateIncoming, [
        {
          id: 'tx_early_morning',
          amount: 450,
          currency: 'INR',
          date: '2026-11-10T01:00:00.000Z',
          merchant: 'Swiggy',
          categoryId: 'cat_food_dining',
          paymentMethod: 'upi',
          tags: [],
          source: 'manual',
          createdAt: '2026-11-10T01:00:00.000Z',
          updatedAt: '2026-11-10T01:00:00.000Z',
        },
      ]);
      expect(checked[0]?.isDuplicate).toBe(true);
      expect(checked[0]?.duplicateOf?.id).toBe('tx_early_morning');
    });

    it('does not flag as duplicate if amount differs', () => {
      const incoming: PreparedImportTransaction[] = [
        {
          date: '2026-11-10',
          amount: 460, // different amount
          merchant: 'Swiggy',
          paymentMethod: 'upi',
          isDuplicate: false,
          selectedForImport: true,
        },
      ];

      const checked = detectDuplicates(incoming, existingTransactions);
      expect(checked[0]?.isDuplicate).toBe(false);
      expect(checked[0]?.selectedForImport).toBe(true);
    });

    it('does not flag as duplicate if date is more than 1 day apart', () => {
      const incoming: PreparedImportTransaction[] = [
        {
          date: '2026-11-14', // 4 days later
          amount: 450,
          merchant: 'Swiggy',
          paymentMethod: 'upi',
          isDuplicate: false,
          selectedForImport: true,
        },
      ];

      const checked = detectDuplicates(incoming, existingTransactions);
      expect(checked[0]?.isDuplicate).toBe(false);
      expect(checked[0]?.selectedForImport).toBe(true);
    });
  });
});

describe('Statement direction and currency', () => {
  it('reads DR and CR indicators and preserves original dates and currencies', async () => {
    const { parseStatementCsv } = await import('@/lib/csv/statement');
    const result = parseStatementCsv([
      'Txn Date,Narration,Amount,Currency',
      '13/11/2026,Salary,50000 CR,INR',
      '14/11/2026,Store,250.40 DR,INR',
      '15/11/2026,Foreign store,10 DR,USD',
    ].join('\n'));
    expect(result?.rows).toMatchObject([
      { date: '2026-11-13', amount: 50000, direction: 'credit', currency: 'INR' },
      { date: '2026-11-14', amount: 250.4, direction: 'debit', currency: 'INR' },
      { date: '2026-11-15', amount: 10, direction: 'debit', currency: 'USD' },
    ]);
  });

  it('detects the inverted sign convention of card exports using the repayment row', async () => {
    const { parseStatementCsv } = await import('@/lib/csv/statement');
    const result = parseStatementCsv([
      'Date,Description,Amount',
      '2026-11-01,Store,500',
      '2026-11-02,Payment Thank You,-500',
    ].join('\n'));
    expect(result?.rows.map(({ direction, accountKind }) => [direction, accountKind]))
      .toEqual([['debit', 'card'], ['credit', 'card']]);
  });

  it('keeps conflicting columns and unknown sign and date conventions out of automatic import', async () => {
    const { parseStatementCsv } = await import('@/lib/csv/statement');
    const dual = parseStatementCsv('Date,Description,Debit,Credit\n2026-11-04,Unclear,100,100');
    expect(dual?.rows[0]).toMatchObject({ direction: 'unknown' });
    const signed = parseStatementCsv('Date,Description,Amount,Balance\n01/02/2026,One,100,100\n02/02/2026,Two,-25,75');
    expect(signed?.rows.map(({ date, direction }) => [date, direction]))
      .toEqual([['', 'unknown'], ['', 'unknown']]);
  });
});
