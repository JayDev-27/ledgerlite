import { GoogleGenAI, Type } from '@google/genai';
import { formatCurrency } from '@/lib/formatters';
import { PeriodPack, ReportContent } from './types';
import { generateTemplateReport } from './templateGenerator';

export interface GeminiReportOptions {
  apiKey?: string;
  modelName?: string;
  fallbackModelName?: string;
  privacyMode?: boolean;
}

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: {
      type: Type.STRING,
      description: 'A 2 to 3 paragraph executive overview analyzing total spend, pacing, 50/30/20 balance, and key drivers.',
    },
    narrativeInsights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '4 to 6 concise, bulleted analytical insights regarding budget, categories, merchants, and pacing.',
    },
    anomalies: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Observations regarding any detected spending spikes, large first-time merchants, or notable anomalies.',
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 to 5 concrete, actionable, prioritized recommendations to optimize wealth accumulation and spending discipline.',
    },
  },
  required: ['executiveSummary', 'narrativeInsights', 'anomalies', 'recommendations'],
};

export async function generateGeminiReport(
  pack: PeriodPack,
  options?: GeminiReportOptions
): Promise<ReportContent> {
  const apiKey = options?.apiKey?.trim();

  // If no API key provided, immediately return deterministic template report
  if (!apiKey) {
    return generateTemplateReport(pack);
  }

  const primaryModel = options?.modelName || 'gemini-3.8-flash';
  const fallbackModel = options?.fallbackModelName || 'gemini-3.5-flash-lite';

  // Compact prompt summarizing the local Period Pack
  const promptPayload = {
    period: {
      label: pack.periodRange.label,
      startDate: pack.periodRange.startDate,
      endDate: pack.periodRange.endDate,
      days: pack.kpis.daysInPeriod,
    },
    kpis: {
      totalSpend: formatCurrency(pack.kpis.totalSpend.current),
      totalSpendNumeric: pack.kpis.totalSpend.current,
      transactionCount: pack.kpis.transactionCount.current,
      dailyAverage: formatCurrency(pack.kpis.dailyAverage.current),
      priorSpend: pack.kpis.totalSpend.previous ? formatCurrency(pack.kpis.totalSpend.previous) : null,
      priorSpendDeltaPercent: pack.kpis.totalSpend.percentChange ?? null,
      priorSpendTrend: pack.kpis.totalSpend.trend ?? null,
    },
    distribution50_30_20: {
      needAmount: formatCurrency(pack.distribution50_30_20.need.amount),
      needPercent: `${pack.distribution50_30_20.need.percentage.toFixed(1)}%`,
      wantAmount: formatCurrency(pack.distribution50_30_20.want.amount),
      wantPercent: `${pack.distribution50_30_20.want.percentage.toFixed(1)}%`,
      savingsAmount: formatCurrency(pack.distribution50_30_20.savings.amount),
      savingsPercent: `${pack.distribution50_30_20.savings.percentage.toFixed(1)}%`,
    },
    budgetStatus: pack.budgetStatus.hasBudget
      ? {
          totalLimit: formatCurrency(pack.budgetStatus.totalLimit),
          totalSpent: formatCurrency(pack.budgetStatus.totalSpent),
          variance: formatCurrency(pack.budgetStatus.variance),
          percentUsed: `${pack.budgetStatus.percentUsed.toFixed(1)}%`,
          status: pack.budgetStatus.status,
        }
      : null,
    topCategories: pack.categoryBreakdown.slice(0, 6).map((c) => ({
      name: c.categoryName,
      type: c.categoryType,
      amount: formatCurrency(c.amount),
      percentage: `${c.percentage.toFixed(1)}%`,
      count: c.transactionCount,
      budgetVariance: c.variance !== undefined ? formatCurrency(c.variance) : null,
    })),
    topMerchants: pack.topMerchants.slice(0, 5).map((m, idx) => ({
      merchant: options?.privacyMode ? `Merchant ${idx + 1}` : m.merchant,
      amount: formatCurrency(m.amount),
      percentage: `${m.percentage.toFixed(1)}%`,
      category: m.categoryName,
    })),
    recurringExpenses: {
      totalRecurringSpend: formatCurrency(pack.recurringSummary.totalRecurringSpend),
      percentageOfSpend: `${pack.recurringSummary.percentageOfTotal.toFixed(1)}%`,
      incurredTransactions: pack.recurringSummary.incurredCount,
    },
    detectedAnomalies: pack.anomalies.map((a, idx) => ({
      merchant: options?.privacyMode ? `Merchant ${idx + 1}` : a.merchant,
      amount: formatCurrency(a.amount),
      category: a.categoryName,
      reason: a.reason,
    })),
  };

  const systemInstruction = `You are a distinguished Chief Financial Advisor and Wealth Strategist for LedgerLite, an elite personal wealth manager.
Analyze the user's period financial pack with sharp quantitative precision, encouraging wisdom, and actionable recommendations.
All monetary amounts are denominated in Indian Rupees (INR, ₹).
Format response strictly adhering to the JSON schema:
- executiveSummary: exactly 2 to 3 structured paragraphs.
- narrativeInsights: 4 to 6 crisp, analytical bullet points.
- anomalies: concise commentary on flagged spending outliers or note healthy stability if none.
- recommendations: 3 to 5 concrete, actionable behavioral or financial changes.`;

  const contents = `Analyze this financial period pack and generate an executive report:\n${JSON.stringify(
    promptPayload,
    null,
    2
  )}`;

  const callModel = async (model: string): Promise<ReportContent | null> => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: REPORT_SCHEMA,
      },
    });

    const text = response?.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as {
      executiveSummary?: string;
      narrativeInsights?: string[];
      anomalies?: string[];
      recommendations?: string[];
    };

    if (!parsed.executiveSummary || !Array.isArray(parsed.recommendations)) {
      return null;
    }

    return {
      title: `Financial Performance Report — ${pack.periodRange.label}`,
      executiveSummary: parsed.executiveSummary,
      narrativeInsights: Array.isArray(parsed.narrativeInsights) && parsed.narrativeInsights.length >= 2
        ? parsed.narrativeInsights
        : [
            `Top Outflow: ${pack.categoryBreakdown[0]?.categoryName || 'General'} captured the highest expenditure share.`,
            `Velocity: Daily average spend hovered at ${formatCurrency(pack.kpis.dailyAverage.current)}.`,
          ],
      anomaliesAnalysis: Array.isArray(parsed.anomalies) && parsed.anomalies.length > 0
        ? parsed.anomalies
        : ['No abnormal spikes detected during this reporting cycle.'],
      recommendations: parsed.recommendations,
      generatedBy: 'ai',
      modelName: model,
      footnote: '* This AI-generated report is for informational purposes and does not constitute formal financial advice.',
    };
  };

  try {
    // Attempt with heavy model (gemini-3.8-flash)
    const result = await callModel(primaryModel);
    if (result) return result;
  } catch (err) {
    console.warn(`Primary Gemini report model (${primaryModel}) failed:`, err);
  }

  try {
    // Fallback attempt with lighter model (gemini-3.5-flash-lite)
    const fallbackResult = await callModel(fallbackModel);
    if (fallbackResult) return fallbackResult;
  } catch (err) {
    console.warn(`Fallback Gemini report model (${fallbackModel}) failed:`, err);
  }

  // Graceful deterministic fallback: offline template generator
  return generateTemplateReport(pack);
}
