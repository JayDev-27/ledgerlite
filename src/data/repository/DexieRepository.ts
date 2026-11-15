import { FinanceDatabase, db as defaultDb } from '@/data/db';
import type {
  Transaction,
  Category,
  Budget,
  Rule,
  RecurringExpense,
  MemoryItem,
  ReportItem,
  AiUsageRecord,
  RuleMatcher,
} from '@/types';
import type {
  Repository,
  TransactionFilter,
  PaginationOptions,
  PaginatedResult,
} from './types';

export class DexieRepository implements Repository {
  private db: FinanceDatabase;

  constructor(database: FinanceDatabase = defaultDb) {
    this.db = database;
  }

  // -------------------------------------------------------------
  // TRANSACTIONS
  // -------------------------------------------------------------

  async getTransactions(
    filter?: TransactionFilter,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Transaction>> {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 50;
    const offset = (page - 1) * pageSize;
    const sortBy = pagination?.sortBy ?? 'date';
    const sortDirection = pagination?.sortDirection ?? 'desc';

    const hasComplexFilter =
      filter &&
      (filter.categoryIds?.length ||
        filter.subcategoryId ||
        filter.paymentMethods?.length ||
        filter.minAmount !== undefined ||
        filter.maxAmount !== undefined ||
        filter.recurringOnly ||
        filter.tags?.length ||
        (filter.search && filter.search.trim().length > 0));

    // Fast path: Indexed queries for 20,000+ transactions without in-memory allocation
    if (!hasComplexFilter && sortBy === 'date') {
      let query;
      if (filter?.startDate && filter?.endDate) {
        query = this.db.transactions
          .where('date')
          .between(filter.startDate, filter.endDate, true, true);
      } else if (filter?.startDate) {
        query = this.db.transactions.where('date').aboveOrEqual(filter.startDate);
      } else if (filter?.endDate) {
        query = this.db.transactions.where('date').belowOrEqual(filter.endDate);
      } else {
        query = this.db.transactions.orderBy('date');
      }

      const total = await query.count();
      const directedQuery = sortDirection === 'desc' ? query.reverse() : query;
      const data = await directedQuery.offset(offset).limit(pageSize).toArray();

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      };
    }

    // Secondary path: In-memory filter pipeline for combined multi-field criteria
    let collection = this.db.transactions.toCollection();
    let items = await collection.toArray();

    if (filter) {
      if (filter.startDate) {
        items = items.filter((tx) => tx.date >= filter.startDate!);
      }
      if (filter.endDate) {
        items = items.filter((tx) => tx.date <= filter.endDate!);
      }
      if (filter.categoryIds && filter.categoryIds.length > 0) {
        const catSet = new Set(filter.categoryIds);
        items = items.filter((tx) => catSet.has(tx.categoryId));
      }
      if (filter.subcategoryId) {
        items = items.filter((tx) => tx.subcategoryId === filter.subcategoryId);
      }
      if (filter.paymentMethods && filter.paymentMethods.length > 0) {
        const methodSet = new Set(filter.paymentMethods);
        items = items.filter((tx) => methodSet.has(tx.paymentMethod));
      }
      if (filter.minAmount !== undefined) {
        items = items.filter((tx) => tx.amount >= filter.minAmount!);
      }
      if (filter.maxAmount !== undefined) {
        items = items.filter((tx) => tx.amount <= filter.maxAmount!);
      }
      if (filter.recurringOnly) {
        items = items.filter((tx) => !!tx.recurringId);
      }
      if (filter.tags && filter.tags.length > 0) {
        items = items.filter((tx) =>
          filter.tags!.some((t) => tx.tags.includes(t))
        );
      }
      if (filter.search && filter.search.trim().length > 0) {
        const query = filter.search.toLowerCase().trim();
        items = items.filter(
          (tx) =>
            tx.merchant.toLowerCase().includes(query) ||
            (tx.notes && tx.notes.toLowerCase().includes(query)) ||
            tx.tags.some((t) => t.toLowerCase().includes(query)) ||
            tx.amount.toString().includes(query)
        );
      }
    }

    const total = items.length;

    // Sorting
    items.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA);
      const strB = String(valB);
      return sortDirection === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });

    const paginatedItems = items.slice(offset, offset + pageSize);

    return {
      data: paginatedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return this.db.transactions.orderBy('date').reverse().toArray();
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.db.transactions.get(id);
  }

  async getTransactionsByDateRange(
    startDate: string,
    endDate: string
  ): Promise<Transaction[]> {
    return this.db.transactions
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  async createTransaction(
    tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Transaction> {
    const now = new Date().toISOString();
    const newTx: Transaction = {
      ...tx,
      id: tx.id ?? crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await this.db.transactions.add(newTx);
    return newTx;
  }

  async updateTransaction(
    id: string,
    updates: Partial<Transaction>
  ): Promise<Transaction> {
    const existing = await this.db.transactions.get(id);
    if (!existing) {
      throw new Error(`Transaction with id ${id} not found`);
    }

    const updated: Transaction = {
      ...existing,
      ...updates,
      id, // protect ID
      updatedAt: new Date().toISOString(),
    };

    await this.db.transactions.put(updated);
    return updated;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.db.transactions.delete(id);
  }

  async bulkCreateTransactions(
    txs: Array<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }>
  ): Promise<Transaction[]> {
    const now = new Date().toISOString();
    const formatted: Transaction[] = txs.map((tx) => ({
      ...tx,
      id: tx.id ?? crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }));
    await this.db.transactions.bulkAdd(formatted);
    return formatted;
  }

  async countTransactions(): Promise<number> {
    return this.db.transactions.count();
  }

  // -------------------------------------------------------------
  // CATEGORIES
  // -------------------------------------------------------------

  async getCategories(): Promise<Category[]> {
    return this.db.categories.orderBy('order').toArray();
  }

  async getCategory(id: string): Promise<Category | undefined> {
    return this.db.categories.get(id);
  }

  async createCategory(category: Category): Promise<Category> {
    await this.db.categories.add(category);
    return category;
  }

  async updateCategory(
    id: string,
    updates: Partial<Category>
  ): Promise<Category> {
    const existing = await this.db.categories.get(id);
    if (!existing) {
      throw new Error(`Category with id ${id} not found`);
    }
    const updated: Category = { ...existing, ...updates, id };
    await this.db.categories.put(updated);
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    // Delete category and any subcategories that point to it
    await this.db.categories.where('parentId').equals(id).delete();
    await this.db.categories.delete(id);
  }

  async bulkCreateCategories(categories: Category[]): Promise<void> {
    await this.db.categories.bulkPut(categories);
  }

  // -------------------------------------------------------------
  // BUDGETS
  // -------------------------------------------------------------

  async getBudgets(): Promise<Budget[]> {
    return this.db.budgets.orderBy('month').reverse().toArray();
  }

  async getBudgetForMonth(month: string): Promise<Budget | undefined> {
    return this.db.budgets.where('month').equals(month).first();
  }

  async setBudget(budget: Budget): Promise<Budget> {
    const now = new Date().toISOString();
    const toSave: Budget = {
      ...budget,
      id: budget.id || `budget_${budget.month}`,
      updatedAt: now,
      createdAt: budget.createdAt || now,
    };
    await this.db.budgets.put(toSave);
    return toSave;
  }

  async deleteBudget(id: string): Promise<void> {
    await this.db.budgets.delete(id);
  }

  // -------------------------------------------------------------
  // RULES
  // -------------------------------------------------------------

  async getRules(): Promise<Rule[]> {
    return this.db.rules.orderBy('hits').reverse().toArray();
  }

  async createRule(
    rule: Omit<Rule, 'id' | 'createdAt' | 'hits'> & { id?: string }
  ): Promise<Rule> {
    const newRule: Rule = {
      ...rule,
      id: rule.id ?? crypto.randomUUID(),
      hits: 0,
      createdAt: new Date().toISOString(),
    };
    await this.db.rules.add(newRule);
    return newRule;
  }

  async incrementRuleHit(id: string): Promise<void> {
    const rule = await this.db.rules.get(id);
    if (rule) {
      await this.db.rules.update(id, { hits: rule.hits + 1 });
    }
  }

  async deleteRule(id: string): Promise<void> {
    await this.db.rules.delete(id);
  }

  async findMatchingRule(merchant: string): Promise<Rule | undefined> {
    const rules = await this.db.rules.toArray();
    const query = merchant.toLowerCase().trim();

    for (const rule of rules) {
      if (typeof rule.matcher === 'string') {
        const pattern = rule.matcher.toLowerCase().trim();
        if (query === pattern || query.includes(pattern)) {
          return rule;
        }
      } else {
        const m = rule.matcher as RuleMatcher;
        const val = m.value.toLowerCase().trim();
        if (m.operator === 'exact' && query === val) return rule;
        if (m.operator === 'contains' && query.includes(val)) return rule;
        if (m.operator === 'startsWith' && query.startsWith(val)) return rule;
        if (m.operator === 'regex') {
          try {
            const re = new RegExp(m.value, 'i');
            if (re.test(merchant)) return rule;
          } catch {
            // Ignore invalid regex
          }
        }
      }
    }
    return undefined;
  }

  // -------------------------------------------------------------
  // RECURRING
  // -------------------------------------------------------------

  async getRecurring(): Promise<RecurringExpense[]> {
    return this.db.recurring.orderBy('nextDue').toArray();
  }

  async createRecurring(
    item: Omit<RecurringExpense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<RecurringExpense> {
    const now = new Date().toISOString();
    const newRec: RecurringExpense = {
      ...item,
      id: item.id ?? crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await this.db.recurring.add(newRec);
    return newRec;
  }

  async updateRecurring(
    id: string,
    updates: Partial<RecurringExpense>
  ): Promise<RecurringExpense> {
    const existing = await this.db.recurring.get(id);
    if (!existing) throw new Error(`Recurring expense with id ${id} not found`);

    const updated: RecurringExpense = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    await this.db.recurring.put(updated);
    return updated;
  }

  async deleteRecurring(id: string): Promise<void> {
    await this.db.recurring.delete(id);
  }

  // -------------------------------------------------------------
  // MEMORY
  // -------------------------------------------------------------

  async getMemoryItems(approvedOnly = false): Promise<MemoryItem[]> {
    const items = await this.db.memory.orderBy('createdAt').reverse().toArray();
    if (approvedOnly) {
      return items.filter((m) => m.approvedAt !== null && m.approvedAt !== undefined);
    }
    return items;
  }

  async createMemoryItem(
    item: Omit<MemoryItem, 'id' | 'createdAt'> & { id?: string }
  ): Promise<MemoryItem> {
    const newItem: MemoryItem = {
      ...item,
      id: item.id ?? crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await this.db.memory.add(newItem);
    return newItem;
  }

  async approveMemoryItem(id: string): Promise<void> {
    await this.db.memory.update(id, { approvedAt: new Date().toISOString() });
  }

  async deleteMemoryItem(id: string): Promise<void> {
    await this.db.memory.delete(id);
  }

  // -------------------------------------------------------------
  // REPORTS
  // -------------------------------------------------------------

  async getReports(): Promise<ReportItem[]> {
    return this.db.reports.orderBy('createdAt').reverse().toArray();
  }

  async getReport(id: string): Promise<ReportItem | undefined> {
    return this.db.reports.get(id);
  }

  async saveReport(report: ReportItem): Promise<ReportItem> {
    await this.db.reports.put(report);
    return report;
  }

  async deleteReport(id: string): Promise<void> {
    await this.db.reports.delete(id);
  }

  // -------------------------------------------------------------
  // AI USAGE
  // -------------------------------------------------------------

  async getAiUsageToday(day: string): Promise<AiUsageRecord[]> {
    return this.db.aiUsage.where('day').equals(day).toArray();
  }

  async incrementAiUsage(day: string, model: string): Promise<number> {
    const existing = await this.db.aiUsage
      .where('[day+model]')
      .equals([day, model])
      .first();

    if (existing && existing.id !== undefined) {
      const nextCount = existing.count + 1;
      await this.db.aiUsage.update(existing.id, { count: nextCount });
      return nextCount;
    } else {
      await this.db.aiUsage.add({
        day,
        model,
        count: 1,
      });
      return 1;
    }
  }

  // -------------------------------------------------------------
  // SETTINGS
  // -------------------------------------------------------------

  async getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const item = await this.db.settings.get(key);
    if (!item) return defaultValue;
    return item.value as T;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    await this.db.settings.put({
      key,
      value: value as string | number | boolean | object,
    });
  }

  async getAllSettings(): Promise<Record<string, unknown>> {
    const all = await this.db.settings.toArray();
    const result: Record<string, unknown> = {};
    for (const item of all) {
      result[item.key] = item.value;
    }
    return result;
  }

  // -------------------------------------------------------------
  // LIFECYCLE & BACKUP
  // -------------------------------------------------------------

  async clearAll(): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.transactions,
        this.db.categories,
        this.db.budgets,
        this.db.rules,
        this.db.recurring,
        this.db.memory,
        this.db.reports,
        this.db.aiUsage,
        this.db.settings,
      ],
      async () => {
        await Promise.all([
          this.db.transactions.clear(),
          this.db.categories.clear(),
          this.db.budgets.clear(),
          this.db.rules.clear(),
          this.db.recurring.clear(),
          this.db.memory.clear(),
          this.db.reports.clear(),
          this.db.aiUsage.clear(),
          this.db.settings.clear(),
        ]);
      }
    );
  }

  async isDatabaseEmpty(): Promise<boolean> {
    const [catCount, txCount] = await Promise.all([
      this.db.categories.count(),
      this.db.transactions.count(),
    ]);
    return catCount === 0 && txCount === 0;
  }

  async exportAll(): Promise<Record<string, unknown>> {
    const [
      transactions,
      categories,
      budgets,
      rules,
      recurring,
      memory,
      reports,
      settings,
    ] = await Promise.all([
      this.db.transactions.toArray(),
      this.db.categories.toArray(),
      this.db.budgets.toArray(),
      this.db.rules.toArray(),
      this.db.recurring.toArray(),
      this.db.memory.toArray(),
      this.db.reports.toArray(),
      this.db.settings.toArray(),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions,
      categories,
      budgets,
      rules,
      recurring,
      memory,
      reports,
      settings,
    };
  }

  async importAll(data: Record<string, unknown>): Promise<void> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid backup file: not a JSON object');
    }

    if (!Array.isArray(data['categories']) || !Array.isArray(data['transactions'])) {
      throw new Error('Invalid backup file: missing categories or transactions arrays');
    }

    const txs = data['transactions'] as Transaction[];
    const cats = data['categories'] as Category[];
    const budgets = (data['budgets'] as Budget[]) || [];
    const rules = (data['rules'] as Rule[]) || [];
    const recurring = (data['recurring'] as RecurringExpense[]) || [];
    const memory = (data['memory'] as MemoryItem[]) || [];
    const reports = (data['reports'] as ReportItem[]) || [];
    const settings = (data['settings'] as Array<{ key: string; value: unknown }>) || [];

    // Only clear once validation has succeeded
    await this.clearAll();

    await this.db.transaction(
      'rw',
      [
        this.db.transactions,
        this.db.categories,
        this.db.budgets,
        this.db.rules,
        this.db.recurring,
        this.db.memory,
        this.db.reports,
        this.db.settings,
      ],
      async () => {
        if (cats.length) await this.db.categories.bulkPut(cats);
        if (txs.length) await this.db.transactions.bulkPut(txs);
        if (budgets.length) await this.db.budgets.bulkPut(budgets);
        if (rules.length) await this.db.rules.bulkPut(rules);
        if (recurring.length) await this.db.recurring.bulkPut(recurring);
        if (memory.length) await this.db.memory.bulkPut(memory);
        if (reports.length) await this.db.reports.bulkPut(reports);
        if (settings.length) {
          for (const s of settings) {
            await this.db.settings.put({
              key: s.key,
              value: s.value as string | number | boolean | object,
            });
          }
        }
      }
    );
  }
}

export const repository = new DexieRepository();
