import { repository } from '@/data/repository';
import { secretsAdapter } from '@/lib/secrets';
import { PeriodType, getPeriodRange, getPreviousPeriod } from '@/lib/periods';
import { ReportItem, Transaction } from '@/types';
import { computePeriodPack } from './periodPack';
import { generateGeminiReport } from './geminiReportGenerator';
import { generateTemplateReport } from './templateGenerator';
import { PeriodPack, ReportContent, ReportRecord } from './types';

export interface GenerateReportOptions {
  periodType: PeriodType;
  referenceDate?: string;
  customStartDate?: string;
  customEndDate?: string;
  forceTemplate?: boolean;
}

export async function buildPeriodPack(
  periodType: PeriodType,
  options?: {
    referenceDate?: string;
    customStartDate?: string;
    customEndDate?: string;
  }
): Promise<{ pack: PeriodPack; transactions: Transaction[]; priorTransactions: Transaction[] }> {
  const periodRange = getPeriodRange(periodType, {
    referenceDate: options?.referenceDate,
    customStartDate: options?.customStartDate,
    customEndDate: options?.customEndDate,
  });

  const priorRange = getPreviousPeriod(periodRange);

  // Load data concurrently
  const [
    currentTxs,
    priorTxs,
    historicalRes,
    categories,
    budgets,
    recurring,
  ] = await Promise.all([
    repository.getTransactionsByDateRange(
      `${periodRange.startDate}T00:00:00.000Z`,
      `${periodRange.endDate}T23:59:59.999Z`
    ),
    repository.getTransactionsByDateRange(
      `${priorRange.startDate}T00:00:00.000Z`,
      `${priorRange.endDate}T23:59:59.999Z`
    ),
    repository.getTransactions(undefined, { page: 1, pageSize: 2000 }),
    repository.getCategories(),
    repository.getBudgets(),
    repository.getRecurring(),
  ]);

  const pack = computePeriodPack({
    transactions: currentTxs,
    priorTransactions: priorTxs,
    historicalTransactions: historicalRes.data,
    categories,
    budgets,
    recurring,
    periodRange,
  });

  return { pack, transactions: currentTxs, priorTransactions: priorTxs };
}

export async function generateAndSaveReport(
  options: GenerateReportOptions
): Promise<ReportRecord> {
  const { pack } = await buildPeriodPack(options.periodType, {
    referenceDate: options.referenceDate,
    customStartDate: options.customStartDate,
    customEndDate: options.customEndDate,
  });

  let content: ReportContent;

  if (options.forceTemplate) {
    content = generateTemplateReport(pack);
  } else {
    const apiKey = await secretsAdapter.getApiKey();
    const settings = await repository.getAllSettings();
    content = await generateGeminiReport(pack, {
      apiKey,
      modelName: (settings?.geminiHeavyModel as string) || 'gemini-3.8-flash',
      fallbackModelName: (settings?.geminiLightModel as string) || 'gemini-3.5-flash-lite',
      privacyMode: settings?.privacyMode as boolean | undefined,
    });
  }

  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const periodKey = `${options.periodType}_${pack.periodRange.startDate}_${pack.periodRange.endDate}`;

  // Build category breakdown object for legacy spec compatibility
  const catBreakdownMap: Record<string, number> = {};
  for (const c of pack.categoryBreakdown) {
    catBreakdownMap[c.categoryName] = c.amount;
  }

  const reportItem: ReportItem = {
    id: reportId,
    period: periodKey,
    spec: {
      title: content.title,
      startDate: pack.periodRange.startDate,
      endDate: pack.periodRange.endDate,
      totalSpend: pack.kpis.totalSpend.current,
      totalSavings: pack.distribution50_30_20.savings.amount,
      categoryBreakdown: catBreakdownMap,
      summaryNarrative: content.executiveSummary,
      recommendations: content.recommendations,
      anomalies: pack.anomalies.map((a) => ({
        merchant: a.merchant,
        amount: a.amount,
        reason: a.reason,
      })),
      rawPack: pack as unknown as Record<string, unknown>,
      periodType: options.periodType,
      periodLabel: pack.periodRange.label,
      pack: pack as unknown,
      content: content as unknown,
    },
    createdAt: new Date().toISOString(),
  };

  await repository.saveReport(reportItem);

  return {
    id: reportId,
    period: periodKey,
    title: content.title,
    periodType: options.periodType,
    startDate: pack.periodRange.startDate,
    endDate: pack.periodRange.endDate,
    createdAt: reportItem.createdAt,
    pack,
    content,
  };
}

export async function fetchReportHistory(): Promise<ReportRecord[]> {
  const items = await repository.getReports();
  return items.map((item) => {
    const spec = item.spec as {
      title?: string;
      periodType?: PeriodType;
      periodLabel?: string;
      startDate?: string;
      endDate?: string;
      pack?: PeriodPack;
      rawPack?: Record<string, unknown>;
      content?: ReportContent;
      summaryNarrative?: string;
      recommendations?: string[];
      totalSpend?: number;
    };

    const pack = spec.pack || (spec.rawPack as unknown as PeriodPack);
    const content = spec.content || {
      title: spec.title || 'Report',
      executiveSummary: spec.summaryNarrative || 'Summary unavailable',
      narrativeInsights: [],
      anomaliesAnalysis: [],
      recommendations: spec.recommendations || [],
      generatedBy: 'template',
      footnote: '* Historical report archive.',
    };

    return {
      id: item.id,
      period: item.period,
      title: spec.title || `Report ${item.period}`,
      periodType: (spec.periodType as PeriodType) || 'month',
      startDate: spec.startDate || '',
      endDate: spec.endDate || '',
      createdAt: item.createdAt,
      pack: pack as PeriodPack,
      content: content as ReportContent,
    };
  });
}

export async function deleteReportRecord(id: string): Promise<void> {
  await repository.deleteReport(id);
}
