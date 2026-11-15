import type {
  Transaction,
  Category,
  Budget,
  RecurringExpense,
  CategoryType,
  PaymentMethod,
} from '@/types';
import type { PeriodRange, PeriodType } from '@/lib/periods/types';

export interface AnomalyTransaction {
  id: string;
  transactionId: string;
  date: string;
  merchant: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  reason: string;
  rule: 'statistical_deviation' | 'category_multiple' | 'first_time_high_value';
  severity: 'medium' | 'high';
}

export interface PeriodPackKpiItem {
  current: number;
  previous?: number;
  delta?: number;
  percentChange?: number;
  trend?: 'up' | 'down' | 'flat';
}

export interface PeriodPackKpis {
  totalSpend: PeriodPackKpiItem;
  transactionCount: PeriodPackKpiItem;
  dailyAverage: PeriodPackKpiItem;
  daysInPeriod: number;
  largestExpense?: {
    merchant: string;
    amount: number;
    date: string;
    categoryName: string;
  };
}

export interface CategoryBreakdownSubitem {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  color: string;
  icon: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  budgetLimit?: number;
  variance?: number; // budgetLimit - amount (positive: under budget, negative: over budget)
  percentUsed?: number;
  subcategories: CategoryBreakdownSubitem[];
}

export interface NeedWantSavingsSplitItem {
  amount: number;
  percentage: number;
  targetPercentage: number;
}

export interface NeedWantSavingsSummary {
  need: NeedWantSavingsSplitItem;
  want: NeedWantSavingsSplitItem;
  savings: NeedWantSavingsSplitItem;
  totalTracked: number;
}

export interface CategoryBudgetStatus {
  categoryId: string;
  categoryName: string;
  limit: number;
  spent: number;
  variance: number;
  percentUsed: number;
}

export interface BudgetStatusSummary {
  hasBudget: boolean;
  month?: string;
  totalLimit: number;
  totalSpent: number;
  variance: number; // totalLimit - totalSpent
  percentUsed: number;
  projectedEnd: number;
  status: 'on_track' | 'warning' | 'exceeded';
  categoryBudgets: CategoryBudgetStatus[];
}

export interface TopMerchantSummary {
  merchant: string;
  amount: number;
  count: number;
  percentage: number;
  categoryId: string;
  categoryName: string;
}

export interface PaymentMethodSummary {
  method: PaymentMethod;
  label: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface RecurringIncurredItem {
  id: string;
  merchant: string;
  amount: number;
  cadence: string;
  categoryName: string;
  nextDue?: string;
}

export interface RecurringPeriodSummary {
  totalRecurringSpend: number;
  percentageOfTotal: number;
  activeCount: number;
  incurredCount: number;
  items: RecurringIncurredItem[];
}

export interface DailySpendPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "15 Nov"
  amount: number;
  count: number;
}

export interface PeriodPack {
  periodRange: PeriodRange;
  generatedAt: string;
  kpis: PeriodPackKpis;
  categoryBreakdown: CategoryBreakdownItem[];
  distribution50_30_20: NeedWantSavingsSummary;
  budgetStatus: BudgetStatusSummary;
  topMerchants: TopMerchantSummary[];
  paymentMethods: PaymentMethodSummary[];
  recurringSummary: RecurringPeriodSummary;
  anomalies: AnomalyTransaction[];
  dailyTrend: DailySpendPoint[];
}

export interface PeriodPackOptions {
  transactions: Transaction[];
  priorTransactions?: Transaction[];
  historicalTransactions?: Transaction[];
  categories: Category[];
  budgets?: Budget[];
  recurring?: RecurringExpense[];
  periodRange: PeriodRange;
}

export interface ReportContent {
  title: string;
  executiveSummary: string; // 2-3 paragraphs
  narrativeInsights: string[]; // 4-6 analytical points
  anomaliesAnalysis: string[]; // analysis of spikes
  recommendations: string[]; // 3-5 concrete actionable recommendations
  generatedBy: 'ai' | 'template';
  modelName?: string;
  footnote: string;
}

export interface ReportRecord {
  id: string;
  period: string; // unique key e.g. 'month-2026-11' or custom ID
  title: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  createdAt: string;
  pack: PeriodPack;
  content: ReportContent;
}
