import type { Transaction } from '@/types';
import type { PreparedImportTransaction } from './types';

function parseToCalendarDay(dateStr: string): number {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match && match[1] && match[2] && match[3]) {
    return Math.floor(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000
    );
  }
  const d = new Date(dateStr);
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000
  );
}

/**
 * Checks incoming transactions against existing transactions for duplicates
 * A duplicate is defined as:
 * - Date within +/- 1 calendar day
 * - Matching amount (within ₹0.01)
 * - Identical or substring-matched merchant
 */
export function detectDuplicates(
  incoming: PreparedImportTransaction[],
  existing: Transaction[]
): PreparedImportTransaction[] {
  return incoming.map((item) => {
    const itemDay = parseToCalendarDay(item.date);

    const duplicateMatch = existing.find((ex) => {
      // 1. Amount check (within 1 paisa)
      if (Math.abs(ex.amount - item.amount) >= 0.01) {
        return false;
      }

      // 2. Date within +/- 1 calendar day
      const exDay = parseToCalendarDay(ex.date);
      if (Math.abs(exDay - itemDay) > 1) {
        return false;
      }

      // 3. Merchant check (exact or substring)
      const m1 = ex.merchant.toLowerCase().trim();
      const m2 = item.merchant.toLowerCase().trim();
      if (!m1 || !m2) return false;

      return m1 === m2 || m1.includes(m2) || m2.includes(m1);
    });

    if (duplicateMatch) {
      return {
        ...item,
        isDuplicate: true,
        duplicateOf: duplicateMatch,
        selectedForImport: false, // Default to skipping duplicates
      };
    }

    return {
      ...item,
      isDuplicate: false,
      duplicateOf: undefined,
      selectedForImport: true,
    };
  });
}
