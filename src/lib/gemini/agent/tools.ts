import { FunctionDeclaration, Type } from '@google/genai';
import type { Repository } from '@/data/repository';
import type { Transaction, Budget, Category, PaymentMethod } from '@/types';
import { sanitizeSensitiveText } from '@/lib/gemini/privacySanitizer';
import type {
  QueryTransactionsArgs,
  AggregateArgs,
  ComparePeriodsArgs,
  GetBudgetStatusArgs,
  SetBudgetArgs,
  ProposeMemoryArgs,
  ImportExtractedTransactionsArgs,
  AddTransactionArgs,
  ExtractedTransactionProposal,
} from './types';

export const CHAT_TOOLS_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'query_transactions',
    description:
      'Search and filter local transactions by date range, category, merchant name, and min/max amount.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        startDate: {
          type: Type.STRING,
          description: 'Start date in ISO format YYYY-MM-DD',
        },
        endDate: {
          type: Type.STRING,
          description: 'End date in ISO format YYYY-MM-DD',
        },
        category: {
          type: Type.STRING,
          description: 'Category name or Category ID to filter by',
        },
        merchant: {
          type: Type.STRING,
          description: 'Merchant or payee name (case-insensitive substring search)',
        },
        minAmount: {
          type: Type.NUMBER,
          description: 'Minimum transaction amount in INR',
        },
        maxAmount: {
          type: Type.NUMBER,
          description: 'Maximum transaction amount in INR',
        },
      },
    },
  },
  {
    name: 'aggregate',
    description:
      'Group transactions by category, merchant, day, week, month, or paymentMethod and compute totals, counts, and averages.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        groupBy: {
          type: Type.STRING,
          enum: ['category', 'merchant', 'day', 'week', 'month', 'paymentMethod'],
          description: 'Field to group transactions by',
        },
        period: {
          type: Type.OBJECT,
          description: 'Date range to aggregate over',
          properties: {
            startDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
            endDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
          },
          required: ['startDate', 'endDate'],
        },
        metrics: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Metrics to calculate (total, count, average)',
        },
      },
      required: ['groupBy'],
    },
  },
  {
    name: 'compare_periods',
    description:
      'Compare spending, transaction volume, and category shifts between two distinct date ranges (Period A vs Period B).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        periodA: {
          type: Type.OBJECT,
          description: 'First or earlier reference period',
          properties: {
            startDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
            endDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
          },
          required: ['startDate', 'endDate'],
        },
        periodB: {
          type: Type.OBJECT,
          description: 'Second or later comparison period',
          properties: {
            startDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
            endDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
          },
          required: ['startDate', 'endDate'],
        },
      },
      required: ['periodA', 'periodB'],
    },
  },
  {
    name: 'get_budget_status',
    description:
      'Get the budget status for a given month (YYYY-MM), including total limit, total spent, burn rate pace, projected month-end spend, and category breakdown.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: {
          type: Type.STRING,
          description: 'Month in YYYY-MM format (e.g. "2026-11")',
        },
      },
      required: ['month'],
    },
  },
  {
    name: 'set_budget',
    description:
      'Set, create, or update the overall monthly budget limit and optional category envelope limits for a given month (YYYY-MM). Persists directly into the user\'s budget database.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: {
          type: Type.STRING,
          description: 'Month in YYYY-MM format (e.g. "2026-11"). If omitted, defaults to current active month.',
        },
        totalLimit: {
          type: Type.NUMBER,
          description: 'Total monthly budget limit in INR. If set to 0 and category limits are provided, it will be automatically calculated from the sum of category limits.',
        },
        categoryLimits: {
          type: Type.OBJECT,
          description: 'Optional map of category names or IDs to their spending limit in INR (e.g. {"Groceries": 8000, "Dining Out": 4000})',
        },
        rollover: {
          type: Type.BOOLEAN,
          description: 'Whether unused budget carries over to the next month (defaults to true or existing setting)',
        },
      },
      required: ['totalLimit'],
    },
  },
  {
    name: 'list_categories',
    description:
      'List all user categories and subcategories, including their Need/Want/Savings 50-30-20 classification tags.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'propose_memory',
    description:
      'Propose a new long-term financial memory fact (goal, preference, income, recurring_fact) for user confirmation. Does NOT save directly without user approval.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        kind: {
          type: Type.STRING,
          enum: ['goal', 'preference', 'income', 'recurring_fact', 'note'],
          description: 'Type of memory item',
        },
        text: {
          type: Type.STRING,
          description: 'The fact or commitment to propose to the user',
        },
      },
      required: ['kind', 'text'],
    },
  },
  {
    name: 'import_extracted_transactions',
    description:
      'Propose one or more financial transactions extracted from an uploaded receipt, bill, bank statement, or user prompt for ledger review and 1-click import.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        transactions: {
          type: Type.ARRAY,
          description: 'List of extracted transactions to propose for user ledger import',
          items: {
            type: Type.OBJECT,
            properties: {
              date: {
                type: Type.STRING,
                description: 'Transaction date in YYYY-MM-DD format',
              },
              amount: {
                type: Type.NUMBER,
                description: 'Transaction amount in INR (positive number)',
              },
              merchant: {
                type: Type.STRING,
                description: 'Merchant, vendor, payee, or billing entity name',
              },
              category: {
                type: Type.STRING,
                description: 'Category name (e.g. Groceries, Dining Out, Utilities) or category ID',
              },
              paymentMethod: {
                type: Type.STRING,
                enum: ['upi', 'card', 'cash', 'net_banking', 'wallet'],
                description: 'Payment method if identifiable',
              },
              notes: {
                type: Type.STRING,
                description: 'Optional notes, bill numbers, or context',
              },
            },
            required: ['date', 'amount', 'merchant'],
          },
        },
      },
      required: ['transactions'],
    },
  },
  {
    name: 'add_transaction',
    description:
      'Propose a single transaction specified by the user or extracted from a document for ledger review and import.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description: 'Transaction date in YYYY-MM-DD format',
        },
        amount: {
          type: Type.NUMBER,
          description: 'Transaction amount in INR (positive number)',
        },
        merchant: {
          type: Type.STRING,
          description: 'Merchant or payee name',
        },
        category: {
          type: Type.STRING,
          description: 'Category name or ID',
        },
        paymentMethod: {
          type: Type.STRING,
          enum: ['upi', 'card', 'cash', 'net_banking', 'wallet'],
          description: 'Payment method',
        },
        notes: {
          type: Type.STRING,
          description: 'Notes or receipt details',
        },
      },
      required: ['date', 'amount', 'merchant'],
    },
  },
];

