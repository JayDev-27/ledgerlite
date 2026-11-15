import type {
  Transaction,
  Category,
  Budget,
  Rule,
  RecurringExpense,
  MemoryItem,
  ReportItem,
  AiUsageRecord,
  PaymentMethod,
} from '@/types';

export interface TransactionFilter {
  search?: string;
  startDate?: string;
  endDate?: string;
  categoryIds?: string[];
  subcategoryId?: string;
  paymentMethods?: PaymentMethod[];
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
  recurringOnly?: boolean;
  needsReviewOnly?: boolean;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  sortBy?: keyof Transaction;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Repository {
  // Transactions
  getTransactions(filter?: TransactionFilter, pagination?: PaginationOptions): Promise<PaginatedResult<Transaction>>;
  getAllTransactions(): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByDateRange(startDate: string, endDate: string): Promise<Transaction[]>;
  createTransaction(tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  bulkDeleteTransactions(ids: string[]): Promise<void>;
  bulkUpdateTransactions(ids: string[], updates: Partial<Transaction>): Promise<void>;
  restoreTransaction(tx: Transaction): Promise<void>;
  bulkCreateTransactions(txs: Array<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }>): Promise<Transaction[]>;
  countTransactions(): Promise<number>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: Category): Promise<Category>;
  updateCategory(id: string, updates: Partial<Category>): Promise<Category>;
  deleteCategory(id: string, reassignToId?: string): Promise<void>;
  mergeCategories(sourceId: string, targetId: string): Promise<void>;
  bulkCreateCategories(categories: Category[]): Promise<void>;

  // Budgets
  getBudgets(): Promise<Budget[]>;
  getBudgetForMonth(month: string): Promise<Budget | undefined>;
  setBudget(budget: Budget): Promise<Budget>;
  deleteBudget(id: string): Promise<void>;

  // Rules
  getRules(): Promise<Rule[]>;
  createRule(rule: Omit<Rule, 'id' | 'createdAt' | 'hits'> & { id?: string }): Promise<Rule>;
  incrementRuleHit(id: string): Promise<void>;
  deleteRule(id: string): Promise<void>;
  findMatchingRule(merchant: string): Promise<Rule | undefined>;

  // Recurring
  getRecurring(): Promise<RecurringExpense[]>;
  createRecurring(item: Omit<RecurringExpense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<RecurringExpense>;
  updateRecurring(id: string, updates: Partial<RecurringExpense>): Promise<RecurringExpense>;
  deleteRecurring(id: string): Promise<void>;

  // Memory
  getMemoryItems(approvedOnly?: boolean): Promise<MemoryItem[]>;
  createMemoryItem(item: Omit<MemoryItem, 'id' | 'createdAt'> & { id?: string }): Promise<MemoryItem>;
  updateMemoryItem(id: string, updates: Partial<MemoryItem>): Promise<MemoryItem>;
  approveMemoryItem(id: string): Promise<void>;
  deleteMemoryItem(id: string): Promise<void>;

  // Reports
  getReports(): Promise<ReportItem[]>;
  getReport(id: string): Promise<ReportItem | undefined>;
  saveReport(report: ReportItem): Promise<ReportItem>;
  deleteReport(id: string): Promise<void>;

  // AI Usage
  getAiUsageToday(day: string): Promise<AiUsageRecord[]>;
  incrementAiUsage(day: string, model: string): Promise<number>;

  // Settings
  getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  setSetting<T>(key: string, value: T): Promise<void>;
  getAllSettings(): Promise<Record<string, unknown>>;

  // Lifecycle & Backup
  clearAll(): Promise<void>;
  isDatabaseEmpty(): Promise<boolean>;
  exportAll(): Promise<Record<string, unknown>>;
  importAll(data: Record<string, unknown>): Promise<void>;
}
