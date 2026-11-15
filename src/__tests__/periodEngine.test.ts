import { describe, it, expect } from 'vitest';
import {
  getPeriodRange,
  getPreviousPeriod,
  getNextPeriod,
  calculateComparison,
  getFinancialYear,
  getQuarterRange,
  getHalfYearRange,
} from '@/lib/periods';

describe('Financial Period Engine', () => {
  describe('Week Calculations', () => {
    // 2026-11-11 is a Wednesday
    const refDate = '2026-11-11';

    it('calculates week starting on Monday by default', () => {
      const range = getPeriodRange('week', { referenceDate: refDate, weekStartsOn: 1 });
      expect(range.startDate).toBe('2026-11-09'); // Monday
      expect(range.endDate).toBe('2026-11-15'); // Sunday
    });

    it('calculates week starting on Sunday when configured', () => {
      const range = getPeriodRange('week', { referenceDate: refDate, weekStartsOn: 0 });
      expect(range.startDate).toBe('2026-11-08'); // Sunday
      expect(range.endDate).toBe('2026-11-14'); // Saturday
    });

    it('computes exact previous week', () => {
      const current = getPeriodRange('week', { referenceDate: refDate, weekStartsOn: 1 });
      const previous = getPreviousPeriod(current, { weekStartsOn: 1 });
      expect(previous.startDate).toBe('2026-11-02');
      expect(previous.endDate).toBe('2026-11-08');
    });

    it('computes exact next week', () => {
      const current = getPeriodRange('week', { referenceDate: refDate, weekStartsOn: 1 });
      const next = getNextPeriod(current, { weekStartsOn: 1 });
      expect(next.startDate).toBe('2026-11-16');
      expect(next.endDate).toBe('2026-11-22');
    });
  });

  describe('Month Calculations', () => {
    it('calculates full calendar month boundaries', () => {
      const range = getPeriodRange('month', { referenceDate: '2026-11-15' });
      expect(range.startDate).toBe('2026-11-01');
      expect(range.endDate).toBe('2026-11-30');
      expect(range.label).toBe('November 2026');
    });

    it('handles February in leap and non-leap years', () => {
      // 2028 is a leap year (29 days)
      const leapFeb = getPeriodRange('month', { referenceDate: '2028-02-10' });
      expect(leapFeb.startDate).toBe('2028-02-01');
      expect(leapFeb.endDate).toBe('2028-02-29');

      // 2026 is non-leap (28 days)
      const normalFeb = getPeriodRange('month', { referenceDate: '2026-02-10' });
      expect(normalFeb.startDate).toBe('2026-02-01');
      expect(normalFeb.endDate).toBe('2026-02-28');
    });

    it('computes previous month across calendar year boundary', () => {
      const jan = getPeriodRange('month', { referenceDate: '2027-01-15' });
      const dec = getPreviousPeriod(jan);
      expect(dec.startDate).toBe('2026-12-01');
      expect(dec.endDate).toBe('2026-12-31');
    });
  });

  describe('Financial Year & Quarters (April Start)', () => {
    it('determines Indian financial year (April start)', () => {
      // November 2026 is in FY26–27
      const fyNov = getFinancialYear('2026-11-15', 4);
      expect(fyNov.startYear).toBe(2026);
      expect(fyNov.endYear).toBe(2027);
      expect(fyNov.startDate).toBe('2026-04-01');
      expect(fyNov.endDate).toBe('2027-03-31');
      expect(fyNov.label).toBe('FY26–27');

      // February 2027 is still in FY26–27
      const fyFeb = getFinancialYear('2027-02-10', 4);
      expect(fyFeb.startYear).toBe(2026);
      expect(fyFeb.endYear).toBe(2027);
      expect(fyFeb.startDate).toBe('2026-04-01');
      expect(fyFeb.endDate).toBe('2027-03-31');
      expect(fyFeb.label).toBe('FY26–27');
    });

    it('determines Q1, Q2, Q3, Q4 for April financial year', () => {
      // May 2026 -> Q1
      const q1 = getQuarterRange('2026-05-15', 4);
      expect(q1.metadata?.quarter).toBe(1);
      expect(q1.startDate).toBe('2026-04-01');
      expect(q1.endDate).toBe('2026-06-30');
      expect(q1.shortLabel).toBe('Q1 FY26–27');

      // August 2026 -> Q2
      const q2 = getQuarterRange('2026-08-15', 4);
      expect(q2.metadata?.quarter).toBe(2);
      expect(q2.startDate).toBe('2026-07-01');
      expect(q2.endDate).toBe('2026-09-30');
      expect(q2.shortLabel).toBe('Q2 FY26–27');

      // November 2026 -> Q3
      const q3 = getQuarterRange('2026-11-15', 4);
      expect(q3.metadata?.quarter).toBe(3);
      expect(q3.startDate).toBe('2026-10-01');
      expect(q3.endDate).toBe('2026-12-31');
      expect(q3.shortLabel).toBe('Q3 FY26–27');

      // February 2027 -> Q4
      const q4 = getQuarterRange('2027-02-15', 4);
      expect(q4.metadata?.quarter).toBe(4);
      expect(q4.startDate).toBe('2027-01-01');
      expect(q4.endDate).toBe('2027-03-31');
      expect(q4.shortLabel).toBe('Q4 FY26–27');
    });

    it('determines Half-years H1 and H2 for April financial year', () => {
      // July 2026 -> H1
      const h1 = getHalfYearRange('2026-07-15', 4);
      expect(h1.metadata?.halfYear).toBe(1);
      expect(h1.startDate).toBe('2026-04-01');
      expect(h1.endDate).toBe('2026-09-30');
      expect(h1.shortLabel).toBe('H1 FY26–27');

      // November 2026 -> H2
      const h2 = getHalfYearRange('2026-11-15', 4);
      expect(h2.metadata?.halfYear).toBe(2);
      expect(h2.startDate).toBe('2026-10-01');
      expect(h2.endDate).toBe('2027-03-31');
      expect(h2.shortLabel).toBe('H2 FY26–27');
    });

    it('navigates previous quarter across financial year boundary', () => {
      // Q1 FY26–27 previous is Q4 FY25–26
      const q1 = getQuarterRange('2026-04-15', 4);
      const prevQuarter = getPreviousPeriod(q1, { financialYearStartMonth: 4 });
      expect(prevQuarter.metadata?.quarter).toBe(4);
      expect(prevQuarter.startDate).toBe('2026-01-01');
      expect(prevQuarter.endDate).toBe('2026-03-31');
      expect(prevQuarter.shortLabel).toBe('Q4 FY25–26');
    });

    it('supports January calendar financial year if configured', () => {
      const fy = getFinancialYear('2026-07-15', 1);
      expect(fy.startDate).toBe('2026-01-01');
      expect(fy.endDate).toBe('2026-12-31');
      expect(fy.label).toBe('FY2026');

      const q3 = getQuarterRange('2026-07-15', 1);
      expect(q3.metadata?.quarter).toBe(3);
      expect(q3.startDate).toBe('2026-07-01');
      expect(q3.endDate).toBe('2026-09-30');
    });

    it('correctly handles boundary dates like April 1st without timezone regression', () => {
      // First day of Indian FY
      const fyApr1 = getFinancialYear('2026-04-01', 4);
      expect(fyApr1.startYear).toBe(2026);
      expect(fyApr1.endYear).toBe(2027);
      expect(fyApr1.label).toBe('FY26–27');

      const q1Apr1 = getQuarterRange('2026-04-01', 4);
      expect(q1Apr1.metadata?.quarter).toBe(1);
      expect(q1Apr1.startDate).toBe('2026-04-01');
      expect(q1Apr1.endDate).toBe('2026-06-30');
      expect(q1Apr1.shortLabel).toBe('Q1 FY26–27');

      // Last day of preceding Indian FY (March 31)
      const fyMar31 = getFinancialYear('2026-03-31', 4);
      expect(fyMar31.startYear).toBe(2025);
      expect(fyMar31.endYear).toBe(2026);
      expect(fyMar31.label).toBe('FY25–26');

      const q4Mar31 = getQuarterRange('2026-03-31', 4);
      expect(q4Mar31.metadata?.quarter).toBe(4);
      expect(q4Mar31.startDate).toBe('2026-01-01');
      expect(q4Mar31.endDate).toBe('2026-03-31');
    });
  });

  describe('Custom Range & Prior Period Matching', () => {
    it('computes exact previous N days for custom range', () => {
      // 10 days: 2026-11-11 to 2026-11-20
      const custom = getPeriodRange('custom', {
        customStartDate: '2026-11-11',
        customEndDate: '2026-11-20',
      });
      expect(custom.startDate).toBe('2026-11-11');
      expect(custom.endDate).toBe('2026-11-20');

      // Previous period should be 10 days immediately preceding: 2026-11-01 to 2026-11-10
      const prev = getPreviousPeriod(custom);
      expect(prev.startDate).toBe('2026-11-01');
      expect(prev.endDate).toBe('2026-11-10');
    });

    it('computes next N days for custom range', () => {
      const custom = getPeriodRange('custom', {
        customStartDate: '2026-11-01',
        customEndDate: '2026-11-10',
      });
      const next = getNextPeriod(custom);
      expect(next.startDate).toBe('2026-11-11');
      expect(next.endDate).toBe('2026-11-20');
    });

    it('handles 1-day custom range formatting and prior period matching', () => {
      const singleDay = getPeriodRange('custom', {
        customStartDate: '2026-11-15',
        customEndDate: '2026-11-15',
      });
      expect(singleDay.startDate).toBe('2026-11-15');
      expect(singleDay.endDate).toBe('2026-11-15');
      expect(singleDay.label).toBe('15 Nov 2026');
      expect(singleDay.shortLabel).toBe('15 Nov');

      const prev = getPreviousPeriod(singleDay);
      expect(prev.startDate).toBe('2026-11-14');
      expect(prev.endDate).toBe('2026-11-14');
      expect(prev.label).toBe('Prior 1d (14 Nov 2026)');
      expect(prev.shortLabel).toBe('14 Nov');

      const next = getNextPeriod(singleDay);
      expect(next.startDate).toBe('2026-11-16');
      expect(next.endDate).toBe('2026-11-16');
      expect(next.label).toBe('Next 1d (16 Nov 2026)');
    });

    it('normalizes custom range if start date is after end date', () => {
      const inverted = getPeriodRange('custom', {
        customStartDate: '2026-11-20',
        customEndDate: '2026-11-11',
      });
      expect(inverted.startDate).toBe('2026-11-11');
      expect(inverted.endDate).toBe('2026-11-20');
    });
  });

  describe('Metric Comparison Calculator', () => {
    it('computes delta and percentage change accurately', () => {
      const comp = calculateComparison(120, 100);
      expect(comp.delta).toBe(20);
      expect(comp.percentChange).toBe(20);
      expect(comp.trend).toBe('up');

      const downComp = calculateComparison(75, 100);
      expect(downComp.delta).toBe(-25);
      expect(downComp.percentChange).toBe(-25);
      expect(downComp.trend).toBe('down');
    });

    it('handles zero previous value safely without NaN or infinity', () => {
      const fromZero = calculateComparison(50, 0);
      expect(fromZero.delta).toBe(50);
      expect(fromZero.percentChange).toBe(100);
      expect(fromZero.trend).toBe('up');

      const zeroZero = calculateComparison(0, 0);
      expect(zeroZero.delta).toBe(0);
      expect(zeroZero.percentChange).toBe(0);
      expect(zeroZero.trend).toBe('flat');
    });
  });
});
