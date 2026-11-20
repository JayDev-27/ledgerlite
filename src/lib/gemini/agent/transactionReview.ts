import type { Repository } from '@/data/repository';
import { sanitizeSensitiveText } from '@/lib/gemini/privacySanitizer';
import type { Category, PaymentMethod } from '@/types';
import type { ExtractedTransactionKind, ExtractedTransactionProposal, TransactionEvidence } from './types';

const directions: Record<TransactionEvidence, ExtractedTransactionProposal['direction']> = {
  bank_credit: 'credit',
  bank_debit: 'debit',
  card_charge: 'debit',
  card_credit: 'credit',
  paid_receipt: 'debit',
  explicit_expense: 'debit',
  unknown: 'unknown',
};

export const transactionKindLabels: Record<ExtractedTransactionKind, string> = {
  expense: 'Expense', income: 'Income', credit: 'Credit', refund: 'Refund',
  transfer: 'Transfer', card_payment: 'Card payment', cash_withdrawal: 'Cash withdrawal', unknown: 'Needs review',
};

const paymentMethods = new Set<PaymentMethod>(['upi', 'card', 'cash', 'net_banking', 'wallet']);

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isStatementSummary(label: string): boolean {
  return /^(?:(?:(?:opening|closing|beginning|ending|previous|new|available|running|statement|current)\s+balance|balance (?:brought|carried) forward)(?:\s+(?:as of|on)\b.*)?|balance|(?:sub)?totals?(?:\s+(?:debits|credits|deposits|withdrawals|purchases|payments|due|amount))?|(?:minimum\s+)?(?:payment|amount) due|payments and credits|deposits and credits|withdrawals and debits)[:.]?$/i.test(label.trim());
}

export function classifyStatementRow(merchant: string, direction: ExtractedTransactionProposal['direction']): ExtractedTransactionKind {
  if (/\b(?:credit[ -]?card (?:bill|payments?|autopay)|card (?:payments?|autopay)|(?:amex|american express|discover) (?:e[ -]?)?payments?|autopay payment|payment thank you|automatic payment\s*-\s*thank you|online payment\s*-\s*thank you)\b/i.test(merchant)) return 'card_payment';
  if (/\b(?:refund(?:ed)?|cash ?back|reversal|chargeback|return credit|purchase return)\b/i.test(merchant)) return 'refund';
  if (/\b(?:internal transfer|own accounts?|self transfer|balance transfer|transfer (?:to|from) (?:savings|checking|my |own )|wallet (?:top[ -]?up|load))\b/i.test(merchant)) return 'transfer';
  if (/\b(?:atm (?:cash )?(?:withdrawal|w\/d)|cash withdrawal|cash advance)\b/i.test(merchant)) return 'cash_withdrawal';
  if (/\b(?:atm|mobile|check|cheque|cash) deposit\b/i.test(merchant)) return 'credit';
  if (direction === 'credit' && /\breturn\b/i.test(merchant)) return 'refund';
  if (/\b(?:salary (?:credit(?:ed)?|deposit|received)|payroll (?:credit(?:ed)?|deposit)|direct deposit)\b/i.test(merchant)) return 'income';
  if (/^(?:deposit|deposit received|incoming payment|money received)$/i.test(merchant)) return 'credit';
  if (direction === 'credit') {
    return /\b(?:salary|payroll|wages|interest (?:paid|payment|credit|earned))\b/i.test(merchant) ? 'income' : 'credit';
  }
  if (direction === 'debit' && !/\b(?:transfer|remittance|sent money|deposit)\b/i.test(merchant)) return 'expense';
  return 'unknown';
}

