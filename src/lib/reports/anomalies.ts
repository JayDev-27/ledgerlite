import { Transaction, Category } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { AnomalyTransaction } from './types';

export interface AnomalyDetectionOptions {
  transactions: Transaction[];
  categories: Category[];
  historicalTransactions?: Transaction[];
}

export function detectPeriodAnomalies(options: AnomalyDetectionOptions): AnomalyTransaction[] {
  const { transactions, categories, historicalTransactions } = options;
  if (!transactions.length) return [];

  const categoryMap = new Map<string, Category>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat);
  }

  // Use historical transactions if available, otherwise current period transactions
  const baseline = (historicalTransactions && historicalTransactions.length > 0)
    ? historicalTransactions
    : transactions;

  // 1. Compute Category Statistics (Mean & Standard Deviation)
  const categoryAmounts = new Map<string, number[]>();
  for (const tx of baseline) {
    const list = categoryAmounts.get(tx.categoryId) || [];
    list.push(tx.amount);
    categoryAmounts.set(tx.categoryId, list);
  }

  interface CategoryStats {
    count: number;
    mean: number;
    stdDev: number;
  }

  const categoryStats = new Map<string, CategoryStats>();
  for (const [catId, amounts] of categoryAmounts.entries()) {
    const count = amounts.length;
    const sum = amounts.reduce((acc, v) => acc + v, 0);
    const mean = sum / count;
    const variance = amounts.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    categoryStats.set(catId, { count, mean, stdDev });
  }

  // 2. Compute Merchant History for First-Time Detection
  const merchantFirstTxId = new Map<string, string>();
  const merchantTotalCounts = new Map<string, number>();

  const sortedBaseline = [...baseline].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sortedBaseline) {
    const key = tx.merchant.trim().toLowerCase();
    if (!merchantFirstTxId.has(key)) {
      merchantFirstTxId.set(key, tx.id);
    }
    merchantTotalCounts.set(key, (merchantTotalCounts.get(key) || 0) + 1);
  }

  const anomalies: AnomalyTransaction[] = [];
  const flaggedIds = new Set<string>();

  for (const tx of transactions) {
    if (flaggedIds.has(tx.id)) continue;

    const cat = categoryMap.get(tx.categoryId);
    const categoryName = cat?.name || 'Uncategorised';
    const categoryType = cat?.type || 'want';
    const stats = categoryStats.get(tx.categoryId);

    let flaggedAnomaly: AnomalyTransaction | null = null;

    // Check 1: Category multiple (> 3x category average)
    if (stats && stats.mean > 0) {
      const multiple = tx.amount / stats.mean;
      if (multiple >= 3.0 && (tx.amount - stats.mean >= 500 || tx.amount >= 1500)) {
        flaggedAnomaly = {
          id: `anomaly_${tx.id}`,
          transactionId: tx.id,
          date: tx.date,
          merchant: tx.merchant,
          amount: tx.amount,
          categoryId: tx.categoryId,
          categoryName,
          categoryType,
          reason: `Spike: Amount is ${multiple.toFixed(1)}x higher than ${categoryName} average of ${formatCurrency(stats.mean)}`,
          rule: 'category_multiple',
          severity: (tx.amount >= 10000 || multiple >= 4.0) ? 'high' : 'medium',
        };
      }
    }

    // Check 2: Statistical deviation (> 2.5 std devs above category mean, sample size >= 3)
    if (!flaggedAnomaly && stats && stats.count >= 3 && stats.stdDev > 20) {
      const threshold = stats.mean + 2.5 * stats.stdDev;
      if (tx.amount > threshold && (tx.amount - stats.mean >= 500 || tx.amount >= 1500)) {
        const devMultiple = ((tx.amount - stats.mean) / stats.stdDev).toFixed(1);
        flaggedAnomaly = {
          id: `anomaly_${tx.id}`,
          transactionId: tx.id,
          date: tx.date,
          merchant: tx.merchant,
          amount: tx.amount,
          categoryId: tx.categoryId,
          categoryName,
          categoryType,
          reason: `Outlier: Amount exceeds ${devMultiple}x standard deviations above category average (${formatCurrency(stats.mean)})`,
          rule: 'statistical_deviation',
          severity: (tx.amount >= 10000 || Number(devMultiple) >= 4.0) ? 'high' : 'medium',
        };
      }
    }

    // Check 3: First-time high-value merchant (>= ₹5,000)
    if (!flaggedAnomaly && tx.amount >= 5000) {
      const key = tx.merchant.trim().toLowerCase();
      const firstTxId = merchantFirstTxId.get(key);
      const isFirstOccurrence = firstTxId === tx.id;
      const count = merchantTotalCounts.get(key) || 1;

      if (isFirstOccurrence || count <= 1) {
        flaggedAnomaly = {
          id: `anomaly_${tx.id}`,
          transactionId: tx.id,
          date: tx.date,
          merchant: tx.merchant,
          amount: tx.amount,
          categoryId: tx.categoryId,
          categoryName,
          categoryType,
          reason: `First-time merchant interaction with high outflow of ${formatCurrency(tx.amount)}`,
          rule: 'first_time_high_value',
          severity: tx.amount >= 15000 ? 'high' : 'medium',
        };
      }
    }

    if (flaggedAnomaly) {
      anomalies.push(flaggedAnomaly);
      flaggedIds.add(tx.id);
    }
  }

  // Sort by highest amount first
  return anomalies.sort((a, b) => b.amount - a.amount);
}
