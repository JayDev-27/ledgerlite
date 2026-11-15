import { describe, it, expect } from 'vitest';
import {
  sanitizeSensitiveText,
  sanitizeTransactionForAi,
} from '@/lib/gemini/privacySanitizer';

describe('Privacy Sanitizer — Free-Tier Data Redaction', () => {
  it('redacts credit/debit card numbers in merchant or input text', () => {
    const raw = 'Payment at Starbucks with card 4111 2222 3333 4444 approved';
    const sanitized = sanitizeSensitiveText(raw);
    expect(sanitized).not.toContain('4111 2222 3333 4444');
    expect(sanitized).toContain('[CARD REDACTED]');
  });

  it('redacts bank account numbers across standard formats', () => {
    const raw1 = 'Salary credited to A/C 987654321012';
    expect(sanitizeSensitiveText(raw1)).toContain('[ACCOUNT REDACTED]');
    expect(sanitizeSensitiveText(raw1)).not.toContain('987654321012');

    const raw2 = 'Transfer from Acc: 12345678 to landlord';
    expect(sanitizeSensitiveText(raw2)).toContain('[ACCOUNT REDACTED]');
    expect(sanitizeSensitiveText(raw2)).not.toContain('12345678');
  });

  it('redacts UPI IDs and phone numbers', () => {
    const upi = 'Sent ₹2,500 to rahul.sharma@okaxis for dinner';
    const sanitizedUpi = sanitizeSensitiveText(upi);
    expect(sanitizedUpi).toContain('[UPI REDACTED]');
    expect(sanitizedUpi).not.toContain('rahul.sharma@okaxis');

    const phone = 'Paid plumber via 9876543210';
    const sanitizedPhone = sanitizeSensitiveText(phone);
    expect(sanitizedPhone).toContain('[PHONE REDACTED]');
    expect(sanitizedPhone).not.toContain('9876543210');
  });

  it('redacts receipt and invoice references', () => {
    const raw = 'Electronics purchase ref #TXN-9847194719 at Croma';
    const sanitized = sanitizeSensitiveText(raw);
    expect(sanitized).toContain('[RECEIPT REDACTED]');
    expect(sanitized).not.toContain('TXN-9847194719');
  });

  it('strips personal notes and redacts sensitive merchant identifiers when privacyMode is active', () => {
    const tx = {
      merchant: 'A/C 12345678 Netflix Subscription',
      amount: 649,
      notes: 'Personal note: shared with roommates John and Jane',
      date: '2026-11-01T10:00:00Z',
      paymentMethod: 'upi',
      category: 'cat_subscriptions',
    };

    // With Privacy Mode enabled:
    const sanitized = sanitizeTransactionForAi(tx, true);
    expect(sanitized.notes).toBeUndefined(); // Notes completely omitted!
    expect(sanitized.merchant).toContain('[ACCOUNT REDACTED]');
    expect(sanitized.merchant).not.toContain('12345678');
    expect(sanitized.amount).toBe(649);

    // With Privacy Mode disabled:
    const unsanitized = sanitizeTransactionForAi(tx, false);
    expect(unsanitized.notes).toBe('Personal note: shared with roommates John and Jane');
    expect(unsanitized.merchant).toBe('A/C 12345678 Netflix Subscription');
  });
});
