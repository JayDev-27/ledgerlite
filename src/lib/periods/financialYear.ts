import { format, parseISO, lastDayOfMonth } from 'date-fns';
import { PeriodRange } from './types';

export interface FinancialYearInfo {
  startYear: number;
  endYear: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string; // "FY26–27" or "FY2026"
  longLabel: string; // "FY 2026–2027"
}

export function todayInIndia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', dateStyle: 'short' }).format(new Date());
}

export function parseReferenceDate(ref?: Date | string): Date {
  if (!ref) return new Date();
  if (typeof ref === 'string') {
    // If it's a date-only string or ISO string, extract calendar components
    // and use midday local time to eliminate UTC offset shifts across all timezones
    const match = ref.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1]!, 10);
      const month = parseInt(match[2]!, 10) - 1;
      const day = parseInt(match[3]!, 10);
      return new Date(year, month, day, 12, 0, 0);
    }
    return parseISO(ref);
  }
  return ref;
}

/**
 * Returns financial year boundaries for a given date and FY start month (1-12, default 4).
 */
export function getFinancialYear(
  refDate: Date | string,
  startMonth = 4
): FinancialYearInfo {
  const date = parseReferenceDate(refDate);
  const month = date.getMonth() + 1; // 1-12
  const calYear = date.getFullYear();

  let startYear: number;
  let endYear: number;

  if (startMonth === 1) {
    startYear = calYear;
    endYear = calYear;
  } else if (month >= startMonth) {
    startYear = calYear;
    endYear = calYear + 1;
  } else {
    startYear = calYear - 1;
    endYear = calYear;
  }

  const startMonthStr = String(startMonth).padStart(2, '0');
  const startDate = `${startYear}-${startMonthStr}-01`;

  // Calculate end date: last day of month before startMonth in endYear
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endMonthStr = String(endMonth).padStart(2, '0');
  const endMonthDate = parseReferenceDate(`${endYear}-${endMonthStr}-01`);
  const lastDay = format(lastDayOfMonth(endMonthDate), 'dd');
  const endDate = `${endYear}-${endMonthStr}-${lastDay}`;

  const label =
    startMonth === 1
      ? `FY${startYear}`
      : `FY${String(startYear).slice(-2)}–${String(endYear).slice(-2)}`;

  const longLabel =
    startMonth === 1 ? `FY ${startYear}` : `FY ${startYear}–${endYear}`;

  return {
    startYear,
    endYear,
    startDate,
    endDate,
    label,
    longLabel,
  };
}

/**
 * Returns quarter boundaries for a given date and FY start month.
 */
export function getQuarterRange(
  refDate: Date | string,
  startMonth = 4
): PeriodRange {
  const date = parseReferenceDate(refDate);
  const fy = getFinancialYear(date, startMonth);
  const month = date.getMonth() + 1;

  // Month offset relative to start of financial year (0 to 11)
  const offset = (month - startMonth + 12) % 12;
  const quarter = Math.floor(offset / 3) + 1; // 1, 2, 3, or 4

  // Start month index of the quarter (0 to 11 relative to FY start)
  const qStartOffset = (quarter - 1) * 3;
  const qEndOffset = qStartOffset + 2;

  // Convert to calendar month and year
  const getCalMonthYear = (offsetMonths: number) => {
    const rawMonth = startMonth + offsetMonths;
    if (rawMonth <= 12) {
      return { year: fy.startYear, month: rawMonth };
    }
    return { year: fy.endYear, month: rawMonth - 12 };
  };

  const startCal = getCalMonthYear(qStartOffset);
  const endCal = getCalMonthYear(qEndOffset);

  const startMonthStr = String(startCal.month).padStart(2, '0');
  const startDate = `${startCal.year}-${startMonthStr}-01`;

  const endMonthStr = String(endCal.month).padStart(2, '0');
  const endMonthDate = parseReferenceDate(`${endCal.year}-${endMonthStr}-01`);
  const endLastDay = format(lastDayOfMonth(endMonthDate), 'dd');
  const endDate = `${endCal.year}-${endMonthStr}-${endLastDay}`;

  const shortLabel = `Q${quarter} ${fy.label}`;
  const label = `Quarter ${quarter} (${fy.label})`;

  return {
    type: 'quarter',
    startDate,
    endDate,
    label,
    shortLabel,
    metadata: {
      quarter,
      financialYearLabel: fy.label,
      year: fy.startYear,
    },
  };
}

/**
 * Returns half-year boundaries for a given date and FY start month.
 */
export function getHalfYearRange(
  refDate: Date | string,
  startMonth = 4
): PeriodRange {
  const date = parseReferenceDate(refDate);
  const fy = getFinancialYear(date, startMonth);
  const month = date.getMonth() + 1;

  const offset = (month - startMonth + 12) % 12;
  const halfYear = offset < 6 ? 1 : 2;

  const getCalMonthYear = (offsetMonths: number) => {
    const rawMonth = startMonth + offsetMonths;
    if (rawMonth <= 12) {
      return { year: fy.startYear, month: rawMonth };
    }
    return { year: fy.endYear, month: rawMonth - 12 };
  };

  const startOffset = halfYear === 1 ? 0 : 6;
  const endOffset = halfYear === 1 ? 5 : 11;

  const startCal = getCalMonthYear(startOffset);
  const endCal = getCalMonthYear(endOffset);

  const startMonthStr = String(startCal.month).padStart(2, '0');
  const startDate = `${startCal.year}-${startMonthStr}-01`;

  const endMonthStr = String(endCal.month).padStart(2, '0');
  const endMonthDate = parseReferenceDate(`${endCal.year}-${endMonthStr}-01`);
  const endLastDay = format(lastDayOfMonth(endMonthDate), 'dd');
  const endDate = `${endCal.year}-${endMonthStr}-${endLastDay}`;

  const shortLabel = `H${halfYear} ${fy.label}`;
  const label = `Half Year ${halfYear} (${fy.label})`;

  return {
    type: 'half-year',
    startDate,
    endDate,
    label,
    shortLabel,
    metadata: {
      halfYear,
      financialYearLabel: fy.label,
      year: fy.startYear,
    },
  };
}
