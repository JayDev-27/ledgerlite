import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Printer,
  Sparkles,
  FileSpreadsheet,
  FileDown,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';
import { repository } from '@/data/repository';
import { Transaction, Category, RecurringExpense } from '@/types';
import {
  PeriodType,
  PeriodRange,
  getPeriodRange,
  getPreviousPeriod,
  getNextPeriod,
} from '@/lib/periods';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { formatPercentDelta } from '@/lib/periods/comparison';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { Badge } from '@/components/common/Badge';
import { APP_NAME } from '@/constants/app';
import { useSettingsStore } from '@/store/settingsStore';

// Local Period Pack & Report Generation
import {
  PeriodPack,
  ReportContent,
  ReportRecord,
  computePeriodPack,
  generateTemplateReport,
  generateGeminiReport,
  fetchReportHistory,
  deleteReportRecord,
} from '@/lib/reports';
import { secretsAdapter } from '@/lib/secrets';

// Export Engines
import { exportReportToExcel } from '@/lib/export/excelExport';
import { generateTransactionsCsv, downloadCsv } from '@/lib/export/csvExport';

// Dashboard / Visualisation Components
import { CategoryDonutChart, CategoryDonutItem } from '@/features/dashboard/components/CategoryDonutChart';
import { SpendTrendChart, SpendTrendPoint } from '@/features/dashboard/components/SpendTrendChart';
import { NeedWantSavingsSplit } from '@/features/dashboard/components/NeedWantSavingsSplit';
import { TopMerchantsLeaderboard, TopMerchantItem } from '@/features/dashboard/components/TopMerchantsLeaderboard';
import { PaymentMethodSplit, PaymentMethodItem } from '@/features/dashboard/components/PaymentMethodSplit';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

const PERIOD_BUTTONS: Array<{ type: PeriodType; label: string }> = [
  { type: 'day', label: 'Day' },
  { type: 'week', label: 'Week' },
  { type: 'month', label: 'Month' },
  { type: 'quarter', label: 'Quarter' },
  { type: 'half-year', label: 'Half-year' },
  { type: 'year', label: 'Year' },
  { type: 'custom', label: 'Custom' },
];

