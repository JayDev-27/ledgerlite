import type { Repository } from '@/data/repository/types';
import type { RecurringCadence, Transaction } from '@/types';

/**
 * Calculates the next due date given an ISO date string and cadence
 */
export function advanceDueDate(currentDueStr: string, cadence: RecurringCadence): string {
  const parts = currentDueStr.split('-').map(Number);
  const year = parts[0] ?? 2026;
  const month = (parts[1] ?? 1) - 1; // 0-indexed
  const day = parts[2] ?? 1;

  switch (cadence) {
    case 'daily': {
      const d = new Date(Date.UTC(year, month, day + 1));
      return d.toISOString().slice(0, 10);
    }
    case 'weekly': {
      const d = new Date(Date.UTC(year, month, day + 7));
      return d.toISOString().slice(0, 10);
    }
    case 'biweekly': {
      const d = new Date(Date.UTC(year, month, day + 14));
      return d.toISOString().slice(0, 10);
    }
    case 'monthly': {
      const totalMonths = year * 12 + month + 1;
      const targetYear = Math.floor(totalMonths / 12);
      const targetMonth = totalMonths % 12;
      const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      const clampedDay = Math.min(day, daysInTargetMonth);
      return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    }
    case 'quarterly': {
      const totalMonths = year * 12 + month + 3;
      const targetYear = Math.floor(totalMonths / 12);
      const targetMonth = totalMonths % 12;
      const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      const clampedDay = Math.min(day, daysInTargetMonth);
      return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    }
    case 'yearly': {
      const targetYear = year + 1;
      const daysInTargetMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
      const clampedDay = Math.min(day, daysInTargetMonth);
      return `${targetYear}-${String(month + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    }
  }
}

export interface RecurringGenerationResult {
  generatedCount: number;
  generatedTransactions: Transaction[];
}

/**
 * Checks all active recurring templates and creates transactions for any whose nextDue <= asOfDate
 */
export async function generateDueRecurringTransactions(
  repository: Repository,
  asOfDateStr?: string
): Promise<RecurringGenerationResult> {
  const todayStr: string = asOfDateStr || (new Date().toISOString().split('T')[0] ?? '2026-11-15');
  const allRecurring = await repository.getRecurring();
  const activeDue = allRecurring.filter((r) => r.active && r.nextDue <= todayStr);

  const generatedTransactions: Transaction[] = [];

  for (const item of activeDue) {
    let currentNextDue = item.nextDue;

    // Advance and generate for each missed period up to today
    while (currentNextDue <= todayStr) {
      const tx = await repository.createTransaction({
        amount: item.template.amount,
        currency: item.template.currency || 'INR',
        date: `${currentNextDue}T09:00:00.000Z`,
        merchant: item.template.merchant,
        categoryId: item.template.categoryId,
        subcategoryId: item.template.subcategoryId,
        paymentMethod: item.template.paymentMethod,
        notes: item.template.notes,
        tags: Array.from(new Set([...(item.template.tags || []), 'recurring', item.cadence])),
        recurringId: item.id,
        source: 'recurring',
        confidence: 1.0,
      });

      generatedTransactions.push(tx);
      currentNextDue = advanceDueDate(currentNextDue, item.cadence);
    }

    // Update recurring expense in database with next future due date
    await repository.updateRecurring(item.id, {
      nextDue: currentNextDue,
    });
  }

  return {
    generatedCount: generatedTransactions.length,
    generatedTransactions,
  };
}
