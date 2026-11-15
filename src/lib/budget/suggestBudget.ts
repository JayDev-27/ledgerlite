import { format, subMonths } from 'date-fns';
import { GoogleGenAI, Type } from '@google/genai';
import { Category, Transaction } from '@/types';
import {
  BudgetSuggestionItem,
  BudgetSuggestionResult,
} from './types';
import { secretsAdapter } from '@/lib/secrets';
import { parseReferenceDate } from '@/lib/periods/financialYear';
import { requestQueue } from '@/lib/gemini/requestQueue';

export interface CategoryHistorySummary {
  categoryId: string;
  categoryName: string;
  categoryType: 'need' | 'want' | 'savings';
  color: string;
  month1Spend: number;
  month2Spend: number;
  month3Spend: number;
  averageSpend: number;
}

export interface ThreeMonthAggregation {
  targetMonth: string;
  monthsEvaluated: string[];
  totalAverageMonthlySpend: number;
  categorySummaries: CategoryHistorySummary[];
}

/**
 * Aggregates the last 3 months of spending prior to targetMonth by category.
 */
export function aggregateThreeMonthSpend(
  targetMonth: string,
  transactions: Transaction[],
  categories: Category[]
): ThreeMonthAggregation {
  const targetDate = parseReferenceDate(`${targetMonth}-01`);
  const m1 = format(subMonths(targetDate, 1), 'yyyy-MM');
  const m2 = format(subMonths(targetDate, 2), 'yyyy-MM');
  const m3 = format(subMonths(targetDate, 3), 'yyyy-MM');
  const monthsEvaluated = [m3, m2, m1]; // Chronological order

  const topCategories = categories.filter((c) => !c.parentId);
  const catLookup = new Map(categories.map((c) => [c.id, c]));

  // Month-by-month spend map: [month][categoryId] -> spend
  const spendByMonth: Record<string, Record<string, number>> = {
    [m1]: {},
    [m2]: {},
    [m3]: {},
  };

  for (const tx of transactions) {
    const txMonth = tx.date.substring(0, 7);
    if (spendByMonth[txMonth]) {
      const cat = catLookup.get(tx.categoryId);
      const topId = cat?.parentId || tx.categoryId;
      spendByMonth[txMonth][topId] =
        (spendByMonth[txMonth][topId] || 0) + tx.amount;
    }
  }

  let totalAverage = 0;
  const categorySummaries: CategoryHistorySummary[] = topCategories.map((cat) => {
    const s1 = spendByMonth[m1]?.[cat.id] || 0;
    const s2 = spendByMonth[m2]?.[cat.id] || 0;
    const s3 = spendByMonth[m3]?.[cat.id] || 0;
    const avg = Math.round((s1 + s2 + s3) / 3);
    totalAverage += avg;

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      categoryType: cat.type,
      color: cat.color,
      month1Spend: s1,
      month2Spend: s2,
      month3Spend: s3,
      averageSpend: avg,
    };
  });

  return {
    targetMonth,
    monthsEvaluated,
    totalAverageMonthlySpend: totalAverage,
    categorySummaries,
  };
}

/**
 * Deterministic local heuristic proposing category budgets based on 3-month averages
 * and 50/30/20 Need/Want/Savings guidelines.
 */
export function generateDeterministicBudget(
  aggregation: ThreeMonthAggregation
): BudgetSuggestionResult {
  const { targetMonth, categorySummaries } = aggregation;

  const items: BudgetSuggestionItem[] = [];
  const categoryLimits: Record<string, number> = {};
  let totalLimit = 0;
  let needTotal = 0;
  let wantTotal = 0;
  let savingsTotal = 0;

  for (const cat of categorySummaries) {
    const avg = cat.averageSpend;
    let proposed = 0;
    let reason = '';

    if (cat.categoryType === 'need') {
      // 5% buffer for essential inflation / price fluctuations, rounded to clean hundred
      proposed = avg > 0 ? Math.ceil((avg * 1.05) / 100) * 100 : 2000;
      reason = `3-month avg ₹${avg.toLocaleString('en-IN')} + 5% essential cost buffer`;
      needTotal += proposed;
    } else if (cat.categoryType === 'want') {
      // 5% trimming target to promote discipline, rounded to clean hundred
      proposed = avg > 0 ? Math.max(500, Math.round((avg * 0.95) / 100) * 100) : 1000;
      reason = `3-month avg ₹${avg.toLocaleString('en-IN')} with 5% discretionary optimization`;
      wantTotal += proposed;
    } else {
      // Savings allocation: maintain or boost by 10%
      proposed = avg > 0 ? Math.round((avg * 1.1) / 500) * 500 : 5000;
      reason = `Targeting wealth accumulation aligned with 20% savings rule`;
      savingsTotal += proposed;
    }

    categoryLimits[cat.categoryId] = proposed;
    totalLimit += proposed;

    items.push({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      categoryType: cat.categoryType,
      threeMonthAverage: avg,
      proposedLimit: proposed,
      reason,
    });
  }

  const needPercent = totalLimit > 0 ? Math.round((needTotal / totalLimit) * 100) : 50;
  const wantPercent = totalLimit > 0 ? Math.round((wantTotal / totalLimit) * 100) : 30;
  const savingsPercent = totalLimit > 0 ? 100 - needPercent - wantPercent : 20;

  const rationale =
    `Generated deterministic budget from ${aggregation.monthsEvaluated.join(', ')} spending trends. ` +
    `Applies 50/30/20 rule balancing (${needPercent}% Needs, ${wantPercent}% Wants, ${savingsPercent}% Savings) ` +
    `with a 5% buffer on essentials and 5% optimization on discretionary expenses.`;

  return {
    month: targetMonth,
    totalLimit,
    categoryLimits,
    items,
    rationale,
    needPercent,
    wantPercent,
    savingsPercent,
    isAiGenerated: false,
  };
}

