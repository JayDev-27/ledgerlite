import type { CsvParseResult, ColumnMapping, CsvField } from './types';

/**
 * Parses raw CSV text respecting RFC 4180 quotes, multiline values, and commas
 */
export function parseCsv(text: string, delimiter = ','): CsvParseResult {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        if (currentRow.some((val) => val.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  // Push final trailing field/row
  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((val) => val.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0 || !rows[0]) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map((h) => h.replace(/^["']|["']$/g, '').trim());
  const dataRows = rows.slice(1);

  return { headers, rows: dataRows };
}

/**
 * Automatically detects column mapping based on standard bank and expense headers
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    date: null,
    amount: null,
    merchant: null,
    category: null,
    paymentMethod: null,
    notes: null,
  };

  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  const patterns: Record<CsvField, RegExp[]> = {
    date: [/txn\s*date/i, /trans(action)?\s*date/i, /value\s*date/i, /posting\s*date/i, /^date$/i, /time/i],
    amount: [/withdrawal/i, /debit/i, /^amount$/i, /txn\s*amount/i, /spend/i, /total/i, /cost/i],
    merchant: [/merchant/i, /payee/i, /description/i, /narration/i, /particulars/i, /party/i, /vendor/i, /^name$/i],
    category: [/^category$/i, /cat/i, /type/i, /head/i],
    paymentMethod: [/payment\s*method/i, /payment\s*mode/i, /^mode$/i, /^channel$/i, /payment/i],
    notes: [/^notes?$/i, /remarks?/i, /comments?/i, /memo/i],
  };

  const assignedIndices = new Set<number>();

  for (const field of ['date', 'amount', 'merchant', 'category', 'paymentMethod', 'notes'] as CsvField[]) {
    const regexes = patterns[field];
    for (const re of regexes) {
      const idx = lowerHeaders.findIndex((h, index) => !assignedIndices.has(index) && re.test(h));
      if (idx !== -1) {
        mapping[field] = idx;
        assignedIndices.add(idx);
        break;
      }
    }
  }

  return mapping;
}

/**
 * Normalizes payment method string into standard PaymentMethod union
 */
export function normalizePaymentMethod(val: string): 'upi' | 'card' | 'cash' | 'net_banking' | 'wallet' {
  const lower = val.toLowerCase().trim();
  if (lower.includes('upi') || lower.includes('gpay') || lower.includes('phonepe') || lower.includes('paytm upi')) {
    return 'upi';
  }
  if (lower.includes('card') || lower.includes('debit') || lower.includes('credit') || lower.includes('pos')) {
    return 'card';
  }
  if (lower.includes('net') || lower.includes('banking') || lower.includes('neft') || lower.includes('rtgs') || lower.includes('imps')) {
    return 'net_banking';
  }
  if (lower.includes('cash')) {
    return 'cash';
  }
  if (lower.includes('wallet') || lower.includes('paytm')) {
    return 'wallet';
  }
  return 'upi';
}

/**
 * Parses diverse date formats into YYYY-MM-DD
 * Supports: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY, ISO strings
 */
export function parseDateString(raw: string): string {
  const fallback = new Date().toISOString().split('T')[0] ?? '2026-11-15';
  if (!raw) return fallback;
  const cleaned = raw.trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try standard Date parsing
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0] ?? fallback;
  }

  return fallback;
}

/**
 * Parses cleaned amount numbers, stripping currency symbols and commas
 */
export function parseAmount(raw: string): number {
  if (!raw) return 0;
  // Remove currency symbols, commas, and negative signs (if debit)
  const cleaned = raw.replace(/[₹$,\s]/g, '').replace(/^-/, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.abs(val);
}
