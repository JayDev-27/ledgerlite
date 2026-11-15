import type { PaymentMethod, Transaction } from '@/types';

export type CsvField = 'date' | 'amount' | 'merchant' | 'category' | 'paymentMethod' | 'notes';

export type ColumnMapping = Record<CsvField, number | null>; // field -> column index (0-based)

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
}

export interface PreparedImportTransaction {
  date: string; // ISO string
  amount: number;
  merchant: string;
  categoryName?: string;
  categoryId?: string;
  subcategoryId?: string | null;
  paymentMethod: PaymentMethod;
  notes?: string;
  isDuplicate: boolean;
  duplicateOf?: Transaction;
  selectedForImport: boolean;
}
