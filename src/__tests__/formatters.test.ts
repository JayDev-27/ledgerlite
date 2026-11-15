import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  formatPercentage,
} from '@/lib/formatters';

describe('formatCurrency', () => {
  it('formats Indian rupee amounts with Indian digit grouping', () => {
    // 1 Lakh = 1,00,000
    const formatted = formatCurrency(100000);
    expect(formatted).toBe('₹1,00,000');
  });

  it('formats small amounts correctly', () => {
    expect(formatCurrency(450)).toBe('₹450');
    expect(formatCurrency(99.5)).toBe('₹99.50');
  });

  it('formats large crore amounts with compact notation', () => {
    const formatted = formatCurrency(15000000, { compact: true });
    expect(formatted).toBe('₹1.50 Cr');
  });

  it('formats lakh amounts with compact notation', () => {
    const formatted = formatCurrency(250000, { compact: true });
    expect(formatted).toBe('₹2.50 L');
  });

  it('formats zero and negative amounts properly', () => {
    expect(formatCurrency(0)).toBe('₹0');
    expect(formatCurrency(-500)).toContain('500');
  });
});

describe('formatDate', () => {
  it('formats ISO date strings', () => {
    expect(formatDate('2026-11-15T12:00:00.000Z')).toBe('15 Nov 2026');
  });

  it('formats relative dates accurately for today, past, and future dates', () => {
    // A future date should NOT be formatted as "EEE, d MMM"
    const futureDate = '2028-11-15T12:00:00.000Z';
    const formattedFuture = formatRelativeDate(futureDate);
    expect(formattedFuture).toContain('2028');
  });
});

describe('formatPercentage', () => {
  it('formats percentages with optional sign', () => {
    expect(formatPercentage(12.345)).toBe('12.3%');
    expect(formatPercentage(5.5, { includeSign: true })).toBe('+5.5%');
    expect(formatPercentage(-3.2, { includeSign: true })).toBe('-3.2%');
  });
});
