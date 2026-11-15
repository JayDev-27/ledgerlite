import React from 'react';
import { formatCurrency } from '@/lib/formatters';

export interface TopMerchantItem {
  merchant: string;
  totalAmount: number;
  txCount: number;
  categoryName?: string;
  percent: number;
}

interface TopMerchantsLeaderboardProps {
  merchants: TopMerchantItem[];
  totalSpend: number;
}

export const TopMerchantsLeaderboard: React.FC<TopMerchantsLeaderboardProps> = ({
  merchants,
  totalSpend,
}) => {
  if (!merchants.length || totalSpend <= 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-deep-blue-500 dark:text-cream-300">
        No merchant data in this period.
      </div>
    );
  }

  const maxSpend = merchants[0]?.totalAmount || 1;

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
      {merchants.map((item, idx) => {
        const barWidth = Math.min(100, Math.round((item.totalAmount / maxSpend) * 100));
        return (
          <div
            key={item.merchant}
            className="p-3 rounded-2xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border space-y-1.5 hover:border-sky-300 transition-colors"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-full bg-deep-blue-50 dark:bg-dark-surface text-deep-blue-700 dark:text-cream-100 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="font-bold text-deep-blue-900 dark:text-cream-100 truncate">
                  {item.merchant}
                </span>
                <span className="text-[10px] text-deep-blue-600 dark:text-cream-300 flex-shrink-0">
                  ({item.txCount} tx{item.txCount > 1 ? 's' : ''})
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">
                  {formatCurrency(item.totalAmount, { hideDecimals: true })}
                </span>
                <span className="text-[11px] font-semibold text-deep-blue-600 dark:text-cream-300 tabular-nums w-8 text-right">
                  {item.percent.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Horizontal progress bar */}
            <div className="w-full h-1.5 rounded-full bg-cream-200 dark:bg-dark-surface overflow-hidden">
              <div
                className="h-full rounded-full bg-deep-blue-500 transition-all"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
