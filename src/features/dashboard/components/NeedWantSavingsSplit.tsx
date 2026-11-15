import React from 'react';
import { formatCurrency } from '@/lib/formatters';

interface NeedWantSavingsSplitProps {
  needSpent: number;
  wantSpent: number;
  savingsSpent: number;
  totalSpend: number;
}

export const NeedWantSavingsSplit: React.FC<NeedWantSavingsSplitProps> = ({
  needSpent,
  wantSpent,
  savingsSpent,
  totalSpend,
}) => {
  const safeTotal = totalSpend > 0 ? totalSpend : 1;

  const actualNeedPct = Math.round((needSpent / safeTotal) * 100);
  const actualWantPct = Math.round((wantSpent / safeTotal) * 100);
  const actualSavingsPct = Math.max(0, 100 - actualNeedPct - actualWantPct);

  const pillars = [
    {
      title: 'Needs (Essentials)',
      target: 50,
      actual: actualNeedPct,
      amount: needSpent,
      color: '#16587B',
      bgColor: 'bg-deep-blue-500',
      description: 'Housing, Groceries, Utilities, Healthcare',
    },
    {
      title: 'Wants (Discretionary)',
      target: 30,
      actual: actualWantPct,
      amount: wantSpent,
      color: '#84B3CE',
      bgColor: 'bg-sky-400',
      description: 'Dining, Entertainment, Shopping, Travel',
    },
    {
      title: 'Savings & Investments',
      target: 20,
      actual: actualSavingsPct,
      amount: savingsSpent,
      color: '#1B6B4C',
      bgColor: 'bg-status-success',
      description: 'Mutual Funds, Stocks, Emergency Fund, Debt Prepayment',
    },
  ];

  return (
    <div
      role="region"
      aria-label="50/30/20 Need, Want, and Savings allocation progress and summary"
      className="space-y-5"
    >
      {/* Screen-reader accessible data table */}
      <table className="sr-only">
        <caption>50/30/20 budget pillar breakdown</caption>
        <thead>
          <tr>
            <th scope="col">Pillar</th>
            <th scope="col">Target</th>
            <th scope="col">Actual</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {pillars.map((p) => (
            <tr key={p.title}>
              <td>{p.title}</td>
              <td>{p.target}%</td>
              <td>{p.actual}%</td>
              <td>{formatCurrency(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Target vs Actual Progress Meters */}
      <div className="space-y-4">
        {pillars.map((p) => {
          const delta = p.actual - p.target;
          return (
            <div key={p.title} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-deep-blue-900 dark:text-cream-100">
                    {p.title}
                  </span>
                  <span className="text-deep-blue-600 dark:text-cream-300 ml-1.5 text-[11px]">
                    ({p.description})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                    {formatCurrency(p.amount, { hideDecimals: true })}
                  </span>
                  <span className="font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">
                    {p.actual}%
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      Math.abs(delta) <= 3
                        ? 'bg-status-success-bg text-status-success'
                        : delta > 3 && p.title.startsWith('Needs')
                        ? 'bg-status-warning-bg text-status-warning'
                        : delta > 3 && p.title.startsWith('Wants')
                        ? 'bg-status-danger-bg text-status-danger'
                        : 'bg-status-success-bg text-status-success'
                    }`}
                  >
                    {delta > 0 ? `+${delta}%` : `${delta}%`} vs 50/30/20
                  </span>
                </div>
              </div>

              {/* Progress bar with target marker line */}
              <div className="relative w-full h-3 rounded-full bg-cream-100 dark:bg-dark-elevated overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${p.bgColor}`}
                  style={{ width: `${Math.min(100, p.actual)}%` }}
                />
                {/* Target marker indicator */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-deep-blue-900 dark:bg-white z-10"
                  style={{ left: `${p.target}%` }}
                  title={`Target: ${p.target}%`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Target Marker Legend */}
      <div className="pt-2 border-t border-cream-100 dark:border-dark-border flex items-center justify-between text-[11px] text-deep-blue-600 dark:text-cream-300">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-3 bg-deep-blue-900 dark:bg-white rounded-sm inline-block" />
          <span>Vertical marker denotes standard 50/30/20 target line</span>
        </div>
        <span className="font-medium">Ideal: 50% Needs / 30% Wants / 20% Savings</span>
      </div>
    </div>
  );
};
