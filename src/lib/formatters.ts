import {
  format,
  parseISO,
  isToday,
  isYesterday,
  differenceInCalendarDays,
} from 'date-fns';
import {
  DEFAULT_CURRENCY,
  DEFAULT_CURRENCY_SYMBOL,
  DEFAULT_LOCALE,
} from '@/constants/app';

/**
 * Format an amount in INR or custom currency with proper Indian digit grouping
 * e.g., ₹1,50,000.00 or ₹450
 */
export function formatCurrency(
  amount: number,
  options?: {
    currency?: string;
    symbol?: string;
    locale?: string;
    hideDecimals?: boolean;
    compact?: boolean;
  }
): string {
  const {
    currency = DEFAULT_CURRENCY,
    symbol = DEFAULT_CURRENCY_SYMBOL,
    locale = DEFAULT_LOCALE,
    hideDecimals = false,
    compact = false,
  } = options || {};

  if (compact && Math.abs(amount) >= 10000000) {
    // 1 Crore = 10 Million
    const cr = amount / 10000000;
    return `${symbol}${cr.toFixed(2)} Cr`;
  }
  if (compact && Math.abs(amount) >= 100000) {
    // 1 Lakh = 100 Thousand
    const lk = amount / 100000;
    return `${symbol}${lk.toFixed(2)} L`;
  }

  try {
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: hideDecimals || Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);

    return `${symbol}${formattedNumber}`;
  } catch {
    // Fallback if locale is unsupported
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format ISO date string into human readable date
 */
export function formatDate(
  isoDateString: string,
  formatStr = 'dd MMM yyyy'
): string {
  try {
    const date = parseISO(isoDateString);
    return format(date, formatStr);
  } catch {
    return isoDateString;
  }
}

/**
 * Format date with friendly relative label if today or yesterday
 */
export function formatRelativeDate(isoDateString: string): string {
  try {
    const date = parseISO(isoDateString);
    const hasTime = isoDateString.includes('T') && !isoDateString.endsWith('T00:00:00.000Z');

    if (isToday(date)) {
      return hasTime ? `Today, ${format(date, 'h:mm a')}` : 'Today';
    }
    if (isYesterday(date)) {
      return hasTime ? `Yesterday, ${format(date, 'h:mm a')}` : 'Yesterday';
    }
    const daysDiff = differenceInCalendarDays(new Date(), date);
    // Relative day name strictly for recent past 2 to 6 days
    if (daysDiff >= 2 && daysDiff < 7) {
      return format(date, 'EEE, d MMM');
    }
    return format(date, 'd MMM yyyy');
  } catch {
    return isoDateString;
  }
}

/**
 * Format a percentage with optional sign
 */
export function formatPercentage(
  value: number,
  options?: { includeSign?: boolean; decimals?: number }
): string {
  const { includeSign = false, decimals = 1 } = options || {};
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}
