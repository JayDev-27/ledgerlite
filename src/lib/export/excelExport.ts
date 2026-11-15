import ExcelJS from 'exceljs';
import { Transaction, Category, RecurringExpense } from '@/types';
import { PeriodPack, ReportContent } from '@/lib/reports/types';

export interface ExcelExportOptions {
  pack: PeriodPack;
  transactions: Transaction[];
  categories?: Category[];
  recurring?: RecurringExpense[];
  reportContent?: ReportContent;
  chartImageBase64?: string; // Optional embedded PNG image for Sheet 7
}

const DEEP_BLUE_ARGB = 'FF16587B';
const CREAM_ACCENT_ARGB = 'FFF5EEDD';
const CURRENCY_FMT = '"₹"#,##0.00;[Red]-"₹"#,##0.00;"₹"0.00';
const PERCENT_FMT = '0.0%';
const INT_FMT = '#,##0';

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.height = 24;
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: DEEP_BLUE_ARGB },
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF0B2433' } },
    };
  });
}

function applyTotalRowStyle(row: ExcelJS.Row): void {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: CREAM_ACCENT_ARGB },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: DEEP_BLUE_ARGB } },
      bottom: { style: 'double', color: { argb: DEEP_BLUE_ARGB } },
    };
  });
}

function autoFitColumns(sheet: ExcelJS.Worksheet, minWidth = 12, maxWidth = 45): void {
  sheet.columns.forEach((column) => {
    let maxLen = minWidth;
    if (column.eachCell) {
      column.eachCell({ includeEmpty: false }, (cell) => {
        const val = cell.value;
        let str = '';
        if (typeof val === 'object' && val !== null && 'result' in val) {
          str = String((val as { result: unknown }).result || '');
        } else if (typeof val === 'object' && val !== null && 'richText' in val) {
          str = 'Text';
        } else if (val !== null && val !== undefined) {
          str = String(val);
        }
        if (str.length > maxLen) {
          maxLen = Math.min(str.length, maxWidth);
        }
      });
    }
    column.width = maxLen + 3;
  });
}