export const ReportsPage: React.FC = () => {
  const { settings } = useSettingsStore();

  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [referenceDate, setReferenceDate] = useState<string>('2026-11-15');
  const [customRange, setCustomRange] = useState<{ start?: string; end?: string }>({});
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [tempCustomStart, setTempCustomStart] = useState<string>('');
  const [tempCustomEnd, setTempCustomEnd] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMethod, setGenerationMethod] = useState<'ai' | 'template'>('ai');

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);

  const [pack, setPack] = useState<PeriodPack | null>(null);
  const [reportContent, setReportContent] = useState<ReportContent | null>(null);
  const [savedReports, setSavedReports] = useState<ReportRecord[]>([]);
  const [activeSavedReportId, setActiveSavedReportId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const historyModalRef = useFocusTrap<HTMLDivElement>({
    isOpen: historyOpen,
    onClose: () => setHistoryOpen(false),
  });

  const customPickerRef = useFocusTrap<HTMLDivElement>({
    isOpen: showCustomPicker,
    onClose: () => setShowCustomPicker(false),
  });

  // Compute current period range based on active type and options
  const currentPeriod = useMemo<PeriodRange>(() => {
    return getPeriodRange(periodType, {
      referenceDate,
      financialYearStartMonth: settings.financialYearStartMonth || 4,
      weekStartsOn: settings.weekStartsOn ?? 1,
      customStartDate: customRange.start,
      customEndDate: customRange.end,
    });
  }, [periodType, referenceDate, customRange, settings.financialYearStartMonth, settings.weekStartsOn]);

  const priorPeriod = useMemo<PeriodRange>(() => {
    return getPreviousPeriod(currentPeriod, {
      financialYearStartMonth: settings.financialYearStartMonth || 4,
      weekStartsOn: settings.weekStartsOn ?? 1,
    });
  }, [currentPeriod, settings.financialYearStartMonth, settings.weekStartsOn]);

  // Load all repository data for current period
  const loadPeriodData = useCallback(async () => {
    try {
      setLoading(true);

      const [
        cats,
        curTxs,
        priorTxs,
        histRes,
        allBudgets,
        allRecurring,
        histReports,
      ] = await Promise.all([
        repository.getCategories(),
        repository.getTransactionsByDateRange(
          `${currentPeriod.startDate}T00:00:00.000Z`,
          `${currentPeriod.endDate}T23:59:59.999Z`
        ),
        repository.getTransactionsByDateRange(
          `${priorPeriod.startDate}T00:00:00.000Z`,
          `${priorPeriod.endDate}T23:59:59.999Z`
        ),
        repository.getTransactions(undefined, { page: 1, pageSize: 2000 }),
        repository.getBudgets(),
        repository.getRecurring(),
        fetchReportHistory(),
      ]);

      setCategories(cats);
      setTransactions(curTxs);
      setRecurring(allRecurring);
      setSavedReports(histReports);

      // If viewing an active saved report from history, preserve its snapshot
      if (activeSavedReportId) {
        const existingActive = histReports.find((r: ReportRecord) => r.id === activeSavedReportId);
        if (existingActive) {
          if (existingActive.pack) setPack(existingActive.pack);
          setReportContent(existingActive.content);
          setLoading(false);
          return;
        }
      }

      // Compute Local Period Pack
      const computedPack = computePeriodPack({
        transactions: curTxs,
        priorTransactions: priorTxs,
        historicalTransactions: histRes.data,
        categories: cats,
        budgets: allBudgets,
        recurring: allRecurring,
        periodRange: currentPeriod,
      });

      setPack(computedPack);

      // Check if an existing report for this period key is saved in history
      const periodKey = `${periodType}_${currentPeriod.startDate}_${currentPeriod.endDate}`;
      const existing = histReports.find((r: ReportRecord) => r.period === periodKey);

      if (existing) {
        setReportContent(existing.content);
      } else {
        // Generate deterministic template by default on initial view
        const initialContent = generateTemplateReport(computedPack);
        setReportContent(initialContent);
      }
    } catch (err) {
      console.error('Failed loading report data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPeriod, priorPeriod, periodType, activeSavedReportId]);

  useEffect(() => {
    loadPeriodData();
  }, [loadPeriodData]);

  // Handle explicit "Generate Report" action
  const handleGenerateReport = async (forceTemplate = false) => {
    if (!pack) return;
    try {
      setIsGenerating(true);
      setActiveSavedReportId(null);

      let content: ReportContent;
      if (forceTemplate || generationMethod === 'template') {
        content = generateTemplateReport(pack);
      } else {
        const apiKey = await secretsAdapter.getApiKey();
        content = await generateGeminiReport(pack, {
          apiKey,
          modelName: settings.geminiHeavyModel || 'gemini-3.8-flash',
          fallbackModelName: settings.geminiLightModel || 'gemini-3.5-flash-lite',
          privacyMode: settings.privacyMode,
        });
      }

      setReportContent(content);

      // Save report in IndexedDB reports table
      const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const periodKey = `${periodType}_${currentPeriod.startDate}_${currentPeriod.endDate}`;

      const catBreakdownMap: Record<string, number> = {};
      for (const c of pack.categoryBreakdown) {
        catBreakdownMap[c.categoryName] = c.amount;
      }

      await repository.saveReport({
        id: reportId,
        period: periodKey,
        spec: {
          title: content.title,
          startDate: currentPeriod.startDate,
          endDate: currentPeriod.endDate,
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
          periodType,
          periodLabel: currentPeriod.label,
          pack: pack as unknown,
          content: content as unknown,
        },
        createdAt: new Date().toISOString(),
      });

      // Refresh history list
      const refreshedHistory = await fetchReportHistory();
      setSavedReports(refreshedHistory);

      setToastMessage(
        content.generatedBy === 'ai'
          ? 'AI Executive Report synthesised and saved to vault.'
          : 'Deterministic financial report generated and saved.'
      );
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Report generation error:', err);
      // Fallback
      const fallbackContent = generateTemplateReport(pack);
      setReportContent(fallbackContent);
    } finally {
      setIsGenerating(false);
    }
  };

  // Chart Image Capture for Excel Embedding
  const captureChartImage = async (): Promise<string | undefined> => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }
    try {
      const svg = document.querySelector('.recharts-wrapper svg') as SVGSVGElement | null;
      if (!svg) return undefined;

      const serializer = new XMLSerializer();
      let svgStr = serializer.serializeToString(svg);
      if (!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgStr = svgStr.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      }

      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();

      return new Promise<string | undefined>((resolve) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = (img.width || 600) * 2;
            canvas.height = (img.height || 340) * 2;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/png');
              URL.revokeObjectURL(url);
              resolve(dataUrl);
            } else {
              URL.revokeObjectURL(url);
              resolve(undefined);
            }
          } catch {
            URL.revokeObjectURL(url);
            resolve(undefined);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(undefined);
        };
        img.src = url;
      });
    } catch {
      return undefined;
    }
  };

  // Excel Export
  const handleExportExcel = async () => {
    if (!pack) return;
    try {
      setExportingExcel(true);
      const chartBase64 = await captureChartImage();
      await exportReportToExcel({
        pack,
        transactions,
        categories,
        recurring,
        reportContent: reportContent || undefined,
        chartImageBase64: chartBase64,
      });
      setToastMessage('Multi-sheet Excel workbook (.xlsx with formulas & charts) downloaded.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Excel export failed:', err);
      alert('Failed to export Excel workbook. Check console for details.');
    } finally {
      setExportingExcel(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    if (!transactions.length) {
      alert('No transactions to export for this period.');
      return;
    }
    const csvData = generateTransactionsCsv(transactions, categories);
    const filename = `${APP_NAME.toLowerCase()}_transactions_${currentPeriod.shortLabel.replace(/\s+/g, '_')}_${currentPeriod.startDate}.csv`;
    downloadCsv(csvData, filename);
    setToastMessage(`Exported ${transactions.length} transactions to CSV.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Navigation handlers
  const handlePreviousPeriod = () => {
    setActiveSavedReportId(null);
    const prev = getPreviousPeriod(currentPeriod, {
      financialYearStartMonth: settings.financialYearStartMonth || 4,
      weekStartsOn: settings.weekStartsOn ?? 1,
    });
    setReferenceDate(prev.startDate);
  };

  const handleNextPeriod = () => {
    setActiveSavedReportId(null);
    const next = getNextPeriod(currentPeriod, {
      financialYearStartMonth: settings.financialYearStartMonth || 4,
      weekStartsOn: settings.weekStartsOn ?? 1,
    });
    setReferenceDate(next.startDate);
  };

  const handleLoadSavedReport = (saved: ReportRecord) => {
    setActiveSavedReportId(saved.id);
    if (saved.pack) {
      setPack(saved.pack);
    }
    setReportContent(saved.content);
    setPeriodType(saved.periodType);
    setReferenceDate(saved.startDate);
    if (saved.periodType === 'custom') {
      setCustomRange({ start: saved.startDate, end: saved.endDate });
    }
    setHistoryOpen(false);
    setToastMessage(`Loaded archived report: ${saved.title}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteSavedReport = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this report record from local vault?')) {
      await deleteReportRecord(id);
      setSavedReports((prev) => prev.filter((r) => r.id !== id));
    }
  };

  // Prepare chart payloads
  const donutData: CategoryDonutItem[] = useMemo(() => {
    if (!pack) return [];
    return pack.categoryBreakdown.slice(0, 8).map((cat) => ({
      id: cat.categoryId,
      name: cat.categoryName,
      amount: cat.amount,
      color: cat.color,
      percent: Math.round(cat.percentage),
    }));
  }, [pack]);

  const trendData: SpendTrendPoint[] = useMemo(() => {
    if (!pack) return [];
    return pack.dailyTrend.map((p) => ({
      date: p.date,
      label: p.label,
      amount: p.amount,
      txCount: p.count,
    }));
  }, [pack]);

  const merchantItems: TopMerchantItem[] = useMemo(() => {
    if (!pack) return [];
    return pack.topMerchants.map((m) => ({
      merchant: m.merchant,
      totalAmount: m.amount,
      txCount: m.count,
      categoryName: m.categoryName,
      percent: Math.round(m.percentage),
    }));
  }, [pack]);

  const paymentItems: PaymentMethodItem[] = useMemo(() => {
    if (!pack) return [];
    const colors = ['#16587B', '#84B3CE', '#C05621', '#276749', '#9B2C2C'];
    return pack.paymentMethods.map((m, idx) => ({
      id: m.method,
      name: m.label,
      amount: m.amount,
      txCount: m.count,
      percent: Math.round(m.percentage),
      color: colors[idx % colors.length] || '#16587B',
    }));
  }, [pack]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Printable Cover Header (Only visible in print / window.print() view) */}
      <div className="hidden print:block mb-8 border-b-2 border-deep-blue-900 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-deep-blue-950">
              {APP_NAME} — Financial Performance Report
            </h1>
            <p className="text-xs text-deep-blue-800">
              Personal Wealth Vault • Statement of Outflows & Capital Allocation
            </p>
          </div>
          <div className="text-right text-xs">
            <div className="font-bold text-deep-blue-950">{currentPeriod.label}</div>
            <div className="text-deep-blue-700">
              {currentPeriod.startDate} to {currentPeriod.endDate}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              Generated: {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </div>
          </div>
        </div>
      </div>

      {/* Screen Toolbar (Hidden during print) */}
      <div className="print:hidden flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 sm:p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
        {/* Period Type Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-cream-100 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border">
          {PERIOD_BUTTONS.map((btn) => (
            <button
              key={btn.type}
              onClick={() => {
                setActiveSavedReportId(null);
                setPeriodType(btn.type);
                if (btn.type === 'custom') {
                  setTempCustomStart(customRange.start || currentPeriod.startDate);
                  setTempCustomEnd(customRange.end || currentPeriod.endDate);
                  setShowCustomPicker(true);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodType === btn.type
                  ? 'bg-deep-blue-500 text-cream-100 shadow-sm'
                  : 'text-deep-blue-800 dark:text-cream-300 hover:text-deep-blue-950 dark:hover:text-white'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Period Range Navigation & Generator */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Previous / Next Period Navigation */}
          {periodType !== 'custom' && (
            <div className="flex items-center rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border p-0.5">
              <button
                onClick={handlePreviousPeriod}
                className="p-1.5 rounded-lg text-deep-blue-700 dark:text-cream-300 hover:bg-cream-200/60 dark:hover:bg-dark-border transition-colors"
                title="Previous period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-semibold text-deep-blue-950 dark:text-cream-100 whitespace-nowrap">
                {currentPeriod.label}
              </span>
              <button
                onClick={handleNextPeriod}
                className="p-1.5 rounded-lg text-deep-blue-700 dark:text-cream-300 hover:bg-cream-200/60 dark:hover:bg-dark-border transition-colors"
                title="Next period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* AI vs Template Mode Toggle */}
          <div className="flex items-center rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border p-0.5 text-[11px] font-semibold">
            <button
              onClick={() => setGenerationMethod('ai')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                generationMethod === 'ai'
                  ? 'bg-deep-blue-500 text-cream-100 shadow-xs'
                  : 'text-deep-blue-700 dark:text-cream-300'
              }`}
            >
              <Sparkles className="w-3 h-3 text-cream-200" />
              <span>AI</span>
            </button>
            <button
              onClick={() => setGenerationMethod('template')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                generationMethod === 'template'
                  ? 'bg-deep-blue-500 text-cream-100 shadow-xs'
                  : 'text-deep-blue-700 dark:text-cream-300'
              }`}
            >
              <span>Offline</span>
            </button>
          </div>

          {/* Generate Report Button */}
          <button
            onClick={() => handleGenerateReport(false)}
            disabled={isGenerating || loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 active:bg-deep-blue-700 text-cream-100 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Synthesising...' : 'Generate Report'}</span>
          </button>

          {/* Report History Drawer Toggle */}
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-surface text-xs font-semibold transition-colors"
            title="Browse past report history"
          >
            <History className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
            <span className="hidden sm:inline">History</span>
            {savedReports.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-deep-blue-100 dark:bg-dark-surface text-[10px] font-bold text-deep-blue-800 dark:text-cream-100">
                {savedReports.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Toast message notice */}
      {toastMessage && (
        <div className="print:hidden p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 ml-4 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Report Header & Action Bar */}
      <div className="print:hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-deep-blue-950 dark:text-cream-100">
              {reportContent?.title || `Report — ${currentPeriod.label}`}
            </h2>
            <Badge variant={reportContent?.generatedBy === 'ai' ? 'info' : 'neutral'} size="sm">
              {reportContent?.generatedBy === 'ai'
                ? `AI Synthesised (${reportContent.modelName || 'Gemini'})`
                : 'Offline Deterministic'}
            </Badge>
          </div>
          <p className="text-xs text-deep-blue-700/80 dark:text-cream-300">
            Dates: <strong>{currentPeriod.startDate}</strong> to <strong>{currentPeriod.endDate}</strong> •{' '}
            {pack?.kpis.daysInPeriod || 0} calendar days • {transactions.length} total transactions
          </p>
        </div>

        {/* Action Buttons: Print, Export Excel, Export CSV */}
        <div className="print:hidden flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <button
            onClick={handleExportExcel}
            disabled={exportingExcel || !pack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            title="Download multi-sheet Excel workbook with formulas"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{exportingExcel ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={!transactions.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-700 dark:text-cream-200 hover:bg-cream-100 dark:hover:bg-dark-surface text-xs font-semibold transition-colors disabled:opacity-50"
            title="Download RFC 4180 CSV statement"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-700 dark:text-cream-200 hover:bg-cream-100 dark:hover:bg-dark-surface text-xs font-semibold transition-colors"
            title="Print or Save to PDF (A4 Layout)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6">
          <SkeletonLoader variant="kpi" count={4} />
          <SkeletonLoader variant="card" count={1} />
        </div>
      ) : (
        <>
          {/* 1. Executive KPI Cards (4 Cards) */}
          {pack && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Spend */}
              <div className="p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-2">
                <div className="text-xs font-bold text-deep-blue-700 dark:text-cream-300 uppercase tracking-wider">
                  Total Period Outflow
                </div>
                <div className="text-2xl font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">
                  {formatCurrency(pack.kpis.totalSpend.current)}
                </div>
                {pack.kpis.totalSpend.previous !== undefined && (
                  <div className="flex items-center gap-1.5 text-xs">
                    {pack.kpis.totalSpend.trend === 'up' ? (
                      <span className="flex items-center font-bold text-rose-600 dark:text-rose-400">
                        <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                        {formatPercentDelta(pack.kpis.totalSpend.percentChange || 0)}
                      </span>
                    ) : pack.kpis.totalSpend.trend === 'down' ? (
                      <span className="flex items-center font-bold text-emerald-600 dark:text-emerald-400">
                        <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                        {formatPercentDelta(pack.kpis.totalSpend.percentChange || 0)}
                      </span>
                    ) : (
                      <span className="flex items-center text-deep-blue-600 dark:text-cream-300 font-semibold">
                        <Minus className="w-3.5 h-3.5 mr-0.5" /> Flat
                      </span>
                    )}
                    <span className="text-[11px] text-deep-blue-600/70 dark:text-cream-300">
                      vs prior {formatCurrency(pack.kpis.totalSpend.previous)}
                    </span>
                  </div>
                )}
              </div>

              {/* Transaction Count */}
              <div className="p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-2">
                <div className="text-xs font-bold text-deep-blue-700 dark:text-cream-300 uppercase tracking-wider">
                  Transaction Volume
                </div>
                <div className="text-2xl font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">
                  {pack.kpis.transactionCount.current}{' '}
                  <span className="text-xs font-normal text-deep-blue-600 dark:text-cream-300">txs</span>
                </div>
                {pack.kpis.transactionCount.previous !== undefined && (
                  <div className="text-xs text-deep-blue-600/70 dark:text-cream-300">
                    Prior period: <strong>{pack.kpis.transactionCount.previous}</strong> (
                    {formatPercentDelta(pack.kpis.transactionCount.percentChange || 0)})
                  </div>
                )}
              </div>

              {/* Daily Average */}
              <div className="p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-2">
                <div className="text-xs font-bold text-deep-blue-700 dark:text-cream-300 uppercase tracking-wider">
                  Daily Burn Rate
                </div>
                <div className="text-2xl font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">
                  {formatCurrency(pack.kpis.dailyAverage.current)}
                  <span className="text-xs font-normal text-deep-blue-600 dark:text-cream-300">/day</span>
                </div>
                {pack.kpis.dailyAverage.previous !== undefined && (
                  <div className="text-xs text-deep-blue-600/70 dark:text-cream-300">
                    Prior pace: {formatCurrency(pack.kpis.dailyAverage.previous)}/day
                  </div>
                )}
              </div>

              {/* Budget Variance */}
              <div className="p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-2">
                <div className="text-xs font-bold text-deep-blue-700 dark:text-cream-300 uppercase tracking-wider">
                  Budget Headroom
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${
                    pack.budgetStatus.variance >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {pack.budgetStatus.hasBudget && pack.budgetStatus.totalLimit > 0
                    ? formatCurrency(pack.budgetStatus.variance)
                    : 'No Limit Set'}
                </div>
                <div className="text-xs text-deep-blue-600/70 dark:text-cream-300">
                  {pack.budgetStatus.hasBudget && pack.budgetStatus.totalLimit > 0
                    ? `${pack.budgetStatus.percentUsed.toFixed(1)}% of ${formatCurrency(pack.budgetStatus.totalLimit)}`
                    : 'Configure in Budgets tab'}
                </div>
              </div>
            </div>
          )}

          {/* 2. Narrative Insights & Actionable Recommendations */}
          {reportContent && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Executive Narrative Overview */}
              <div className="lg:col-span-2 p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
                <div className="flex items-center gap-2 text-deep-blue-800 dark:text-cream-300 font-bold text-xs uppercase tracking-wider border-b border-cream-200 dark:border-dark-border pb-3">
                  <Sparkles className="w-4 h-4 text-deep-blue-500 dark:text-cream-300" />
                  <span>Executive Financial Review</span>
                </div>

                <div className="space-y-3 text-xs sm:text-sm text-deep-blue-900/90 dark:text-cream-200 leading-relaxed whitespace-pre-line">
                  {reportContent.executiveSummary}
                </div>

                {/* Analytical Bullets */}
                {reportContent.narrativeInsights.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-cream-200 dark:border-dark-border space-y-2.5">
                    <div className="text-xs font-bold text-deep-blue-900 dark:text-cream-100 uppercase tracking-wider">
                      Key Quantitative Observations
                    </div>
                    <ul className="space-y-2 text-xs text-deep-blue-800 dark:text-cream-200">
                      {reportContent.narrativeInsights.map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-deep-blue-500 mt-1.5 flex-shrink-0" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Actionable Recommendations Card */}
              <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-deep-blue-800 dark:text-cream-300 font-bold text-xs uppercase tracking-wider border-b border-cream-200 dark:border-dark-border pb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Strategic Recommendations</span>
                  </div>

                  <div className="space-y-3">
                    {reportContent.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-xs leading-relaxed text-deep-blue-900 dark:text-cream-200 space-y-1"
                      >
                        <div className="font-bold text-deep-blue-950 dark:text-cream-100 flex items-center justify-between">
                          <span>Action {idx + 1}</span>
                          <span className="text-[10px] font-semibold text-deep-blue-600 dark:text-cream-300">
                            {idx === 0 ? 'High Priority' : 'Optimisation'}
                          </span>
                        </div>
                        <p>{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-cream-200 dark:border-dark-border text-[10px] text-deep-blue-500/70 dark:text-cream-300 italic text-center">
                  {reportContent.footnote}
                </div>
              </div>
            </div>
          )}

          {/* 3. Visualizations Grid */}
          {pack && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Donut */}
              <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
                <h3 className="text-sm font-bold text-deep-blue-950 dark:text-cream-100 mb-1">
                  Category Distribution
                </h3>
                <p className="text-xs text-deep-blue-700/70 dark:text-cream-300 mb-4">
                  Outflows segmented by top functional categories
                </p>
                <CategoryDonutChart data={donutData} totalSpend={pack.kpis.totalSpend.current} />
              </div>

              {/* Daily Spend Trend */}
              <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
                <h3 className="text-sm font-bold text-deep-blue-950 dark:text-cream-100 mb-1">
                  Daily Spending Velocity
                </h3>
                <p className="text-xs text-deep-blue-700/70 dark:text-cream-300 mb-4">
                  Day-by-day cash disbursement pacing over period
                </p>
                <SpendTrendChart data={trendData} />
              </div>

              {/* 50/30/20 Framework Progress */}
              <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
                <h3 className="text-sm font-bold text-deep-blue-950 dark:text-cream-100 mb-1">
                  50 / 30 / 20 Wealth Allocation Split
                </h3>
                <p className="text-xs text-deep-blue-700/70 dark:text-cream-300 mb-4">
                  Needs (50%) vs Wants (30%) vs Savings (20%)
                </p>
                <NeedWantSavingsSplit
                  needSpent={pack.distribution50_30_20.need.amount}
                  wantSpent={pack.distribution50_30_20.want.amount}
                  savingsSpent={pack.distribution50_30_20.savings.amount}
                  totalSpend={pack.kpis.totalSpend.current}
                />
              </div>

              {/* Top Merchants Leaderboard */}
              <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
                <h3 className="text-sm font-bold text-deep-blue-950 dark:text-cream-100 mb-1">
                  Top Payee Concentration
                </h3>
                <p className="text-xs text-deep-blue-700/70 dark:text-cream-300 mb-4">
                  Highest volume recipients during the active period
                </p>
                <TopMerchantsLeaderboard merchants={merchantItems} totalSpend={pack.kpis.totalSpend.current} />
              </div>

              {/* Payment Method Split */}
              <div className="lg:col-span-2 p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
                <h3 className="text-sm font-bold text-deep-blue-950 dark:text-cream-100 mb-1">
                  Disbursement Instruments
                </h3>
                <p className="text-xs text-deep-blue-700/70 dark:text-cream-300 mb-4">
                  UPI, Credit/Debit Cards, Net Banking, and Cash distribution
                </p>
                <PaymentMethodSplit data={paymentItems} />
              </div>
            </div>
          )}

          {/* 4. Anomaly Transactions Table */}
          {pack && (
            <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-deep-blue-950 dark:text-cream-100 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Flagged Outlier Transactions & Spikes</span>
                  </h3>
                  <p className="text-xs text-deep-blue-700/70 dark:text-cream-300">
                    Automated anomaly detection (&gt;2.5 standard deviations, &gt;3x category average, or high first-time payees)
                  </p>
                </div>
                <Badge variant={pack.anomalies.length > 0 ? 'warning' : 'success'}>
                  {pack.anomalies.length > 0 ? `${pack.anomalies.length} Flagged` : 'All Clear'}
                </Badge>
              </div>

              {pack.anomalies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-cream-200 dark:border-dark-border text-left font-bold text-deep-blue-700 dark:text-cream-300">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Merchant</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Anomaly Rationale</th>
                        <th className="py-2.5 px-3">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-100 dark:divide-dark-border">
                      {pack.anomalies.map((anom) => (
                        <tr key={anom.id} className="hover:bg-cream-50/50 dark:hover:bg-dark-elevated/40">
                          <td className="py-2 px-3 tabular-nums text-deep-blue-800 dark:text-cream-300">
                            {formatDate(anom.date, 'd MMM yyyy')}
                          </td>
                          <td className="py-2 px-3 font-semibold text-deep-blue-950 dark:text-cream-100">
                            {anom.merchant}
                          </td>
                          <td className="py-2 px-3 text-deep-blue-800 dark:text-cream-300">
                            {anom.categoryName}
                          </td>
                          <td className="py-2 px-3 font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">
                            {formatCurrency(anom.amount)}
                          </td>
                          <td className="py-2 px-3 text-deep-blue-700 dark:text-cream-300">
                            {anom.reason}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                anom.severity === 'high'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {anom.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    No abnormal spending spikes or unexpected outliers detected in this reporting cycle.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 5. Complete Category Breakdown Table */}
          {pack && (
            <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-deep-blue-950 dark:text-cream-100">
                    Comprehensive Category Breakdown
                  </h3>
                  <p className="text-xs text-deep-blue-700/70 dark:text-cream-300">
                    Complete breakdown including allocated budget limits and headroom
                  </p>
                </div>
                <div className="text-xs font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">
                  Total: {formatCurrency(pack.kpis.totalSpend.current)}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-cream-200 dark:border-dark-border text-left font-bold text-deep-blue-700 dark:text-cream-300">
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Transactions</th>
                      <th className="py-2.5 px-3">Spend (₹)</th>
                      <th className="py-2.5 px-3">% Share</th>
                      <th className="py-2.5 px-3">Budget Limit</th>
                      <th className="py-2.5 px-3">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100 dark:divide-dark-border">
                    {pack.categoryBreakdown.map((cat) => (
                      <tr key={cat.categoryId} className="hover:bg-cream-50/50 dark:hover:bg-dark-elevated/40">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="font-semibold text-deep-blue-950 dark:text-cream-100">
                              {cat.categoryName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-deep-blue-700 dark:text-cream-300">
                          {cat.categoryType}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-deep-blue-800 dark:text-cream-300">
                          {cat.transactionCount}
                        </td>
                        <td className="py-2.5 px-3 font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">
                          {formatCurrency(cat.amount)}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-deep-blue-800 dark:text-cream-300">
                          {cat.percentage.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-deep-blue-700 dark:text-cream-300">
                          {cat.budgetLimit !== undefined && cat.budgetLimit > 0
                            ? formatCurrency(cat.budgetLimit)
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums font-semibold">
                          {cat.variance !== undefined ? (
                            <span className={cat.variance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                              {cat.variance >= 0 ? '+' : ''}
                              {formatCurrency(cat.variance)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. Recurring Obligations Summary */}
          {pack && (
            <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-deep-blue-950 dark:text-cream-100 flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-deep-blue-600 dark:text-cream-300" />
                    <span>Fixed Recurring Obligations &amp; Subscriptions</span>
                  </h3>
                  <p className="text-xs text-deep-blue-700/70 dark:text-cream-300">
                    Recurring expenses and predictable debit baseline
                  </p>
                </div>
                <div className="text-xs font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">
                  {formatCurrency(pack.recurringSummary.totalRecurringSpend)} in period
                </div>
              </div>

              {pack.recurringSummary.items.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pack.recurringSummary.items.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-deep-blue-950 dark:text-cream-100 truncate">
                          {rec.merchant}
                        </span>
                        <span className="font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">
                          {formatCurrency(rec.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-deep-blue-700/80 dark:text-cream-300">
                        <span>{rec.categoryName}</span>
                        <span className="uppercase font-semibold">{rec.cadence}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-deep-blue-600/70 dark:text-cream-300 italic">
                  No recurring obligations configured.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Report History Drawer Modal */}
      {historyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reports-vault-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryOpen(false);
          }}
        >
          <div
            ref={historyModalRef}
            className="bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col shadow-card"
          >
            <div className="flex items-center justify-between border-b border-cream-200 dark:border-dark-border pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-deep-blue-700 dark:text-cream-200" />
                <h3 id="reports-vault-title" className="text-base font-bold text-deep-blue-950 dark:text-cream-100">
                  Archived Reports Vault
                </h3>
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                aria-label="Close archived reports vault"
                title="Close archived reports vault"
                className="p-1 rounded-lg text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-blue-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-deep-blue-700/70 dark:text-cream-300">
              Locally stored financial reports from IndexedDB. Click any record to restore its exact analytical snapshot.
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {savedReports.length === 0 ? (
                <div className="text-center py-10 text-xs text-deep-blue-600 dark:text-cream-300">
                  No historical reports archived yet. Generate a report to save it here.
                </div>
              ) : (
                savedReports.map((saved) => (
                  <div
                    key={saved.id}
                    onClick={() => handleLoadSavedReport(saved)}
                    className="p-4 rounded-xl bg-cream-50/70 dark:bg-dark-elevated/50 border border-cream-200 dark:border-dark-border hover:border-sky-400 cursor-pointer transition-all flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-deep-blue-950 dark:text-cream-100 truncate">
                          {saved.title}
                        </span>
                        <Badge variant={saved.content.generatedBy === 'ai' ? 'info' : 'neutral'} size="sm">
                          {saved.content.generatedBy === 'ai' ? 'AI' : 'Template'}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-deep-blue-700/70 dark:text-cream-300">
                        Dates: {saved.startDate} to {saved.endDate} • Generated {formatDate(saved.createdAt, 'd MMM yyyy, h:mm a')}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={(e) => handleDeleteSavedReport(e, saved.id)}
                        aria-label={`Delete report ${saved.title}`}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        title="Delete report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-cream-200 dark:border-dark-border flex justify-end">
              <button
                onClick={() => setHistoryOpen(false)}
                className="px-4 py-2 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-blue-500"
              >
                Close Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Date Range Picker Modal */}
      {showCustomPicker && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-picker-title"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCustomPicker(false);
          }}
        >
          <div
            ref={customPickerRef}
            className="bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-card"
          >
            <div className="flex items-center justify-between">
              <h3 id="custom-picker-title" className="text-sm font-bold text-deep-blue-950 dark:text-cream-100">
                Select Custom Period Range
              </h3>
              <button
                onClick={() => setShowCustomPicker(false)}
                aria-label="Close custom range dialog"
                title="Close custom range dialog"
                className="p-1 rounded-lg text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-blue-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-deep-blue-700 dark:text-cream-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={tempCustomStart || currentPeriod.startDate}
                  onChange={(e) => setTempCustomStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-950 dark:text-cream-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-deep-blue-700 dark:text-cream-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={tempCustomEnd || currentPeriod.endDate}
                  onChange={(e) => setTempCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-950 dark:text-cream-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCustomPicker(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  let s = tempCustomStart || currentPeriod.startDate;
                  let e = tempCustomEnd || currentPeriod.endDate;
                  if (s > e) [s, e] = [e, s];
                  setCustomRange({ start: s, end: e });
                  setActiveSavedReportId(null);
                  setShowCustomPicker(false);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-deep-blue-500 text-cream-100 hover:bg-deep-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-blue-500"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
