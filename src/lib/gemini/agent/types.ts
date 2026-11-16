import type { MemoryKind } from '@/types';

export interface QueryTransactionsArgs {
  startDate?: string;
  endDate?: string;
  category?: string;
  merchant?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface AggregateArgs {
  groupBy: 'category' | 'merchant' | 'day' | 'week' | 'month' | 'paymentMethod';
  period?: {
    startDate: string;
    endDate: string;
  };
  metrics?: ('total' | 'count' | 'average')[];
}

export interface ComparePeriodsArgs {
  periodA: {
    startDate: string;
    endDate: string;
  };
  periodB: {
    startDate: string;
    endDate: string;
  };
}

export interface GetBudgetStatusArgs {
  month: string; // YYYY-MM
}

export interface SetBudgetArgs {
  month?: string; // YYYY-MM
  totalLimit: number;
  categoryLimits?: Record<string, number>;
  rollover?: boolean;
}

export interface ProposeMemoryArgs {
  kind: MemoryKind;
  text: string;
}

export interface ExtractedTransactionItem {
  date: string;
  amount: number;
  merchant: string;
  category?: string;
  paymentMethod?: 'upi' | 'card' | 'cash' | 'net_banking' | 'wallet';
  notes?: string;
}

export interface ImportExtractedTransactionsArgs {
  transactions: ExtractedTransactionItem[];
}

export interface AddTransactionArgs {
  date: string;
  amount: number;
  merchant: string;
  category?: string;
  paymentMethod?: 'upi' | 'card' | 'cash' | 'net_banking' | 'wallet';
  notes?: string;
}

export interface ExtractedTransactionProposal {
  id: string;
  date: string;
  amount: number;
  merchant: string;
  category?: string;
  categoryId?: string;
  paymentMethod?: 'upi' | 'card' | 'cash' | 'net_banking' | 'wallet';
  notes?: string;
  confidence?: number;
}

export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // base64
}

export interface ToolExecutionRecord {
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface MemoryProposalRecord {
  memoryId: string;
  kind: MemoryKind;
  text: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  attachments?: FileAttachment[];
  toolExecutions?: ToolExecutionRecord[];
  proposals?: MemoryProposalRecord[];
  extractedTransactions?: ExtractedTransactionProposal[];
  modelUsed?: string;
}

export interface AgentTurnResult {
  text: string;
  toolExecutions: ToolExecutionRecord[];
  proposals: MemoryProposalRecord[];
  extractedTransactions: ExtractedTransactionProposal[];
  modelUsed: string;
}

export interface AgentRunOptions {
  userQuery: string;
  attachments?: FileAttachment[];
  history?: Array<{ role: 'user' | 'assistant'; text: string; attachments?: FileAttachment[] }>;
  apiKey: string;
  model?: string;
  privacyMode?: boolean;
}
