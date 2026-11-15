import { format, subMonths } from 'date-fns';
import { Budget, Category, Transaction } from '@/types';
import { parseReferenceDate } from '@/lib/periods/financialYear';

export interface RolloverComputation {
  previousMonth: string;
  totalRollover: number;
  categoryRollovers: Record<string, number>;
}

export function computeRolloverFromPreviousMonth(
  currentMonth: string,
  previousBudget: Budget | undefined,
  previousMonthTransactions: Transaction[],
  categories?: Category[]
): RolloverComputation {
  const currentDate = parseReferenceDate(`${currentMonth}-01`);
  const prevMonthStr = format(subMonths(currentDate, 1), 'yyyy-MM');

  if (!previousBudget) {
    return {
      previousMonth: prevMonthStr,
      totalRollover: 0,
      categoryRollovers: {},
    };
  }

  // Calculate previous month total spend
  const prevTxs = previousMonthTransactions.filter((tx) =>
    tx.date.startsWith(previousBudget.month)
  );

  const catLookup = categories ? new Map(categories.map((c) => [c.id, c])) : null;
  let prevTotalSpent = 0;
  const prevCatSpent: Record<string, number> = {};

  for (const tx of prevTxs) {
    prevTotalSpent += tx.amount;
    const cat = catLookup?.get(tx.categoryId);
    const topCatId = cat?.parentId || tx.categoryId;
    prevCatSpent[topCatId] = (prevCatSpent[topCatId] || 0) + tx.amount;
  }

  // Unspent total surplus (capped at 0 so deficits don't create negative rollover unless specified)
  const totalRollover = Math.max(0, previousBudget.totalLimit - prevTotalSpent);

  // Per category rollover
  const categoryRollovers: Record<string, number> = {};
  for (const [catId, limit] of Object.entries(previousBudget.categoryLimits)) {
    const spent = prevCatSpent[catId] || 0;
    const surplus = Math.max(0, limit - spent);
    if (surplus > 0) {
      categoryRollovers[catId] = surplus;
    }
  }

  return {
    previousMonth: previousBudget.month,
    totalRollover,
    categoryRollovers,
  };
}
