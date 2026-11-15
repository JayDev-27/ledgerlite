export type BudgetStatus = 'on-track' | 'at-risk' | 'over';

export interface BudgetAlert {
  id: string;
  level: 'info' | 'warning' | 'danger';
  threshold: 50 | 80 | 100;
  scope: 'overall' | 'category';
  categoryId?: string;
  categoryName?: string;
  message: string;
  spent: number;
  limit: number;
  percentUsed: number;
}

export interface CategoryBudgetMetrics {
  categoryId: string;
  categoryName: string;
  type: 'need' | 'want' | 'savings';
  color: string;
  baseLimit: number;
  rolloverAmount: number;
  effectiveLimit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  status: BudgetStatus;
  alerts: BudgetAlert[];
}

export interface BudgetPaceMetrics {
  month: string; // YYYY-MM
  baseLimit: number;
  rolloverAmount: number;
  effectiveLimit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  totalDays: number;
  daysElapsed: number;
  daysLeft: number;
  burnRate: number; // spend / daysElapsed
  safeToSpendPerDay: number; // remaining / daysLeft (0 if over or daysLeft is 0)
  projectedMonthEndSpend: number; // spent + (burnRate * daysLeft)
  projectedVariance: number; // projectedMonthEndSpend - effectiveLimit
  status: BudgetStatus;
  alerts: BudgetAlert[];
  categories: CategoryBudgetMetrics[];
}

export interface CumulativeDayPoint {
  day: number;
  date: string; // YYYY-MM-DD
  actualCumulative?: number; // undefined for future days
  dailySpend: number;
  idealCumulative: number;
  projectedCumulative?: number; // projected line from current day onwards
}

export interface BudgetSuggestionItem {
  categoryId: string;
  categoryName: string;
  categoryType: 'need' | 'want' | 'savings';
  threeMonthAverage: number;
  proposedLimit: number;
  reason: string;
}

export interface BudgetSuggestionResult {
  month: string;
  totalLimit: number;
  categoryLimits: Record<string, number>;
  items: BudgetSuggestionItem[];
  rationale: string;
  needPercent: number;
  wantPercent: number;
  savingsPercent: number;
  isAiGenerated: boolean;
}