/**
 * Generates an intelligent budget recommendation using Gemini API if key is available,
 * falling back gracefully to the deterministic 3-month average heuristic.
 */
export async function suggestBudget(
  targetMonth: string,
  transactions: Transaction[],
  categories: Category[],
  options?: {
    apiKey?: string;
    model?: string;
  }
): Promise<BudgetSuggestionResult> {
  const aggregation = aggregateThreeMonthSpend(targetMonth, transactions, categories);
  let key = options?.apiKey;
  if (key === undefined) {
    try {
      key = await secretsAdapter.getApiKey();
    } catch {
      key = undefined;
    }
  }
  const model = options?.model || 'gemini-3.8-flash';

  if (!key || !key.trim()) {
    return generateDeterministicBudget(aggregation);
  }

  const cacheKey = `budget:${targetMonth}`;

  try {
    return await requestQueue.enqueue<BudgetSuggestionResult>({
      tier: 'heavy',
      model,
      fallbackModel: 'gemini-3.5-flash-lite',
      cacheKey,
      execute: async (effectiveModel) => {
        const ai = new GoogleGenAI({ apiKey: key.trim() });
        const payload = aggregation.categorySummaries.map((c) => ({
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          type: c.categoryType,
          threeMonthAverage: c.averageSpend,
        }));

        const response = await ai.models.generateContent({
          model: effectiveModel,
          contents: `Propose monthly category budget limits for ${targetMonth} based on this 3-month history:\n${JSON.stringify(payload, null, 2)}`,
          config: {
            systemInstruction: `You are an expert personal financial advisor specializing in Indian household budgeting.
Analyze the user's 3-month category spending history and propose pragmatic monthly limits for ${targetMonth} using the 50/30/20 rule (50% Needs, 30% Wants, 20% Savings/Investments).
Round every limit to a clean, practical number (nearest ₹500 or ₹1,000 in Indian Rupees).
Provide a concise, encouraging rationale for each category and an overall budget summary.`,
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: Type.OBJECT,
              properties: {
                totalLimit: { type: Type.NUMBER, description: 'Sum of all category limits' },
                rationale: { type: Type.STRING, description: 'Executive summary explanation of the proposed budget' },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      categoryId: { type: Type.STRING },
                      proposedLimit: { type: Type.NUMBER },
                      reason: { type: Type.STRING },
                    },
                    required: ['categoryId', 'proposedLimit', 'reason'],
                  },
                },
              },
              required: ['totalLimit', 'items', 'rationale'],
            },
          },
        });

        const parsedText = response.text?.trim();
        if (!parsedText) {
          return generateDeterministicBudget(aggregation);
        }

        const json = JSON.parse(parsedText) as {
          totalLimit: number;
          rationale: string;
          items: Array<{ categoryId: string; proposedLimit: number; reason: string }>;
        };

        if (!Array.isArray(json.items) || json.items.length === 0) {
          return generateDeterministicBudget(aggregation);
        }

        const categoryLimits: Record<string, number> = {};
        const items: BudgetSuggestionItem[] = [];
        let calculatedTotal = 0;
        let needTotal = 0;
        let wantTotal = 0;
        let savingsTotal = 0;

        for (const cat of aggregation.categorySummaries) {
          const match = json.items.find((it) => it.categoryId === cat.categoryId);
          const proposed =
            match && typeof match.proposedLimit === 'number' && match.proposedLimit > 0
              ? Math.round(match.proposedLimit)
              : cat.averageSpend > 0
              ? cat.averageSpend
              : 2000;
          const reason = match?.reason || `Derived from ₹${cat.averageSpend} average spend`;

          categoryLimits[cat.categoryId] = proposed;
          calculatedTotal += proposed;

          if (cat.categoryType === 'need') needTotal += proposed;
          else if (cat.categoryType === 'want') wantTotal += proposed;
          else savingsTotal += proposed;

          items.push({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            categoryType: cat.categoryType,
            threeMonthAverage: cat.averageSpend,
            proposedLimit: proposed,
            reason,
          });
        }

        const totalLimit = json.totalLimit > 0 ? json.totalLimit : calculatedTotal;
        const needPercent = totalLimit > 0 ? Math.round((needTotal / totalLimit) * 100) : 50;
        const wantPercent = totalLimit > 0 ? Math.round((wantTotal / totalLimit) * 100) : 30;
        const savingsPercent = totalLimit > 0 ? 100 - needPercent - wantPercent : 20;

        return {
          month: targetMonth,
          totalLimit,
          categoryLimits,
          items,
          rationale: json.rationale,
          needPercent,
          wantPercent,
          savingsPercent,
          isAiGenerated: true,
        };
      },
      fallbackDeterministic: () => generateDeterministicBudget(aggregation),
    });
  } catch (err) {
    console.warn('Gemini budget suggestion failed, falling back to heuristic:', err);
    return generateDeterministicBudget(aggregation);
  }
}
