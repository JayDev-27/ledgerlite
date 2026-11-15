import Dexie, { type EntityTable } from 'dexie';
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
import { APP_NAME } from '@/constants/app';

export class FinanceDatabase extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  rules!: EntityTable<Rule, 'id'>;
  recurring!: EntityTable<RecurringExpense, 'id'>;
  memory!: EntityTable<MemoryItem, 'id'>;
  reports!: EntityTable<ReportItem, 'id'>;
  aiUsage!: EntityTable<AiUsageRecord, 'id'>;
  settings!: EntityTable<SettingItem, 'key'>;

  constructor(dbName = `${APP_NAME}DB`) {
    super(dbName);
    this.version(1).stores({
      transactions: 'id, date, merchant, categoryId, subcategoryId, paymentMethod, recurringId, source, createdAt',
      categories: 'id, name, parentId, type, order',
      budgets: 'id, &month',
      rules: 'id, categoryId, hits',
      recurring: 'id, cadence, nextDue, active',
      memory: 'id, kind, createdAt, approvedAt',
      reports: 'id, period, createdAt',
      aiUsage: '++id, day, model, [day+model]',
      settings: 'key',
    });
  }
}

export const db = new FinanceDatabase();