export async function createReportWorkbook(options: ExcelExportOptions): Promise<ExcelJS.Workbook> {
  const { pack, transactions, categories = [], recurring = [], reportContent, chartImageBase64 } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LedgerLite';
  workbook.lastModifiedBy = 'LedgerLite Wealth Vault';
  workbook.created = new Date();
  workbook.modified = new Date();

  const catMap = new Map<string, Category>();
  for (const c of categories) {
    catMap.set(c.id, c);
  }

  // -------------------------------------------------------------
  // Sheet 1: Summary
  // -------------------------------------------------------------
  const summarySheet = workbook.addWorksheet('Summary', {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  summarySheet.mergeCells('A1:F2');
  const bannerCell = summarySheet.getCell('A1');
  bannerCell.value = 'LedgerLite — Financial Period Report';
  bannerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: DEEP_BLUE_ARGB },
  };
  bannerCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  bannerCell.alignment = { vertical: 'middle', horizontal: 'center' };

  summarySheet.getCell('A3').value = 'Period:';
  summarySheet.getCell('A3').font = { bold: true };
  summarySheet.getCell('B3').value = `${pack.periodRange.label} (${pack.periodRange.startDate} to ${pack.periodRange.endDate})`;

  summarySheet.getCell('A4').value = 'Generated:';
  summarySheet.getCell('A4').font = { bold: true };
  summarySheet.getCell('B4').value = new Date().toLocaleString('en-IN');

  // KPI Section
  summarySheet.getCell('A6').value = 'Executive Key Performance Indicators';
  summarySheet.getCell('A6').font = { name: 'Calibri', size: 13, bold: true, color: { argb: DEEP_BLUE_ARGB } };

  const kpiHeader = summarySheet.getRow(7);
  kpiHeader.values = ['Metric', 'Period Value', 'Prior Period', 'Delta (₹)', 'Change (%)'];
  applyHeaderStyle(kpiHeader);

  summarySheet.getRow(8).values = [
    'Total Outflow',
    pack.kpis.totalSpend.current,
    pack.kpis.totalSpend.previous ?? 0,
    pack.kpis.totalSpend.delta ?? 0,
    (pack.kpis.totalSpend.percentChange ?? 0) / 100,
  ];
  summarySheet.getCell('B8').numFmt = CURRENCY_FMT;
  summarySheet.getCell('C8').numFmt = CURRENCY_FMT;
  summarySheet.getCell('D8').numFmt = CURRENCY_FMT;
  summarySheet.getCell('E8').numFmt = PERCENT_FMT;

  summarySheet.getRow(9).values = [
    'Transaction Count',
    pack.kpis.transactionCount.current,
    pack.kpis.transactionCount.previous ?? 0,
    pack.kpis.transactionCount.delta ?? 0,
    (pack.kpis.transactionCount.percentChange ?? 0) / 100,
  ];
  summarySheet.getCell('B9').numFmt = INT_FMT;
  summarySheet.getCell('C9').numFmt = INT_FMT;
  summarySheet.getCell('D9').numFmt = INT_FMT;
  summarySheet.getCell('E9').numFmt = PERCENT_FMT;

  summarySheet.getRow(10).values = [
    'Daily Average Spend',
    pack.kpis.dailyAverage.current,
    pack.kpis.dailyAverage.previous ?? 0,
    pack.kpis.dailyAverage.delta ?? 0,
    (pack.kpis.dailyAverage.percentChange ?? 0) / 100,
  ];
  summarySheet.getCell('B10').numFmt = CURRENCY_FMT;
  summarySheet.getCell('C10').numFmt = CURRENCY_FMT;
  summarySheet.getCell('D10').numFmt = CURRENCY_FMT;
  summarySheet.getCell('E10').numFmt = PERCENT_FMT;

  // 50/30/20 Distribution Table
  summarySheet.getCell('A12').value = '50 / 30 / 20 Wealth Allocation Framework';
  summarySheet.getCell('A12').font = { name: 'Calibri', size: 13, bold: true, color: { argb: DEEP_BLUE_ARGB } };

  const splitHeader = summarySheet.getRow(13);
  splitHeader.values = ['Pillar', 'Amount (₹)', 'Actual Share', 'Target Share', 'Variance'];
  applyHeaderStyle(splitHeader);

  summarySheet.getRow(14).values = [
    'Needs (Essentials)',
    pack.distribution50_30_20.need.amount,
    pack.distribution50_30_20.need.percentage / 100,
    0.5,
    (pack.distribution50_30_20.need.percentage - 50) / 100,
  ];
  summarySheet.getCell('B14').numFmt = CURRENCY_FMT;
  summarySheet.getCell('C14').numFmt = PERCENT_FMT;
  summarySheet.getCell('D14').numFmt = PERCENT_FMT;
  summarySheet.getCell('E14').numFmt = PERCENT_FMT;

  summarySheet.getRow(15).values = [
    'Wants (Discretionary)',
    pack.distribution50_30_20.want.amount,
    pack.distribution50_30_20.want.percentage / 100,
    0.3,
    (pack.distribution50_30_20.want.percentage - 30) / 100,
  ];
  summarySheet.getCell('B15').numFmt = CURRENCY_FMT;
  summarySheet.getCell('C15').numFmt = PERCENT_FMT;
  summarySheet.getCell('D15').numFmt = PERCENT_FMT;
  summarySheet.getCell('E15').numFmt = PERCENT_FMT;

  summarySheet.getRow(16).values = [
    'Savings & Investments',
    pack.distribution50_30_20.savings.amount,
    pack.distribution50_30_20.savings.percentage / 100,
    0.2,
    (pack.distribution50_30_20.savings.percentage - 20) / 100,
  ];
  summarySheet.getCell('B16').numFmt = CURRENCY_FMT;
  summarySheet.getCell('C16').numFmt = PERCENT_FMT;
  summarySheet.getCell('D16').numFmt = PERCENT_FMT;
  summarySheet.getCell('E16').numFmt = PERCENT_FMT;

  const splitTotalRow = summarySheet.getRow(17);
  splitTotalRow.getCell(1).value = 'Total Accounted';
  splitTotalRow.getCell(2).value = { formula: 'SUM(B14:B16)', result: pack.kpis.totalSpend.current };
  splitTotalRow.getCell(2).numFmt = CURRENCY_FMT;
  splitTotalRow.getCell(3).value = { formula: 'SUM(C14:C16)', result: 1.0 };
  splitTotalRow.getCell(3).numFmt = PERCENT_FMT;
  applyTotalRowStyle(splitTotalRow);

  // Period Budget Performance Table
  summarySheet.getCell('A19').value = 'Period Budget Discipline & Headroom';
  summarySheet.getCell('A19').font = { name: 'Calibri', size: 13, bold: true, color: { argb: DEEP_BLUE_ARGB } };

  const budgetHeader = summarySheet.getRow(20);
  budgetHeader.values = ['Metric', 'Allocated Ceiling (₹)', 'Actual Outflow (₹)', 'Headroom / Variance (₹)', 'Utilization (%)'];
  applyHeaderStyle(budgetHeader);

  const budgetRow = summarySheet.getRow(21);
  budgetRow.values = [
    'Overall Budget',
    pack.budgetStatus.totalLimit,
    { formula: 'B8', result: pack.kpis.totalSpend.current },
    { formula: 'B21-C21', result: pack.budgetStatus.variance },
    { formula: 'IF(B21>0, C21/B21, 0)', result: pack.budgetStatus.percentUsed / 100 },
  ];
  budgetRow.getCell(2).numFmt = CURRENCY_FMT;
  budgetRow.getCell(3).numFmt = CURRENCY_FMT;
  budgetRow.getCell(4).numFmt = CURRENCY_FMT;
  budgetRow.getCell(5).numFmt = PERCENT_FMT;

  // Executive Summary Narrative Box
  if (reportContent) {
    summarySheet.getCell('A23').value = 'Executive Narrative & Recommendations';
    summarySheet.getCell('A23').font = { name: 'Calibri', size: 13, bold: true, color: { argb: DEEP_BLUE_ARGB } };

    summarySheet.mergeCells('A24:F28');
    const narrativeCell = summarySheet.getCell('A24');
    narrativeCell.value = reportContent.executiveSummary;
    narrativeCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    narrativeCell.font = { name: 'Calibri', size: 10, italic: true };
    narrativeCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9F6EF' },
    };
  }

  autoFitColumns(summarySheet);

  // -------------------------------------------------------------
  // Sheet 2: Transactions
  // -------------------------------------------------------------
  const txSheet = workbook.addWorksheet('Transactions', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }],
  });

  const txHeaders = [
    'Date',
    'Merchant',
    'Category',
    'Subcategory',
    'Payment Method',
    'Amount (₹)',
    'Currency',
    'Notes',
    'Tags',
    'Recurring',
  ];
  const txHeaderRow = txSheet.getRow(1);
  txHeaderRow.values = txHeaders;
  applyHeaderStyle(txHeaderRow);

  let curRow = 2;
  for (const tx of transactions) {
    const parentCat = catMap.get(tx.categoryId);
    const catName = parentCat?.name || tx.categoryId;
    const subName = tx.subcategoryId ? (catMap.get(tx.subcategoryId)?.name || tx.subcategoryId) : '';

    const row = txSheet.getRow(curRow);
    row.values = [
      tx.date.slice(0, 10),
      tx.merchant,
      catName,
      subName,
      tx.paymentMethod,
      tx.amount,
      tx.currency || 'INR',
      tx.notes || '',
      (tx.tags || []).join(', '),
      tx.recurringId ? 'Yes' : 'No',
    ];
    row.getCell(6).numFmt = CURRENCY_FMT;
    curRow++;
  }

  // Summary row on Transactions sheet
  const txTotalRow = txSheet.getRow(curRow);
  txTotalRow.getCell(2).value = 'Total Outflow';
  if (transactions.length > 0) {
    txTotalRow.getCell(6).value = {
      formula: `SUM(F2:F${curRow - 1})`,
      result: pack.kpis.totalSpend.current,
    };
  } else {
    txTotalRow.getCell(6).value = 0;
  }
  txTotalRow.getCell(6).numFmt = CURRENCY_FMT;
  applyTotalRowStyle(txTotalRow);

  const txAvgRow = txSheet.getRow(curRow + 1);
  txAvgRow.getCell(2).value = 'Average Transaction Outflow';
  if (transactions.length > 0) {
    txAvgRow.getCell(6).value = {
      formula: `AVERAGE(F2:F${curRow - 1})`,
      result: pack.kpis.totalSpend.current / transactions.length,
    };
  } else {
    txAvgRow.getCell(6).value = 0;
  }
  txAvgRow.getCell(6).numFmt = CURRENCY_FMT;
  applyTotalRowStyle(txAvgRow);

  autoFitColumns(txSheet);

  // -------------------------------------------------------------
  // Sheet 3: By Category
  // -------------------------------------------------------------
  const catSheet = workbook.addWorksheet('By Category', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }],
  });

  const catHeaderRow = catSheet.getRow(1);
  catHeaderRow.values = [
    'Category',
    'Type',
    'Spend (₹)',
    '% of Outflow',
    'Transaction Count',
    'Budget Limit (₹)',
    'Variance (₹)',
  ];
  applyHeaderStyle(catHeaderRow);

  let catRowIdx = 2;
  const catTotalRowIdx = pack.categoryBreakdown.length + 2;
  for (const catItem of pack.categoryBreakdown) {
    const row = catSheet.getRow(catRowIdx);
    row.values = [
      catItem.categoryName,
      catItem.categoryType.toUpperCase(),
      catItem.amount,
      {
        formula: `IF($C$${catTotalRowIdx}>0, C${catRowIdx}/$C$${catTotalRowIdx}, 0)`,
        result: catItem.percentage / 100,
      },
      catItem.transactionCount,
      catItem.budgetLimit ?? 0,
      {
        formula: `F${catRowIdx}-C${catRowIdx}`,
        result: catItem.variance ?? 0,
      },
    ];
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = PERCENT_FMT;
    row.getCell(5).numFmt = INT_FMT;
    row.getCell(6).numFmt = CURRENCY_FMT;
    row.getCell(7).numFmt = CURRENCY_FMT;
    catRowIdx++;
  }

  const catTotalRow = catSheet.getRow(catRowIdx);
  catTotalRow.getCell(1).value = 'Total';
  if (pack.categoryBreakdown.length > 0) {
    catTotalRow.getCell(3).value = {
      formula: `SUM(C2:C${catRowIdx - 1})`,
      result: pack.kpis.totalSpend.current,
    };
    catTotalRow.getCell(4).value = {
      formula: `SUM(D2:D${catRowIdx - 1})`,
      result: 1.0,
    };
    catTotalRow.getCell(5).value = {
      formula: `SUM(E2:E${catRowIdx - 1})`,
      result: pack.kpis.transactionCount.current,
    };
    catTotalRow.getCell(6).value = {
      formula: `SUM(F2:F${catRowIdx - 1})`,
      result: pack.budgetStatus.totalLimit,
    };
    catTotalRow.getCell(7).value = {
      formula: `SUM(G2:G${catRowIdx - 1})`,
      result: pack.budgetStatus.variance,
    };
  } else {
    catTotalRow.getCell(3).value = 0;
  }
  catTotalRow.getCell(3).numFmt = CURRENCY_FMT;
  catTotalRow.getCell(4).numFmt = PERCENT_FMT;
  catTotalRow.getCell(5).numFmt = INT_FMT;
  catTotalRow.getCell(6).numFmt = CURRENCY_FMT;
  catTotalRow.getCell(7).numFmt = CURRENCY_FMT;
  applyTotalRowStyle(catTotalRow);

  autoFitColumns(catSheet);

  // -------------------------------------------------------------
  // Sheet 4: By Month
  // -------------------------------------------------------------
  const monthSheet = workbook.addWorksheet('By Month', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }],
  });

  const monthHeaderRow = monthSheet.getRow(1);
  monthHeaderRow.values = [
    'Month',
    'Transactions',
    'Total Outflow (₹)',
    'Daily Average (₹)',
    'Top Spending Category',
  ];
  applyHeaderStyle(monthHeaderRow);

  // Group transactions by month (YYYY-MM)
  const monthMap = new Map<string, { count: number; spend: number; catSpend: Map<string, number> }>();
  for (const tx of transactions) {
    const mKey = tx.date.slice(0, 7);
    const entry = monthMap.get(mKey) || { count: 0, spend: 0, catSpend: new Map() };
    entry.count += 1;
    entry.spend += tx.amount;
    entry.catSpend.set(tx.categoryId, (entry.catSpend.get(tx.categoryId) || 0) + tx.amount);
    monthMap.set(mKey, entry);
  }

  let mRowIdx = 2;
  const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [mKey, data] of sortedMonths) {
    let topCatName = 'N/A';
    let maxCatAmt = -1;
    for (const [catId, amt] of data.catSpend.entries()) {
      if (amt > maxCatAmt) {
        maxCatAmt = amt;
        topCatName = catMap.get(catId)?.name || catId;
      }
    }

    const row = monthSheet.getRow(mRowIdx);
    row.values = [
      mKey,
      data.count,
      data.spend,
      { formula: `C${mRowIdx}/30`, result: data.spend / 30 },
      topCatName,
    ];
    row.getCell(2).numFmt = INT_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
    mRowIdx++;
  }

  const monthTotalRow = monthSheet.getRow(mRowIdx);
  monthTotalRow.getCell(1).value = 'Total Outflow';
  if (sortedMonths.length > 0) {
    monthTotalRow.getCell(2).value = {
      formula: `SUM(B2:B${mRowIdx - 1})`,
      result: pack.kpis.transactionCount.current,
    };
    monthTotalRow.getCell(3).value = {
      formula: `SUM(C2:C${mRowIdx - 1})`,
      result: pack.kpis.totalSpend.current,
    };
  } else {
    monthTotalRow.getCell(3).value = 0;
  }
  monthTotalRow.getCell(2).numFmt = INT_FMT;
  monthTotalRow.getCell(3).numFmt = CURRENCY_FMT;
  applyTotalRowStyle(monthTotalRow);

  const monthAvgRow = monthSheet.getRow(mRowIdx + 1);
  monthAvgRow.getCell(1).value = 'Monthly Average';
  if (sortedMonths.length > 0) {
    monthAvgRow.getCell(3).value = {
      formula: `AVERAGE(C2:C${mRowIdx - 1})`,
      result: pack.kpis.totalSpend.current / sortedMonths.length,
    };
  } else {
    monthAvgRow.getCell(3).value = 0;
  }
  monthAvgRow.getCell(3).numFmt = CURRENCY_FMT;
  applyTotalRowStyle(monthAvgRow);

  autoFitColumns(monthSheet);

  // -------------------------------------------------------------
  // Sheet 5: Budget vs Actual
  // -------------------------------------------------------------
  const budgetSheet = workbook.addWorksheet('Budget vs Actual', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }],
  });

  const bHeaderRow = budgetSheet.getRow(1);
  bHeaderRow.values = [
    'Category',
    'Allocated Limit (₹)',
    'Actual Spend (₹)',
    'Variance (₹)',
    '% Utilized',
    'Status',
  ];
  applyHeaderStyle(bHeaderRow);

  let bRowIdx = 2;
  for (const bItem of pack.budgetStatus.categoryBudgets) {
    const row = budgetSheet.getRow(bRowIdx);
    row.values = [
      bItem.categoryName,
      bItem.limit,
      bItem.spent,
      { formula: `B${bRowIdx}-C${bRowIdx}`, result: bItem.variance },
      { formula: `IF(B${bRowIdx}>0, C${bRowIdx}/B${bRowIdx}, 0)`, result: bItem.percentUsed / 100 },
      bItem.spent > bItem.limit ? 'EXCEEDED' : bItem.percentUsed > 85 ? 'WARNING' : 'ON TRACK',
    ];
    row.getCell(2).numFmt = CURRENCY_FMT;
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
    row.getCell(5).numFmt = PERCENT_FMT;
    bRowIdx++;
  }

  const bTotalRow = budgetSheet.getRow(bRowIdx);
  bTotalRow.getCell(1).value = 'Overall Budget Total';
  if (pack.budgetStatus.categoryBudgets.length > 0) {
    bTotalRow.getCell(2).value = {
      formula: `SUM(B2:B${bRowIdx - 1})`,
      result: pack.budgetStatus.totalLimit,
    };
    bTotalRow.getCell(3).value = {
      formula: `SUM(C2:C${bRowIdx - 1})`,
      result: pack.budgetStatus.totalSpent,
    };
    bTotalRow.getCell(4).value = {
      formula: `B${bRowIdx}-C${bRowIdx}`,
      result: pack.budgetStatus.variance,
    };
    bTotalRow.getCell(5).value = {
      formula: `IF(B${bRowIdx}>0, C${bRowIdx}/B${bRowIdx}, 0)`,
      result: pack.budgetStatus.percentUsed / 100,
    };
  } else {
    bTotalRow.getCell(2).value = pack.budgetStatus.totalLimit;
    bTotalRow.getCell(3).value = pack.budgetStatus.totalSpent;
  }
  bTotalRow.getCell(2).numFmt = CURRENCY_FMT;
  bTotalRow.getCell(3).numFmt = CURRENCY_FMT;
  bTotalRow.getCell(4).numFmt = CURRENCY_FMT;
  bTotalRow.getCell(5).numFmt = PERCENT_FMT;
  applyTotalRowStyle(bTotalRow);

  autoFitColumns(budgetSheet);

  // -------------------------------------------------------------
  // Sheet 6: Recurring
  // -------------------------------------------------------------
  const recurringSheet = workbook.addWorksheet('Recurring', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: true }],
  });

  const rHeaderRow = recurringSheet.getRow(1);
  rHeaderRow.values = [
    'Merchant',
    'Category',
    'Cadence',
    'Amount (₹)',
    'Est. Monthly Cost (₹)',
    'Next Due Date',
    'Active Status',
  ];
  applyHeaderStyle(rHeaderRow);

  let rRowIdx = 2;
  for (const r of recurring) {
    let monthlyEquivalent = r.template.amount;
    if (r.cadence === 'daily') monthlyEquivalent = r.template.amount * 30;
    else if (r.cadence === 'weekly') monthlyEquivalent = r.template.amount * 4.33;
    else if (r.cadence === 'quarterly') monthlyEquivalent = r.template.amount / 3;
    else if (r.cadence === 'yearly') monthlyEquivalent = r.template.amount / 12;

    const row = recurringSheet.getRow(rRowIdx);
    row.values = [
      r.template.merchant,
      catMap.get(r.template.categoryId)?.name || r.template.categoryId,
      r.cadence.toUpperCase(),
      r.template.amount,
      monthlyEquivalent,
      r.nextDue,
      r.active ? 'ACTIVE' : 'PAUSED',
    ];
    row.getCell(4).numFmt = CURRENCY_FMT;
    row.getCell(5).numFmt = CURRENCY_FMT;
    rRowIdx++;
  }

  const rTotalRow = recurringSheet.getRow(rRowIdx);
  rTotalRow.getCell(1).value = 'Total Monthly Recurring Commitment';
  if (recurring.length > 0) {
    rTotalRow.getCell(5).value = {
      formula: `SUM(E2:E${rRowIdx - 1})`,
      result: recurring.reduce((acc, r) => {
        let m = r.template.amount;
        if (r.cadence === 'daily') m *= 30;
        else if (r.cadence === 'weekly') m *= 4.33;
        else if (r.cadence === 'quarterly') m /= 3;
        else if (r.cadence === 'yearly') m /= 12;
        return acc + (r.active ? m : 0);
      }, 0),
    };
  } else {
    rTotalRow.getCell(5).value = 0;
  }
  rTotalRow.getCell(5).numFmt = CURRENCY_FMT;
  applyTotalRowStyle(rTotalRow);

  autoFitColumns(recurringSheet);

  // -------------------------------------------------------------
  // Sheet 7: Charts
  // -------------------------------------------------------------
  const chartsSheet = workbook.addWorksheet('Charts', {
    views: [{ showGridLines: true }],
  });

  chartsSheet.getCell('B2').value = 'Visual Financial Insights & Charts';
  chartsSheet.getCell('B2').font = {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: DEEP_BLUE_ARGB },
  };

  chartsSheet.mergeCells('B3:J4');
  const chartNoteCell = chartsSheet.getCell('B3');
  chartNoteCell.value =
    'Note: OpenXML (.xlsx) does not support native web SVG/Canvas charts without proprietary Excel COM plugins. High-resolution visual snapshots of period spending patterns and category distributions are rendered into worksheet cells as raster images below.';
  chartNoteCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  chartNoteCell.font = { name: 'Calibri', size: 10, italic: true };

  if (chartImageBase64) {
    try {
      const cleanBase64 = chartImageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageId = workbook.addImage({
        base64: cleanBase64,
        extension: 'png',
      });
      chartsSheet.addImage(imageId, {
        tl: { col: 1, row: 5 },
        ext: { width: 620, height: 340 },
      });
    } catch (imgErr) {
      console.warn('Could not embed chart image into Excel:', imgErr);
    }
  } else {
    chartsSheet.getCell('B6').value =
      'Interactive visual charts are available in the LedgerLite Web App (Reports and Dashboard pages).';
    chartsSheet.getCell('B6').font = { italic: true, color: { argb: 'FF5A738E' } };
  }

  chartsSheet.getColumn(2).width = 80;

  return workbook;
}

export async function exportReportToExcel(
  options: ExcelExportOptions,
  filename?: string
): Promise<ArrayBuffer> {
  const workbook = await createReportWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = filename || `ledgerlite_report_${options.pack.periodRange.shortLabel.replace(/\s+/g, '_')}_${options.pack.periodRange.startDate}.xlsx`;
    link.href = url;
    link.download = safeName.endsWith('.xlsx') ? safeName : `${safeName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return buffer;
}