// Helper to resolve category name or id to canonical category id
function resolveCategoryId(input: string, categories: Category[]): string {
  const normalized = input.trim().toLowerCase();
  // 1. Direct ID match (case-insensitive)
  const byId = categories.find((c) => c.id.toLowerCase() === normalized);
  if (byId) return byId.id;

  // 2. Exact name match (case-insensitive)
  const byExactName = categories.find((c) => c.name.toLowerCase() === normalized);
  if (byExactName) return byExactName.id;

  // 3. Substring match
  const byPartial = categories.find((c) => c.name.toLowerCase().includes(normalized));
  if (byPartial) return byPartial.id;

  return input;
}

// Helper to filter transactions locally
function filterTransactions(
  transactions: Transaction[],
  categoriesMap: Map<string, string>,
  args: QueryTransactionsArgs
): Transaction[] {
  return transactions.filter((tx) => {
    if (args.startDate && tx.date.slice(0, 10) < args.startDate) {
      return false;
    }
    if (args.endDate && tx.date.slice(0, 10) > args.endDate) {
      return false;
    }
    if (args.minAmount !== undefined && tx.amount < args.minAmount) {
      return false;
    }
    if (args.maxAmount !== undefined && tx.amount > args.maxAmount) {
      return false;
    }
    if (args.merchant && !tx.merchant.toLowerCase().includes(args.merchant.toLowerCase())) {
      return false;
    }
    if (args.category) {
      const catQuery = args.category.toLowerCase();
      const catName = (categoriesMap.get(tx.categoryId) || '').toLowerCase();
      const subName = (tx.subcategoryId ? categoriesMap.get(tx.subcategoryId) || '' : '').toLowerCase();
      if (
        tx.categoryId.toLowerCase() !== catQuery &&
        tx.subcategoryId?.toLowerCase() !== catQuery &&
        !catName.includes(catQuery) &&
        !subName.includes(catQuery)
      ) {
        return false;
      }
    }
    return true;
  });
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  repo: Repository,
  privacyMode = true
): Promise<Record<string, unknown>> {
  const categories = await repo.getCategories();
  const categoryMap = new Map<string, string>(categories.map((c) => [c.id, c.name]));

  switch (name) {
    case 'query_transactions': {
      const qArgs = args as unknown as QueryTransactionsArgs;
      const allTx = await repo.getAllTransactions();
      const filtered = filterTransactions(allTx, categoryMap, qArgs);
      const totalAmount = filtered.reduce((sum, tx) => sum + tx.amount, 0);

      return {
        count: filtered.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        transactions: filtered.slice(0, 50).map((tx) => ({
          id: tx.id,
          date: tx.date.slice(0, 10),
          merchant: privacyMode ? sanitizeSensitiveText(tx.merchant) : tx.merchant,
          amount: tx.amount,
          category: categoryMap.get(tx.categoryId) || tx.categoryId,
          paymentMethod: tx.paymentMethod,
          notes: privacyMode ? null : (tx.notes || null),
        })),
        truncated: filtered.length > 50,
      };
    }

    case 'aggregate': {
      const aggArgs = args as unknown as AggregateArgs;
      const allTx = await repo.getAllTransactions();

      let targetTx = allTx;
      if (aggArgs.period?.startDate || aggArgs.period?.endDate) {
        targetTx = allTx.filter((tx) => {
          const d = tx.date.slice(0, 10);
          if (aggArgs.period?.startDate && d < aggArgs.period.startDate) return false;
          if (aggArgs.period?.endDate && d > aggArgs.period.endDate) return false;
          return true;
        });
      }

      const groupsMap = new Map<string, { total: number; count: number }>();
      let grandTotal = 0;

      for (const tx of targetTx) {
        let key = 'Other';
        if (aggArgs.groupBy === 'category') {
          key = categoryMap.get(tx.categoryId) || tx.categoryId;
        } else if (aggArgs.groupBy === 'merchant') {
          key = privacyMode ? sanitizeSensitiveText(tx.merchant) : tx.merchant;
        } else if (aggArgs.groupBy === 'day') {
          key = tx.date.slice(0, 10);
        } else if (aggArgs.groupBy === 'month') {
          key = tx.date.slice(0, 7);
        } else if (aggArgs.groupBy === 'paymentMethod') {
          key = tx.paymentMethod;
        } else if (aggArgs.groupBy === 'week') {
          const dStr = tx.date.slice(0, 10);
          const [y, m, d] = dStr.split('-').map(Number);
          const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
          const day = dt.getUTCDay();
          const diff = dt.getUTCDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, diff));
          key = monday.toISOString().slice(0, 10);
        }

        const current = groupsMap.get(key) || { total: 0, count: 0 };
        current.total += tx.amount;
        current.count += 1;
        groupsMap.set(key, current);
        grandTotal += tx.amount;
      }

      const groups = Array.from(groupsMap.entries())
        .map(([groupKey, stats]) => ({
          key: groupKey,
          total: Math.round(stats.total * 100) / 100,
          count: stats.count,
          average: Math.round((stats.total / stats.count) * 100) / 100,
          percentage: grandTotal > 0 ? Math.round((stats.total / grandTotal) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.total - a.total);

      return {
        groupBy: aggArgs.groupBy,
        period: aggArgs.period || 'all-time',
        grandTotal: Math.round(grandTotal * 100) / 100,
        totalTransactions: targetTx.length,
        groups,
      };
    }

    case 'compare_periods': {
      const cmpArgs = args as unknown as ComparePeriodsArgs;
      const allTx = await repo.getAllTransactions();

      const txA = allTx.filter((tx) => {
        const d = tx.date.slice(0, 10);
        return d >= cmpArgs.periodA.startDate && d <= cmpArgs.periodA.endDate;
      });

      const txB = allTx.filter((tx) => {
        const d = tx.date.slice(0, 10);
        return d >= cmpArgs.periodB.startDate && d <= cmpArgs.periodB.endDate;
      });

      const spendA = txA.reduce((sum, tx) => sum + tx.amount, 0);
      const spendB = txB.reduce((sum, tx) => sum + tx.amount, 0);
      const deltaAmount = Math.round((spendB - spendA) * 100) / 100;
      const percentageChange =
        spendA > 0 ? Math.round(((spendB - spendA) / spendA) * 1000) / 10 : 0;

      // Category breakdown comparison
      const catSpendA = new Map<string, number>();
      for (const tx of txA) {
        const cat = categoryMap.get(tx.categoryId) || tx.categoryId;
        catSpendA.set(cat, (catSpendA.get(cat) || 0) + tx.amount);
      }

      const catSpendB = new Map<string, number>();
      for (const tx of txB) {
        const cat = categoryMap.get(tx.categoryId) || tx.categoryId;
        catSpendB.set(cat, (catSpendB.get(cat) || 0) + tx.amount);
      }

      const allCatKeys = new Set([...catSpendA.keys(), ...catSpendB.keys()]);
      const categoryDeltas = Array.from(allCatKeys)
        .map((catName) => {
          const a = catSpendA.get(catName) || 0;
          const b = catSpendB.get(catName) || 0;
          return {
            category: catName,
            periodASpend: Math.round(a * 100) / 100,
            periodBSpend: Math.round(b * 100) / 100,
            delta: Math.round((b - a) * 100) / 100,
          };
        })
        .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

      return {
        periodA: {
          startDate: cmpArgs.periodA.startDate,
          endDate: cmpArgs.periodA.endDate,
          totalSpend: Math.round(spendA * 100) / 100,
          count: txA.length,
        },
        periodB: {
          startDate: cmpArgs.periodB.startDate,
          endDate: cmpArgs.periodB.endDate,
          totalSpend: Math.round(spendB * 100) / 100,
          count: txB.length,
        },
        deltaAmount,
        percentageChange,
        categoryDeltas: categoryDeltas.slice(0, 8),
      };
    }

    case 'get_budget_status': {
      const bArgs = args as unknown as GetBudgetStatusArgs;
      const targetMonth = bArgs.month;
      const budget = await repo.getBudgetForMonth(targetMonth);

      const allTx = await repo.getAllTransactions();
      const monthTx = allTx.filter((tx) => tx.date.slice(0, 7) === targetMonth);
      const totalSpent = monthTx.reduce((sum, tx) => sum + tx.amount, 0);

      const [yStr = '', mStr = ''] = targetMonth.split('-');
      const year = parseInt(yStr, 10) || new Date().getFullYear();
      const monthNum = parseInt(mStr, 10) || (new Date().getMonth() + 1);
      const daysInMonth = new Date(year, monthNum, 0).getDate();

      const currentMonth = new Date().toISOString().slice(0, 7);
      let daysElapsed = daysInMonth;
      if (targetMonth === currentMonth) {
        daysElapsed = Math.min(daysInMonth, new Date().getDate());
      } else if (targetMonth > currentMonth) {
        daysElapsed = 0;
      }

      const burnRate = daysElapsed > 0 ? Math.round(totalSpent / daysElapsed) : 0;
      const projectedMonthEnd =
        daysElapsed > 0 ? Math.round(burnRate * daysInMonth) : Math.round(totalSpent);

      if (!budget) {
        return {
          hasBudget: false,
          month: targetMonth,
          totalSpent: Math.round(totalSpent * 100) / 100,
          burnRate,
          projectedMonthEnd,
          message: `No budget configured for ${targetMonth}`,
        };
      }

      const totalLimit = budget.totalLimit;
      const remaining = Math.round((totalLimit - totalSpent) * 100) / 100;
      const percentUsed =
        totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 1000) / 10 : 0;
      const status =
        totalSpent > totalLimit
          ? 'over_budget'
          : totalSpent >= totalLimit * 0.9
          ? 'near_budget'
          : 'under_budget';

      // Category breakdown
      const catSpentMap = new Map<string, number>();
      for (const tx of monthTx) {
        catSpentMap.set(tx.categoryId, (catSpentMap.get(tx.categoryId) || 0) + tx.amount);
      }

      const categoryBreakdown = Object.entries(budget.categoryLimits).map(
        ([catId, limit]) => {
          const spent = catSpentMap.get(catId) || 0;
          return {
            categoryId: catId,
            categoryName: categoryMap.get(catId) || catId,
            limit,
            spent: Math.round(spent * 100) / 100,
            remaining: Math.round((limit - spent) * 100) / 100,
            percentUsed: limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0,
            status: spent > limit ? 'over' : spent >= limit * 0.9 ? 'near' : 'ok',
          };
        }
      );

      return {
        hasBudget: true,
        month: targetMonth,
        totalLimit,
        totalSpent: Math.round(totalSpent * 100) / 100,
        remaining,
        percentUsed,
        burnRate,
        projectedMonthEnd,
        status,
        categoryBreakdown,
      };
    }

    case 'set_budget': {
      const bArgs = args as unknown as SetBudgetArgs;
      const targetMonth = bArgs.month?.trim() || '2026-11';
      const existing = await repo.getBudgetForMonth(targetMonth);

      const existingLimits: Record<string, number> = existing?.categoryLimits ? { ...existing.categoryLimits } : {};
      const resolvedNewLimits: Record<string, number> = {};

      if (bArgs.categoryLimits && typeof bArgs.categoryLimits === 'object') {
        for (const [key, limitVal] of Object.entries(bArgs.categoryLimits)) {
          const canonicalId = resolveCategoryId(key, categories);
          const numVal = Math.round(Number(limitVal) || 0);
          resolvedNewLimits[canonicalId] = numVal;
        }
      }

      const finalCategoryLimits: Record<string, number> = {
        ...existingLimits,
        ...resolvedNewLimits,
      };

      let targetTotalLimit = Number(bArgs.totalLimit) || 0;
      if (targetTotalLimit <= 0) {
        const sumOfCategories = Object.values(finalCategoryLimits).reduce((sum, val) => sum + val, 0);
        if (sumOfCategories > 0) {
          targetTotalLimit = sumOfCategories;
        } else if (existing?.totalLimit) {
          targetTotalLimit = existing.totalLimit;
        }
      }

      const updatedBudget: Budget = {
        id: existing?.id || `budget_${targetMonth}`,
        month: targetMonth,
        totalLimit: Math.round(targetTotalLimit),
        categoryLimits: finalCategoryLimits,
        rollover: bArgs.rollover ?? existing?.rollover ?? true,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await repo.setBudget(updatedBudget);

      const envelopeCount = Object.keys(finalCategoryLimits).length;
      return {
        success: true,
        message: `Budget for ${targetMonth} set to ₹${Math.round(targetTotalLimit).toLocaleString('en-IN')}${envelopeCount > 0 ? ` across ${envelopeCount} categories` : ''}.`,
        month: targetMonth,
        totalLimit: Math.round(targetTotalLimit),
        categoryLimits: finalCategoryLimits,
        rollover: updatedBudget.rollover,
      };
    }

    case 'list_categories': {
      return {
        count: categories.length,
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          parentId: c.parentId || null,
          color: c.color,
          icon: c.icon,
        })),
      };
    }

    case 'propose_memory': {
      const memArgs = args as unknown as ProposeMemoryArgs;
      const newItem = await repo.createMemoryItem({
        kind: memArgs.kind,
        text: memArgs.text.trim(),
        approvedAt: null, // pending approval!
      });

      return {
        status: 'proposed',
        memoryId: newItem.id,
        kind: newItem.kind,
        text: newItem.text,
        requiresUserApproval: true,
        message: `Proposed new ${newItem.kind.replace('_', ' ')} memory for user confirmation: "${newItem.text}"`,
      };
    }

    case 'import_extracted_transactions': {
      const impArgs = args as unknown as ImportExtractedTransactionsArgs;
      const rawList = Array.isArray(impArgs.transactions) ? impArgs.transactions : [];
      const proposals: ExtractedTransactionProposal[] = rawList.map((item, idx) => {
        const catInput = item.category?.trim() || 'Groceries';
        const canonicalCatId = resolveCategoryId(catInput, categories);
        const resolvedCatName = categoryMap.get(canonicalCatId) || catInput;

        let dateStr = item.date?.trim() || '2026-11-15';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          dateStr = new Date().toISOString().slice(0, 10);
        }

        const validPaymentMethods: PaymentMethod[] = ['upi', 'card', 'cash', 'net_banking', 'wallet'];
        const paymentMethod = validPaymentMethods.includes(item.paymentMethod as PaymentMethod)
          ? (item.paymentMethod as PaymentMethod)
          : 'upi';

        return {
          id: `tx-prop-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          date: dateStr,
          amount: Math.round(Math.abs(Number(item.amount) || 0) * 100) / 100,
          merchant: privacyMode ? sanitizeSensitiveText(item.merchant || 'Unknown Merchant') : (item.merchant || 'Unknown Merchant'),
          categoryId: canonicalCatId,
          category: resolvedCatName,
          paymentMethod,
          notes: item.notes ? (privacyMode ? sanitizeSensitiveText(item.notes) : item.notes) : undefined,
          confidence: 0.95,
        };
      });

      return {
        status: 'proposed',
        count: proposals.length,
        transactions: proposals,
        message: `Extracted ${proposals.length} transaction(s) ready for ledger review and import.`,
      };
    }

    case 'add_transaction': {
      const singleArgs = args as unknown as AddTransactionArgs;
      const catInput = singleArgs.category?.trim() || 'Groceries';
      const canonicalCatId = resolveCategoryId(catInput, categories);
      const resolvedCatName = categoryMap.get(canonicalCatId) || catInput;

      let dateStr = singleArgs.date?.trim() || '2026-11-15';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        dateStr = new Date().toISOString().slice(0, 10);
      }

      const validPaymentMethods: PaymentMethod[] = ['upi', 'card', 'cash', 'net_banking', 'wallet'];
      const paymentMethod = validPaymentMethods.includes(singleArgs.paymentMethod as PaymentMethod)
        ? (singleArgs.paymentMethod as PaymentMethod)
        : 'upi';

      const proposal: ExtractedTransactionProposal = {
        id: `tx-prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: dateStr,
        amount: Math.round(Math.abs(Number(singleArgs.amount) || 0) * 100) / 100,
        merchant: privacyMode ? sanitizeSensitiveText(singleArgs.merchant || 'Unknown Merchant') : (singleArgs.merchant || 'Unknown Merchant'),
        categoryId: canonicalCatId,
        category: resolvedCatName,
        paymentMethod,
        notes: singleArgs.notes ? (privacyMode ? sanitizeSensitiveText(singleArgs.notes) : singleArgs.notes) : undefined,
        confidence: 0.95,
      };

      return {
        status: 'proposed',
        count: 1,
        transactions: [proposal],
        message: `Transaction for ₹${proposal.amount} at ${proposal.merchant} ready for ledger review and import.`,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