export function reviewTransactions(
  items: unknown[],
  categories: Category[],
  privacyMode: boolean,
  document: boolean,
): ExtractedTransactionProposal[] {
  return items.flatMap((raw): ExtractedTransactionProposal[] => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    const merchant = typeof item.merchant === 'string' ? item.merchant.trim() : '';
    if (!merchant || isStatementSummary(merchant) || typeof item.amount !== 'number' ||
        !Number.isFinite(item.amount) || item.amount <= 0 || item.amount > Number.MAX_SAFE_INTEGER / 100) return [];

    const date = typeof item.date === 'string' && isCalendarDate(item.date) ? item.date : '';
    const currency = typeof item.currency === 'string' && /^[A-Z]{3}$/.test(item.currency) && item.currency !== 'XXX'
      ? item.currency : 'Unknown';
    let evidence = typeof item.evidence === 'string' && Object.prototype.hasOwnProperty.call(directions, item.evidence) &&
      (!document || item.evidence !== 'explicit_expense') ? item.evidence as TransactionEvidence : 'unknown';
    if ((evidence === 'bank_credit' || evidence === 'bank_debit') &&
        typeof item.balanceBefore === 'number' && Number.isFinite(item.balanceBefore) &&
        typeof item.balanceAfter === 'number' && Number.isFinite(item.balanceAfter)) {
      const movement = item.balanceAfter - item.balanceBefore;
      const expected = evidence === 'bank_credit' ? item.amount : -item.amount;
      if (Math.abs(movement - expected) > 0.005) evidence = 'unknown';
    }
    let direction = directions[evidence];
    const claimedKind = typeof item.kind === 'string' && Object.prototype.hasOwnProperty.call(transactionKindLabels, item.kind)
      ? item.kind as ExtractedTransactionKind : 'unknown';
    const inferredKind = classifyStatementRow(merchant, direction);
    if (direction === 'debit' && (inferredKind === 'income' || inferredKind === 'credit')) {
      direction = 'unknown';
      evidence = 'unknown';
    }
    let kind = claimedKind;
    if (['card_payment', 'refund', 'transfer', 'cash_withdrawal', 'income'].includes(inferredKind)) {
      kind = inferredKind;
    } else if (direction === 'credit' && (kind === 'expense' || kind === 'unknown')) {
      kind = 'credit';
    } else if (inferredKind === 'credit' && (direction !== 'credit' || kind === 'income')) {
      kind = 'credit';
    }

    let importBlockedReason: string | undefined;
    if (kind !== 'expense' || direction !== 'debit') importBlockedReason = 'Only confirmed expenses can be added.';
    else if (!date) importBlockedReason = 'The transaction date is unclear.';
    else if (currency !== 'INR') importBlockedReason = currency === 'Unknown'
      ? 'The currency is unclear.' : 'The spending ledger supports INR.';
    else if (Math.round(item.amount * 100) / 100 !== item.amount) importBlockedReason = 'Check the INR amount precision.';

    const categoryInput = typeof item.category === 'string' ? item.category.trim().toLowerCase() : '';
    const category = categories.find((c) => c.id.toLowerCase() === categoryInput || c.name.toLowerCase() === categoryInput);
    const paymentMethod = paymentMethods.has(item.paymentMethod as PaymentMethod)
      ? item.paymentMethod as PaymentMethod
      : evidence === 'card_charge' || evidence === 'card_credit' ? 'card' : undefined;

    return [{
      id: crypto.randomUUID(),
      date, amount: item.amount, currency, kind, evidence, direction,
      merchant: privacyMode ? sanitizeSensitiveText(merchant) : merchant,
      category: category?.name,
      categoryId: category?.id,
      paymentMethod,
      notes: typeof item.notes === 'string' && (!privacyMode || !document)
        ? (privacyMode ? sanitizeSensitiveText(item.notes.trim()) : item.notes.trim()) : undefined,
      importBlockedReason,
    }];
  });
}

export function canImportExpense(tx: ExtractedTransactionProposal, visuallyConfirmed = false): boolean {
  if (tx.importBlockedReason) return false;
  if (!tx.documentSource) return !tx.sourceFile;
  return tx.documentSource.verification === 'verified' ||
    (visuallyConfirmed && tx.documentSource.verification === 'visual_review');
}

export async function saveReviewedExpense(
  tx: ExtractedTransactionProposal, repo: Repository, visuallyConfirmed = false,
): Promise<void> {
  if (!canImportExpense(tx, visuallyConfirmed) || tx.kind !== 'expense' || tx.direction !== 'debit' || tx.currency !== 'INR' ||
      directions[tx.evidence] !== 'debit' || !isCalendarDate(tx.date) || !Number.isFinite(tx.amount) || tx.amount <= 0 || tx.amount > Number.MAX_SAFE_INTEGER / 100 || Math.round(tx.amount * 100) / 100 !== tx.amount) {
    throw new Error('This row cannot be added to the spending ledger.');
  }
  if (await repo.getTransaction(tx.id)) return;

  const categories = await repo.getCategories();
  const category = categories.find((c) => c.id === tx.categoryId) ??
    categories.find((c) => c.id === 'cat_misc' || c.id === 'cat_other' || c.name.toLowerCase() === 'other');
  if (!category) throw new Error('No category is available for this expense.');

  try {
    await repo.addTransaction({
      id: tx.id,
      date: tx.date,
      amount: tx.amount,
      currency: tx.currency,
      merchant: tx.merchant,
      categoryId: category.parentId || category.id,
      subcategoryId: category.parentId ? category.id : undefined,
      paymentMethod: tx.paymentMethod || 'net_banking',
      notes: tx.notes,
      tags: ['ai-imported'],
      source: 'ai',
    });
  } catch (error) {
    if (!(await repo.getTransaction(tx.id))) throw error;
  }
}
