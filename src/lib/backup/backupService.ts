import { repository } from '@/data/repository';
import { APP_NAME } from '@/constants/app';
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
import { BackupPayload, BackupValidationResult, BackupSummary } from './types';

/**
 * Validates the structure and integrity of a backup payload BEFORE modifying the database.
 */
export function validateBackupPayload(data: unknown): BackupValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Backup data must be a valid non-empty JSON object.' };
  }

  const record = data as Record<string, unknown>;

  // Check for nested tables or root-level structure
  const source = (record['tables'] && typeof record['tables'] === 'object'
    ? record['tables']
    : record) as Record<string, unknown>;

  if (!Array.isArray(source['categories'])) {
    return { valid: false, error: 'Backup is missing the mandatory "categories" table array.' };
  }

  if (!Array.isArray(source['transactions'])) {
    return { valid: false, error: 'Backup is missing the mandatory "transactions" table array.' };
  }

  const categories = source['categories'] as Array<Record<string, unknown>>;
  const transactions = source['transactions'] as Array<Record<string, unknown>>;

  // Category schema validation
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') {
      return {
        valid: false,
        error: `Category item at index ${i} is corrupt (requires 'id' string and 'name' string).`,
      };
    }
  }

  // Transaction schema validation
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (
      !tx ||
      typeof tx.id !== 'string' ||
      typeof tx.amount !== 'number' ||
      typeof tx.date !== 'string' ||
      typeof tx.categoryId !== 'string'
    ) {
      return {
        valid: false,
        error: `Transaction item at index ${i} is corrupt (requires 'id', 'amount' number, 'date', and 'categoryId').`,
      };
    }
  }

  const summary: BackupSummary = {
    transactionsCount: transactions.length,
    categoriesCount: categories.length,
    budgetsCount: Array.isArray(source['budgets']) ? source['budgets'].length : 0,
    rulesCount: Array.isArray(source['rules']) ? source['rules'].length : 0,
    recurringCount: Array.isArray(source['recurring']) ? source['recurring'].length : 0,
    memoryCount: Array.isArray(source['memory']) ? source['memory'].length : 0,
    reportsCount: Array.isArray(source['reports']) ? source['reports'].length : 0,
    aiUsageCount: Array.isArray(source['aiUsage']) ? source['aiUsage'].length : 0,
    settingsCount: Array.isArray(source['settings']) ? source['settings'].length : 0,
    exportedAt: typeof record['exportedAt'] === 'string' ? record['exportedAt'] : undefined,
  };

  return { valid: true, summary };
}

/**
 * Creates a full export containing all 9 Dexie tables
 */
export async function createFullBackup(): Promise<BackupPayload> {
  const exportData = await repository.exportAll();
  return {
    version: 1,
    appName: APP_NAME,
    exportedAt: new Date().toISOString(),
    transactions: (exportData['transactions'] as Transaction[]) || [],
    categories: (exportData['categories'] as Category[]) || [],
    budgets: (exportData['budgets'] as Budget[]) || [],
    rules: (exportData['rules'] as Rule[]) || [],
    recurring: (exportData['recurring'] as RecurringExpense[]) || [],
    memory: (exportData['memory'] as MemoryItem[]) || [],
    reports: (exportData['reports'] as ReportItem[]) || [],
    aiUsage: (exportData['aiUsage'] as AiUsageRecord[]) || [],
    settings: (exportData['settings'] as SettingItem[]) || [],
  };
}

/**
 * Validates and restores a backup payload safely into IndexedDB
 */
export async function restoreBackupPayload(data: unknown): Promise<BackupValidationResult> {
  const validation = validateBackupPayload(data);
  if (!validation.valid) {
    throw new Error(validation.error || 'Failed backup validation.');
  }

  await repository.importAll(data as Record<string, unknown>);
  return validation;
}

/**
 * Downloads full backup as a formatted JSON file in browser
 */
export async function downloadBackupJson(filename?: string): Promise<string> {
  const backup = await createFullBackup();
  const jsonString = JSON.stringify(backup, null, 2);

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    const safeName = filename || `${APP_NAME.toLowerCase()}_vault_backup_${today}.json`;
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return jsonString;
}
