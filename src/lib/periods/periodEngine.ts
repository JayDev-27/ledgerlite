import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  differenceInCalendarDays,
  isToday,
} from 'date-fns';
import { PeriodType, PeriodRange, PeriodEngineOptions } from './types';
import {
  getFinancialYear,
  getQuarterRange,
  getHalfYearRange,
  parseReferenceDate,
} from './financialYear';

export function getPeriodRange(
  type: PeriodType,
  options?: PeriodEngineOptions
): PeriodRange {
  const refDate = parseReferenceDate(options?.referenceDate);
  const weekStartsOn = options?.weekStartsOn ?? 1;
  const fyStartMonth = options?.financialYearStartMonth ?? 4;

  switch (type) {
    case 'day': {
      const dateStr = format(refDate, 'yyyy-MM-dd');
      const isCurrentDay = isToday(refDate);
      return {
        type: 'day',
        startDate: dateStr,
        endDate: dateStr,
        label: isCurrentDay ? `Today (${format(refDate, 'd MMM yyyy')})` : format(refDate, 'd MMM yyyy'),
        shortLabel: format(refDate, 'd MMM'),
        metadata: {
          year: refDate.getFullYear(),
          month: refDate.getMonth() + 1,
        },
      };
    }

    case 'week': {
      const start = startOfWeek(refDate, { weekStartsOn });
      const end = endOfWeek(refDate, { weekStartsOn });
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      const label = `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
      const shortLabel = `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;
      return {
        type: 'week',
        startDate: startStr,
        endDate: endStr,
        label,
        shortLabel,
      };
    }

    case 'month': {
      const start = startOfMonth(refDate);
      const end = endOfMonth(refDate);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      return {
        type: 'month',
        startDate: startStr,
        endDate: endStr,
        label: format(refDate, 'MMMM yyyy'),
        shortLabel: format(refDate, 'MMM yyyy'),
        metadata: {
          year: refDate.getFullYear(),
          month: refDate.getMonth() + 1,
        },
      };
    }

    case 'quarter': {
      return getQuarterRange(refDate, fyStartMonth);
    }

    case 'half-year': {
      return getHalfYearRange(refDate, fyStartMonth);
    }

    case 'year': {
      const fy = getFinancialYear(refDate, fyStartMonth);
      return {
        type: 'year',
        startDate: fy.startDate,
        endDate: fy.endDate,
        label: fy.longLabel,
        shortLabel: fy.label,
        metadata: {
          year: fy.startYear,
          financialYearLabel: fy.label,
        },
      };
    }

    case 'custom': {
      let start = options?.customStartDate || format(refDate, 'yyyy-MM-dd');
      let end = options?.customEndDate || format(refDate, 'yyyy-MM-dd');
      if (start > end) {
        [start, end] = [end, start];
      }
      const startDateObj = parseReferenceDate(start);
      const endDateObj = parseReferenceDate(end);
      const isSingleDay = start === end;
      const label = isSingleDay
        ? format(startDateObj, 'd MMM yyyy')
        : `${format(startDateObj, 'd MMM yyyy')} – ${format(endDateObj, 'd MMM yyyy')}`;
      const shortLabel = isSingleDay
        ? format(startDateObj, 'd MMM')
        : `${format(startDateObj, 'd MMM')} – ${format(endDateObj, 'd MMM')}`;
      return {
        type: 'custom',
        startDate: start,
        endDate: end,
        label,
        shortLabel,
      };
    }
  }
}

/**
 * Calculates the exact preceding period for comparison.
 */
