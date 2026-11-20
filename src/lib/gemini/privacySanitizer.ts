/**
 * Privacy Sanitizer for Gemini AI Integrations
 *
 * Enforces Free-Tier Privacy Protection by stripping personal notes,
 * exact receipt identifiers, card numbers, bank account numbers, UPI IDs,
 * and contact numbers before data is transmitted to external AI endpoints.
 */

/**
 * Strips account numbers, card numbers, UPI IDs, phone numbers, and receipt identifiers
 */
export function sanitizeSensitiveText(text: string): string {
  if (!text) return '';
  return text
    // Card numbers (13-19 digits, with spaces or hyphens)
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD REDACTED]')
    // Receipt / Invoice / Transaction IDs (run before phone numbers so ref #TXN-1234567890 isn't mistaken for a phone number)
    .replace(/\b(?:receipt|inv|invoice|txn|txnid|ref)\s*[:#-]?\s*[A-Za-z0-9_-]{4,}\b/gi, '[RECEIPT REDACTED]')
    // Bank account numbers: e.g. A/C 123456789012, Acc: 987654321
    .replace(/\b(?:a\/?c|acct|acc|account|no\.?)\s*[:#-]?\s*\d{4,}\b/gi, '[ACCOUNT REDACTED]')
    // UPI IDs: e.g. someone@okhdfcbank
    .replace(/\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}\b/g, '[UPI REDACTED]')
    // Phone numbers (Indian 10-digit formats with optional +91 or leading 0)
    .replace(/\b(?:\+91|91|0)?\s?[6-9]\d{9}\b/g, '[PHONE REDACTED]');
}

export interface SanitizedTransactionData {
  merchant: string;
  amount: number;
  notes?: string;
  date?: string;
  paymentMethod?: string;
  category?: string;
}

/**
 * Sanitizes a transaction record before dispatching to an AI model.
 * If privacyMode is enabled, personal notes are stripped entirely and
 * merchant text is sanitized of account / card / phone identifiers.
 */
export function sanitizeTransactionForAi(
  tx: {
    merchant: string;
    amount: number;
    notes?: string | null;
    date?: string;
    paymentMethod?: string;
    category?: string;
  },
  privacyMode = true,
  pseudonymMerchant?: string
): SanitizedTransactionData {
  if (!privacyMode) {
    return {
      merchant: tx.merchant,
      amount: tx.amount,
      notes: tx.notes || undefined,
      date: tx.date,
      paymentMethod: tx.paymentMethod,
      category: tx.category,
    };
  }

  return {
    merchant: pseudonymMerchant || sanitizeSensitiveText(tx.merchant),
    amount: tx.amount,
    notes: undefined, // Stripped in Privacy Mode
    date: tx.date ? tx.date.slice(0, 10) : undefined,
    paymentMethod: tx.paymentMethod,
    category: tx.category,
  };
}
