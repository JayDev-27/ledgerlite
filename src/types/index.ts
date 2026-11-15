/**
 * Core domain types for LedgerLite
 * Strict types representing all Dexie models, repository contracts, and app state
 */

export type CategoryType = 'need' | 'want' | 'savings';

export type PaymentMethod = 'upi' | 'card' | 'cash' | 'net_banking' | 'wallet';

export type TransactionSource = 'manual' | 'quick_add' | 'csv' | 'recurring' | 'ai';

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  type: CategoryType;
  color: string;
  icon: string;
  order?: number;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  date: string; // ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
  merchant: string;
  categoryId: string;
  subcategoryId?: string | null;
  paymentMethod: PaymentMethod;
  notes?: string;
  tags: string[];
  recurringId?: string | null;
  source: TransactionSource;
  confidence?: number; // 0.0 to 1.0 (for AI classification)
  receiptImage?: string | null; // local base64 or blob URL
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  month: string; // YYYY-MM format
  totalLimit: number;
  categoryLimits: Record<string, number>; // categoryId -> limit amount
  rollover: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type RuleMatcherOperator = 'exact' | 'contains' | 'regex' | 'startsWith';

export interface RuleMatcher {
  field: 'merchant' | 'notes';
  operator: RuleMatcherOperator;
  value: string;
}

export interface Rule {
  id: string;
  matcher: RuleMatcher | string; // RuleMatcher or string pattern
  categoryId: string;
  subcategoryId?: string | null;
  hits: number;
  createdAt: string;
}

export type RecurringCadence = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringTemplate {
  amount: number;
  currency: string;
  merchant: string;
  categoryId: string;
  subcategoryId?: string | null;
  paymentMethod: PaymentMethod;
  notes?: string;
  tags?: string[];
}

export interface RecurringExpense {
  id: string;
  template: RecurringTemplate;
  cadence: RecurringCadence;
  nextDue: string; // YYYY-MM-DD
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MemoryKind = 'goal' | 'preference' | 'income' | 'recurring_fact' | 'note';

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  text: string;
  embedding?: number[];
  createdAt: string;
  approvedAt?: string | null; // null if proposed by AI and pending approval
}

export interface ReportItem {
  id: string;
  period: string; // e.g. 'month-2026-11' or 'FY-2026-Q3'
  spec: {
    title: string;
    startDate: string;
    endDate: string;
    totalSpend: number;
    totalSavings?: number;
    categoryBreakdown: Record<string, number>;
    summaryNarrative?: string;
    recommendations?: string[];
    anomalies?: Array<{ merchant: string; amount: number; reason: string }>;
    rawPack?: Record<string, unknown>;
    periodType?: string;
    periodLabel?: string;
    pack?: unknown;
    content?: unknown;
  };
  createdAt: string;
}

export interface AiUsageRecord {
  id?: number;
  day: string; // YYYY-MM-DD
  model: string;
  count: number;
}

export interface SettingItem {
  key: string;
  value: string | number | boolean | object;
}

// User App Settings
export interface AppSettings {
  currency: string;
  currencySymbol: string;
  locale: string;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  financialYearStartMonth: number; // 1 = January, 4 = April
  theme: 'light' | 'dark' | 'system';
  privacyMode: boolean; // default true: strip sensitive fields before AI calls
  geminiApiKey?: string;
  geminiHeavyModel: string;
  geminiLightModel: string;
  dailyAiBudget: number; // Daily request limit (combined/legacy)
  dailyAiBudgetHeavy?: number; // Heavy model daily limit (e.g. 20)
  dailyAiBudgetLight?: number; // Light model daily limit (e.g. 200)
  storagePersisted: boolean;
  hasCompletedSeed: boolean;
  lastBackupDate?: string;
  dismissedBackupReminderUntil?: string;
}
