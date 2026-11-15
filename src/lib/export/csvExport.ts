import { Transaction, Category } from '@/types';

/**
 * Escapes a cell value according to RFC 4180 standard.
 * - Wraps in double quotes if it contains commas, double quotes, or newlines.
 * - Replaces any inner double quote `"` with `""`.
 * - Sanitizes formula injection characters (=, +, -, @) by prepending a single quote.
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }

  // Pure numbers are safe from formula injection and should not have single quotes prepended
  if (typeof val === 'number') {
    return String(val);
  }

  let str = String(val);

  // CSV Formula Injection mitigation (prepend single quote if begins with formula indicators)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  const needsQuotes = str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r');
  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function generateTransactionsCsv(
  transactions: Transaction[],
  categories: Category[] = []
): string {
  const catMap = new Map<string, string>();
  for (const c of categories) {
    catMap.set(c.id, c.name);
  }

  const headers = [
    'Date',
    'Merchant',
    'Category',
    'Subcategory',
    'Payment Method',
    'Amount',
    'Currency',
    'Notes',
    'Tags',
    'Recurring',
    'Source',
  ];

  const rows: string[] = [headers.map(escapeCsvField).join(',')];

  for (const tx of transactions) {
    const categoryName = catMap.get(tx.categoryId) || tx.categoryId;
    const subcategoryName = tx.subcategoryId ? (catMap.get(tx.subcategoryId) || tx.subcategoryId) : '';
    const tagsString = (tx.tags || []).join('; ');
    const recurringStatus = tx.recurringId ? 'Yes' : 'No';

    const row = [
      tx.date,
      tx.merchant,
      categoryName,
      subcategoryName,
      tx.paymentMethod,
      tx.amount.toFixed(2),
      tx.currency || 'INR',
      tx.notes || '',
      tagsString,
      recurringStatus,
      tx.source || 'manual',
    ];

    rows.push(row.map(escapeCsvField).join(','));
  }

  // Prepend UTF-8 BOM so Excel opens Indian Rupees and Unicode characters cleanly
  return `\uFEFF${rows.join('\r\n')}`;
}

export function downloadCsv(csvContent: string, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
