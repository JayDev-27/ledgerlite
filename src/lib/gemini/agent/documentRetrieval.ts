import { sanitizeSensitiveText } from '@/lib/gemini/privacySanitizer';
import { tokenize } from './retrieval';
import type { ExtractedTransactionProposal } from './types';

export function sourceCitation(row: ExtractedTransactionProposal) {
  return row.id.slice(-12);
}

const kindTerms: Record<ExtractedTransactionProposal['kind'], string> = {
  income: 'salary payroll income earnings',
  credit: 'deposit credit incoming received',
  expense: 'purchase expense spending charges',
  refund: 'refund refunds reversal returned cashback',
  transfer: 'transfer transfers',
  card_payment: 'repayment card payment payments',
  cash_withdrawal: 'atm cash withdrawal withdrawals',
  unknown: '',
};

const documentQuestion = /\b(?:uploaded|file|statement|document|receipt|pdf|scan|csv|source|page)\b/i;

export function retrieveDocumentContext(
  query: string, rows: ExtractedTransactionProposal[], privacyMode: boolean,
): string {
  const terms = new Set(tokenize(query));
  const distinctive = [...terms].filter((term) => !documentQuestion.test(term) && !['total', 'show', 'find'].includes(term));
  const latestById = new Map<string, ExtractedTransactionProposal>();
  for (const row of rows) if (row.documentSource) latestById.set(row.id, row);
  const scored = [...latestById.values()].reverse().map((row) => {
    const merchantTerms = tokenize(row.merchant);
    const attributes = tokenize(`${row.date} ${row.amount} ${row.currency} ${row.direction} ${kindTerms[row.kind]} ${row.documentSource?.heading ?? ''}`);
    const score = distinctive.reduce((total, term) =>
      total + (merchantTerms.includes(term) ? 3 : attributes.includes(term) ? 1 : 0), 0);
    return { row, score };
  }).sort((a, b) => b.score - a.score);
  const selected = scored.filter(({ score }) => score > 0).slice(0, 12).map(({ row }) => row);
  if (!selected.length && documentQuestion.test(query)) {
    selected.push(...scored.slice(0, 12).map(({ row }) => row));
  }
  if (!selected.length) return '';

  const excerpts = selected.map((row) => {
    const source = row.documentSource!;
    return {
      citation: `[source:${sourceCitation(row)}]`,
      page: source.page,
      row: source.line,
      column: source.heading,
      merchant: privacyMode ? sanitizeSensitiveText(row.merchant) : row.merchant,
      date: row.date || undefined,
      amount: row.amount,
      currency: row.currency,
      kind: row.kind,
      direction: row.direction,
      verification: source.verification,
    };
  });

  return `Retrieved rows from uploads in this chat (up to 12 relevant rows, may be unsaved, not a complete statement):\n${JSON.stringify(excerpts)}`;
}
