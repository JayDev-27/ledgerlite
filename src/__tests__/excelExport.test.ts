import { describe, it, expect } from 'vitest';
import { createReportWorkbook, exportReportToExcel } from '@/lib/export/excelExport';
import { computePeriodPack } from '@/lib/reports/periodPack';
import { generateTemplateReport } from '@/lib/reports/templateGenerator';
import { DEFAULT_CATEGORIES } from '@/data/categories';
import { Transaction, Budget, RecurringExpense } from '@/types';
import { PeriodRange } from '@/lib/periods/types';

describe('ExcelJS Multi-Sheet Report Export Engine', () => {
  const periodRange: PeriodRange = {
    type: 'month',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    label: 'November 2026',
    shortLabel: 'Nov 2026',
  };

  const sampleTransactions: Transaction[] = [
    {
      id: 'tx_1',
      amount: 30000,
      currency: 'INR',
      date: '2026-11-01',
      merchant: 'Lodha Group',
      categoryId: 'cat_housing',
      subcategoryId: 'sub_rent',
      paymentMethod: 'net_banking',
      tags: ['rent'],
      source: 'recurring',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'tx_2',
      amount: 5200,
      currency: 'INR',
      date: '2026-11-05',
      merchant: 'Blinkit',
      categoryId: 'cat_groceries',
      subcategoryId: 'sub_supermarket',
      paymentMethod: 'upi',
      tags: ['groceries'],
      source: 'quick_add',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'tx_3',
      amount: 2400,
      currency: 'INR',
      date: '2026-11-12',
      merchant: 'Smoke House Deli',
      categoryId: 'cat_food_dining',
      subcategoryId: 'sub_restaurant',
      paymentMethod: 'card',
      tags: ['dining'],
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    },
  ];

  const sampleBudget: Budget = {
    id: 'b_1',
    month: '2026-11',
    totalLimit: 50000,
    categoryLimits: {
      cat_housing: 32000,
      cat_groceries: 10000,
      cat_food_dining: 6000,
    },
    rollover: false,
  };

  const sampleRecurring: RecurringExpense[] = [
    {
      id: 'rec_1',
      template: {
        merchant: 'Lodha Group',
        amount: 30000,
        currency: 'INR',
        categoryId: 'cat_housing',
        paymentMethod: 'net_banking',
      },
      cadence: 'monthly',
      nextDue: '2026-12-01',
      active: true,
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('creates workbook with all 7 mandatory sheets', async () => {
    const pack = computePeriodPack({
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      budgets: [sampleBudget],
      recurring: sampleRecurring,
      periodRange,
    });
    const reportContent = generateTemplateReport(pack);

    const workbook = await createReportWorkbook({
      pack,
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      recurring: sampleRecurring,
      reportContent,
    });

    const sheetNames = workbook.worksheets.map((s) => s.name);
    expect(sheetNames).toEqual([
      'Summary',
      'Transactions',
      'By Category',
      'By Month',
      'Budget vs Actual',
      'Recurring',
      'Charts',
    ]);
  });

  it('writes real Excel formulas AND cached results in formula cells', async () => {
    const pack = computePeriodPack({
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      budgets: [sampleBudget],
      recurring: sampleRecurring,
      periodRange,
    });
    const reportContent = generateTemplateReport(pack);

    const workbook = await createReportWorkbook({
      pack,
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      recurring: sampleRecurring,
      reportContent,
    });

    // Check Summary sheet formula cell
    const summarySheet = workbook.getWorksheet('Summary')!;
    const splitTotalCell = summarySheet.getCell('B17');
    expect(typeof splitTotalCell.value).toBe('object');
    const cellVal = splitTotalCell.value as { formula: string; result: number };
    expect(cellVal.formula).toBe('SUM(B14:B16)');
    expect(cellVal.result).toBe(37600); // 30000 + 5200 + 2400

    // Check Summary sheet Budget section
    expect(String(summarySheet.getCell('A19').value)).toContain('Budget');
    expect(summarySheet.getCell('B21').value).toBe(50000);
    const budgetVarianceCell = summarySheet.getCell('D21').value as { formula: string; result: number };
    expect(budgetVarianceCell.formula).toBe('B21-C21');

    // Check Transactions sheet total & average formula cells
    const txSheet = workbook.getWorksheet('Transactions')!;
    const txTotalCell = txSheet.getCell('F5'); // Row 5 is total row for 3 transactions (header row 1, rows 2,3,4)
    expect(typeof txTotalCell.value).toBe('object');
    const txVal = txTotalCell.value as { formula: string; result: number };
    expect(txVal.formula).toBe('SUM(F2:F4)');
    expect(txVal.result).toBe(37600);

    const txAvgCell = txSheet.getCell('F6'); // Row 6 is average row
    expect(typeof txAvgCell.value).toBe('object');
    const txAvgVal = txAvgCell.value as { formula: string; result: number };
    expect(txAvgVal.formula).toBe('AVERAGE(F2:F4)');
    expect(txAvgVal.result).toBeCloseTo(37600 / 3, 2);

    // Check By Category formulas
    const catSheet = workbook.getWorksheet('By Category')!;
    const catPctCell = catSheet.getCell('D2').value as { formula: string; result: number };
    expect(catPctCell.formula).toContain('IF($C$5>0, C2/$C$5, 0)');

    // Check By Month formulas
    const monthSheet = workbook.getWorksheet('By Month')!;
    const monthTotalCell = monthSheet.getCell('C3').value as { formula: string; result: number };
    expect(monthTotalCell.formula).toBe('SUM(C2:C2)');
    const monthAvgCell = monthSheet.getCell('C4').value as { formula: string; result: number };
    expect(monthAvgCell.formula).toBe('AVERAGE(C2:C2)');

    // Check Budget vs Actual formulas
    const budgetSheet = workbook.getWorksheet('Budget vs Actual')!;
    const varianceCell = budgetSheet.getCell('D2');
    expect(typeof varianceCell.value).toBe('object');
    const varVal = varianceCell.value as { formula: string; result: number };
    expect(varVal.formula).toBe('B2-C2');
  });

  it('applies Deep Blue styling and freezes header rows', async () => {
    const pack = computePeriodPack({
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      periodRange,
    });

    const workbook = await createReportWorkbook({
      pack,
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
    });

    const txSheet = workbook.getWorksheet('Transactions')!;
    const headerRow = txSheet.getRow(1);
    const cellA1 = headerRow.getCell(1);

    // Check Deep Blue Fill (FF16587B)
    expect(cellA1.fill).toBeDefined();
    const fill = cellA1.fill as { fgColor?: { argb?: string } };
    expect(fill.fgColor?.argb).toBe('FF16587B');

    // Check Frozen Headers
    expect(txSheet.views).toBeDefined();
    expect(txSheet.views[0]?.state).toBe('frozen');
    const frozenView = txSheet.views[0] as { ySplit?: number } | undefined;
    expect(frozenView?.ySplit).toBe(1);
  });

  it('includes explanatory note on Charts sheet regarding raster embedding', async () => {
    const pack = computePeriodPack({
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      periodRange,
    });

    const workbook = await createReportWorkbook({
      pack,
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
    });

    const chartsSheet = workbook.getWorksheet('Charts')!;
    const noteCell = chartsSheet.getCell('B3');
    expect(String(noteCell.value)).toContain('OpenXML');
    expect(String(noteCell.value)).toContain('raster');
  });

  it('writes binary buffer without error', async () => {
    const pack = computePeriodPack({
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      periodRange,
    });

    const buffer = await exportReportToExcel({
      pack,
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
    });

    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(500);
  });
});
