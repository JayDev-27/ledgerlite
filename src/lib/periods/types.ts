export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'half-year' | 'year' | 'custom';

export interface PeriodRange {
  type: PeriodType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string; // Human readable, e.g. "November 2026" or "Q3 FY26–27"
  shortLabel: string; // e.g. "Nov 2026", "Q3", "FY26–27"
  metadata?: {
    quarter?: number;
    halfYear?: number;
    financialYearLabel?: string;
    year?: number;
    month?: number; // 1-12
  };
}

export interface PeriodEngineOptions {
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday (default 1)
  financialYearStartMonth?: number; // 1 = January, 4 = April (default 4)
  referenceDate?: Date | string; // Reference date for current period
  customStartDate?: string;
  customEndDate?: string;
}

export interface MetricComparison {
  current: number;
  previous: number;
  delta: number;
  percentChange: number;
  trend: 'up' | 'down' | 'flat';
}
