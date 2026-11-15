import type {
  Transaction,
  Category,
  Budget,
  Rule,
  RecurringExpense,
  MemoryItem,
  ReportItem,
  AiUsageRecord,
  SettingItem,
} from '@/types';

export interface BackupTables {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  rules: Rule[];
  recurring: RecurringExpense[];
  memory: MemoryItem[];
  reports: ReportItem[];
  aiUsage: AiUsageRecord[];
  settings: SettingItem[];
}

export interface BackupPayload extends BackupTables {
  version: number;
  appName: string;
  exportedAt: string;
}

export interface BackupSummary {
  transactionsCount: number;
  categoriesCount: number;
  budgetsCount: number;
  rulesCount: number;
  recurringCount: number;
  memoryCount: number;
  reportsCount: number;
  aiUsageCount: number;
  settingsCount: number;
  exportedAt?: string;
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  summary?: BackupSummary;
}
