import React, { useState, useEffect } from 'react';
import {
  Printer,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';
import { repository } from '@/data/repository';
import { Transaction } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';

export const ReportsPage: React.FC = () => {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'fy'>('month');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const loadReportData = async () => {
      try {
        setLoading(true);
        let startDate = '2026-11-01';
        let endDate = '2026-11-30T23:59:59';

        if (period === 'quarter') {
          // Q3 FY26 (Oct to Dec)
          startDate = '2026-10-01';
          endDate = '2026-12-31T23:59:59';
        } else if (period === 'fy') {
          // Full FY 2026-27 (Apr 2026 to Mar 2027)
          startDate = '2026-04-01';
          endDate = '2027-03-31T23:59:59';
        }

        const txs = await repository.getTransactionsByDateRange(startDate, endDate);
        setTransactions(txs);
      } catch (e) {
        console.error('Failed to load report pack:', e);
      } finally {
        setLoading(false);
      }
    };

    loadReportData();
  }, [period]);

  const totalSpend = transactions.reduce((sum, t) => sum + t.amount, 0);

  // Top merchants calculation
  const merchantMap: Record<string, number> = {};
  for (const t of transactions) {
    merchantMap[t.merchant] = (merchantMap[t.merchant] || 0) + t.amount;
  }
  const topMerchants = Object.entries(merchantMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
        <div>
          <h2 className="text-xl font-bold text-deep-blue-950 dark:text-cream-100">
            Financial Period Reports
          </h2>
          <p className="text-xs text-deep-blue-700/70 dark:text-cream-300">
            Synthesised period packs, spending trends, and exportable statements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center rounded-xl bg-cream-100 dark:bg-dark-elevated p-1 border border-cream-200 dark:border-dark-border text-xs font-semibold">
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                period === 'month'
                  ? 'bg-deep-blue-500 text-cream-100 shadow-sm'
                  : 'text-deep-blue-800 dark:text-cream-300'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('quarter')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                period === 'quarter'
                  ? 'bg-deep-blue-500 text-cream-100 shadow-sm'
                  : 'text-deep-blue-800 dark:text-cream-300'
              }`}
            >
              Q3 FY26
            </button>
            <button
              onClick={() => setPeriod('fy')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                period === 'fy'
                  ? 'bg-deep-blue-500 text-cream-100 shadow-sm'
                  : 'text-deep-blue-800 dark:text-cream-300'
              }`}
            >
              Full FY26-27
            </button>
          </div>

          {/* Export buttons */}
          <button
            onClick={() => alert('Excel export engine (.xlsx with formulas) will be configured in Phase 4.')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl border border-cream-200 dark:border-dark-border text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
            title="Print to PDF"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonLoader variant="kpi" count={3} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Executive Period Summary */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-deep-blue-600 dark:text-cream-300 uppercase tracking-wider">
                    Period Pack
                  </div>
                  <h3 className="text-lg font-bold text-deep-blue-950 dark:text-cream-100">
                    Executive Summary
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-xs text-deep-blue-600 dark:text-cream-400">Total Outflow</div>
                  <div className="text-xl font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">
                    {formatCurrency(totalSpend)}
                  </div>
                </div>
              </div>

              {/* Local Narrative Template */}
              <div className="p-4 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border space-y-2 text-xs leading-relaxed text-deep-blue-800 dark:text-cream-200">
                <p>
                  Across the selected period, you logged <strong>{transactions.length}</strong> transactions totaling{' '}
                  <strong>{formatCurrency(totalSpend)}</strong>.
                </p>
                <p>
                  Fixed commitments (Rent, EMIs, and recurring investments) formed approximately <strong>54%</strong> of total outflows, adhering comfortably to sustainable wealth guidelines.
                </p>
              </div>

              {/* Top Merchants in Period */}
              <div>
                <h4 className="text-xs font-bold text-deep-blue-900 dark:text-cream-100 uppercase tracking-wider mb-3">
                  Top Merchant Outflows
                </h4>
                <div className="space-y-2">
                  {topMerchants.map(([merchant, amount], idx) => (
                    <div
                      key={merchant}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-cream-50/50 dark:bg-dark-elevated/40 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-deep-blue-100 dark:bg-dark-border text-deep-blue-800 dark:text-cream-300 flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-deep-blue-900 dark:text-cream-100 truncate">
                          {merchant}
                        </span>
                      </div>
                      <span className="font-bold tabular-nums text-deep-blue-950 dark:text-cream-100">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Narrative & Recommendations Card */}
          <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
            <div className="flex items-center gap-2 text-deep-blue-800 dark:text-cream-300 font-semibold text-xs uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
              <span>AI Recommendations</span>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-deep-blue-700/90 dark:text-cream-300">
              <div className="p-3 rounded-lg bg-status-success-bg/60 dark:bg-emerald-950/30 border border-status-success/20 space-y-1">
                <div className="font-bold text-emerald-800 dark:text-emerald-300">
                  1. Healthy SIP Discipline
                </div>
                <p>Consistent monthly investments of ₹40,000 into Index and Flexi-Cap funds kept your 20% savings quota fulfilled.</p>
              </div>

              <div className="p-3 rounded-lg bg-status-warning-bg/60 dark:bg-amber-950/30 border border-status-warning/20 space-y-1">
                <div className="font-bold text-amber-800 dark:text-amber-300">
                  2. Monitor Coffee & Cafe Spend
                </div>
                <p>Frequent visits to Blue Tokai and Third Wave totaled over ₹7,500. Batching home brews could save ₹4,000/mo.</p>
              </div>

              <div className="p-3 rounded-lg bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 space-y-1">
                <div className="font-bold text-deep-blue-800 dark:text-cream-300">
                  3. Emergency Fund Progress
                </div>
                <p>On track to reach the ₹4,50,000 liquid emergency fund benchmark by Q1 2027 at the current pace.</p>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-deep-blue-500/60 dark:text-cream-400 italic text-center">
              * AI generated report. Not official financial advice.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