export function getPreviousPeriod(
  period: PeriodRange,
  options?: PeriodEngineOptions
): PeriodRange {
  const weekStartsOn = options?.weekStartsOn ?? 1;
  const fyStartMonth = options?.financialYearStartMonth ?? 4;
  const startDateObj = parseReferenceDate(period.startDate);

  switch (period.type) {
    case 'day': {
      const prevDate = subDays(startDateObj, 1);
      return getPeriodRange('day', { ...options, referenceDate: prevDate });
    }

    case 'week': {
      const prevDate = subWeeks(startDateObj, 1);
      return getPeriodRange('week', { ...options, referenceDate: prevDate, weekStartsOn });
    }

    case 'month': {
      const prevDate = subMonths(startDateObj, 1);
      return getPeriodRange('month', { ...options, referenceDate: prevDate });
    }

    case 'quarter': {
      const prevDate = subMonths(startDateObj, 3);
      return getQuarterRange(prevDate, fyStartMonth);
    }

    case 'half-year': {
      const prevDate = subMonths(startDateObj, 6);
      return getHalfYearRange(prevDate, fyStartMonth);
    }

    case 'year': {
      const prevDate = subYears(startDateObj, 1);
      const fy = getFinancialYear(prevDate, fyStartMonth);
      return {
        type: 'year',
        startDate: fy.startDate,
        endDate: fy.endDate,
        label: fy.longLabel,
        shortLabel: fy.label,
        metadata: {
          year: fy.startYear,
          financialYearLabel: fy.label,
        },
      };
    }

    case 'custom': {
      const endDateObj = parseReferenceDate(period.endDate);
      const dayCount = differenceInCalendarDays(endDateObj, startDateObj) + 1;
      const prevEnd = subDays(startDateObj, 1);
      const prevStart = subDays(prevEnd, dayCount - 1);
      const prevStartStr = format(prevStart, 'yyyy-MM-dd');
      const prevEndStr = format(prevEnd, 'yyyy-MM-dd');
      const isSingleDay = prevStartStr === prevEndStr;
      const rangeLabel = isSingleDay
        ? format(prevStart, 'd MMM yyyy')
        : `${format(prevStart, 'd MMM')} – ${format(prevEnd, 'd MMM yyyy')}`;
      const shortLabel = isSingleDay
        ? format(prevStart, 'd MMM')
        : `${format(prevStart, 'd MMM')} – ${format(prevEnd, 'd MMM')}`;
      return {
        type: 'custom',
        startDate: prevStartStr,
        endDate: prevEndStr,
        label: `Prior ${dayCount}d (${rangeLabel})`,
        shortLabel,
      };
    }
  }
}

/**
 * Calculates the next period (for stepping forward in time).
 */
export function getNextPeriod(
  period: PeriodRange,
  options?: PeriodEngineOptions
): PeriodRange {
  const weekStartsOn = options?.weekStartsOn ?? 1;
  const fyStartMonth = options?.financialYearStartMonth ?? 4;
  const startDateObj = parseReferenceDate(period.startDate);

  switch (period.type) {
    case 'day': {
      const nextDate = addDays(startDateObj, 1);
      return getPeriodRange('day', { ...options, referenceDate: nextDate });
    }

    case 'week': {
      const nextDate = addWeeks(startDateObj, 1);
      return getPeriodRange('week', { ...options, referenceDate: nextDate, weekStartsOn });
    }

    case 'month': {
      const nextDate = addMonths(startDateObj, 1);
      return getPeriodRange('month', { ...options, referenceDate: nextDate });
    }

    case 'quarter': {
      const nextDate = addMonths(startDateObj, 3);
      return getQuarterRange(nextDate, fyStartMonth);
    }

    case 'half-year': {
      const nextDate = addMonths(startDateObj, 6);
      return getHalfYearRange(nextDate, fyStartMonth);
    }

    case 'year': {
      const nextDate = addYears(startDateObj, 1);
      const fy = getFinancialYear(nextDate, fyStartMonth);
      return {
        type: 'year',
        startDate: fy.startDate,
        endDate: fy.endDate,
        label: fy.longLabel,
        shortLabel: fy.label,
        metadata: {
          year: fy.startYear,
          financialYearLabel: fy.label,
        },
      };
    }

    case 'custom': {
      const endDateObj = parseReferenceDate(period.endDate);
      const dayCount = differenceInCalendarDays(endDateObj, startDateObj) + 1;
      const nextStart = addDays(endDateObj, 1);
      const nextEnd = addDays(nextStart, dayCount - 1);
      const nextStartStr = format(nextStart, 'yyyy-MM-dd');
      const nextEndStr = format(nextEnd, 'yyyy-MM-dd');
      const isSingleDay = nextStartStr === nextEndStr;
      const rangeLabel = isSingleDay
        ? format(nextStart, 'd MMM yyyy')
        : `${format(nextStart, 'd MMM')} – ${format(nextEnd, 'd MMM yyyy')}`;
      const shortLabel = isSingleDay
        ? format(nextStart, 'd MMM')
        : `${format(nextStart, 'd MMM')} – ${format(nextEnd, 'd MMM')}`;
      return {
        type: 'custom',
        startDate: nextStartStr,
        endDate: nextEndStr,
        label: `Next ${dayCount}d (${rangeLabel})`,
        shortLabel,
      };
    }
  }
}
