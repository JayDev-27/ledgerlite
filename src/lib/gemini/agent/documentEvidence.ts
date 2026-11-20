import { readStatementMoney, readStatementRows, statementHeaders } from '@/lib/csv/statement';
import { sanitizeSensitiveText } from '@/lib/gemini/privacySanitizer';
import type { PdfCell, PdfSourcePage } from './pdfSource';
import { isCalendarDate, isStatementSummary } from './transactionReview';
import type { DocumentRowSource } from './types';

interface PrintedRow {
  date: string;
  merchant: string;
  currency?: string;
  amount: number;
  direction: 'credit' | 'debit' | 'unknown';
  page: number;
  line: number;
  heading: string;
  excerpt: string;
  balance?: number;
  conflict?: boolean;
}

function normalizeWords(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function sameMerchant(source: string, candidate: string) {
  const row = normalizeWords(source);
  const model = normalizeWords(candidate);
  if (!row || !model) return false;
  return row === model || (Math.min(row.length, model.length) >= 8 &&
    (` ${row} `.includes(` ${model} `) || ` ${model} `.includes(` ${row} `)));
}

function tableValues(cells: PdfCell[], headers: PdfCell[]) {
  const values = Array.from({ length: headers.length }, () => '');
  for (const cell of cells) {
    // Equal edges cover left-aligned labels and right-aligned numeric columns. A
    // value with competing alignments is deliberately left out of the table.
    const distances = headers.map((header) => Math.min(Math.abs(cell.x - header.x),
      Math.abs(cell.x + cell.width - header.x - header.width)));
    const best = Math.min(...distances);
    const winners = distances.flatMap((distance, index) => distance - best < 3 ? [index] : []);
    const column = winners[0];
    if (column === undefined || winners.length !== 1 || best > 16) continue;
    values[column] = [values[column], cell.text].filter(Boolean).join(' ');
  }
  return values;
}

export function readPrintedStatementRows(pages: PdfSourcePage[]): PrintedRow[] {
  return pages.flatMap(({ page, lines }) => {
    const headerIndex = lines.findIndex((line) => {
      const indices = statementHeaders(line.map((cell) => cell.text));
      return indices.date >= 0 && indices.merchant >= 0 && indices.debit >= 0 && indices.credit >= 0;
    });
    const header = lines[headerIndex];
    if (!header) return [];
    const names = header.map((cell) => cell.text);
    const indices = statementHeaders(names);
    const textBeforeTable = lines.slice(0, headerIndex).flat().map((cell) => cell.text).join(' ');
    const body = lines.slice(headerIndex + 1);
    const values = body.map((line) => tableValues(line, header));
    const rows = readStatementRows(names, values, indices, textBeforeTable).flatMap((row, index): PrintedRow[] => {
      if (!row.amount || !row.merchant || !row.date || !isCalendarDate(row.date) || isStatementSummary(row.merchant)) return [];
      const heading = row.direction === 'credit' ? names[indices.credit] : row.direction === 'debit' ? names[indices.debit] : undefined;
      return [{
        ...row, page, line: headerIndex + index + 2,
        heading: heading ?? 'Debit / Credit',
        excerpt: body[index]?.map((cell) => cell.text).join(' | ') ?? '',
        balance: readStatementMoney(values[index]?.[indices.balance]),
      }];
    });
    const distinctDates = [...new Set(rows.map((row) => row.date))];
    const increasing = distinctDates.every((date, i) => i === 0 || date > distinctDates[i - 1]!);
    const decreasing = distinctDates.length > 1 && distinctDates.every((date, i) => i === 0 || date < distinctDates[i - 1]!);
    if (increasing || decreasing) {
      const ordered = decreasing ? [...rows].reverse() : rows;
      for (const [index, row] of ordered.entries()) {
        const prior = ordered[index - 1];
        if (!prior || Math.abs(row.line - prior.line) !== 1 || row.balance === undefined ||
            prior.balance === undefined || row.direction === 'unknown') continue;
        const expected = row.direction === 'credit' ? row.amount : -row.amount;
        row.conflict = Math.abs(row.balance - prior.balance - expected) > 0.005;
      }
    }
    return rows;
  });
}

export interface SourcedItem {
  item: unknown;
  source: DocumentRowSource;
}

export function groundUploadedRows(
  items: unknown[], pages: PdfSourcePage[], attachmentId: string, documentType: unknown, privacyMode: boolean,
): SourcedItem[] {
  const bankStatement = documentType === 'bank_statement';
  const printedRows = bankStatement ? readPrintedStatementRows(pages) : [];
  const usedRows = new Set<PrintedRow>();
  return items.map((item) => {
    const original = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const suggestedPage = Number.isSafeInteger(original.page) && Number(original.page) > 0 &&
        (!pages.length || pages.some((page) => page.page === original.page))
      ? Number(original.page) : undefined;
    const source: DocumentRowSource = {
      attachmentId, page: suggestedPage, verification: 'visual_review',
      reason: 'Check the original before adding this expense.',
    };
    if (typeof original.merchant !== 'string' || typeof original.date !== 'string' ||
        typeof original.amount !== 'number') return { item, source };

    // A model-provided page number may help navigation. It never establishes
    // identity or lets a matching amount on a different row supply direction.
    const matches = printedRows.filter((row) =>
      row.date === original.date && row.amount === original.amount && sameMerchant(row.merchant, String(original.merchant)));
    const row = matches[0];
    if (row && matches.every((match) => match.direction === row.direction && match.currency === row.currency && !match.conflict)) {
      const available = matches.find((match) => !usedRows.has(match));
      if (!available) {
        return { item, source: { ...source, verification: 'conflict', reason: 'This statement row was already extracted.' } };
      }
      usedRows.add(available);
      Object.assign(source, {
        page: available.page, line: available.line, heading: available.heading,
        excerpt: privacyMode ? sanitizeSensitiveText(available.excerpt) : available.excerpt,
      });
      if (available.direction === 'unknown') return { item, source: { ...source, verification: 'conflict', reason: 'The source shows conflicting debit and credit values.' } };
      if (available.currency && available.currency !== 'XXX' && original.currency !== available.currency) {
        return { item, source: { ...source, verification: 'conflict', reason: 'The printed currency differs from the extracted currency.' } };
      }
      if (available.currency && available.currency !== 'XXX') {
        source.verification = 'verified';
        source.reason = undefined;
      }
      const evidence = available.direction === 'credit' ? 'bank_credit' : 'bank_debit';
      // Running balances supplied by the model must not override balances
      // independently checked against the printed table.
      return { item: { ...original, evidence, balanceBefore: undefined, balanceAfter: undefined }, source };
    }
    if (matches.length > 0) {
      return { item, source: { ...source, page: row?.page, line: row?.line, heading: row?.heading,
        excerpt: row && (privacyMode ? sanitizeSensitiveText(row.excerpt) : row.excerpt),
        verification: 'conflict', reason: 'The printed rows disagree on direction, currency, or running balance.' } };
    }
    return { item, source };
  });
}
