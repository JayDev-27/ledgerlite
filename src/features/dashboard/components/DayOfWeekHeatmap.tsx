import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';

export interface DayOfWeekData {
  dayName: string; // 'Mon', 'Tue', ...
  dayIndex: number; // 1 (Mon) to 7 (Sun)
  totalAmount: number;
  txCount: number;
  averageSpend: number;
  isPeak: boolean;
}

interface DayOfWeekHeatmapProps {
  data: DayOfWeekData[];
}

export const DayOfWeekHeatmap: React.FC<DayOfWeekHeatmapProps> = ({ data }) => {
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-deep-blue-500 dark:text-cream-300">
        No day-of-week data available.
      </div>
    );
  }

  const peakDay = data.reduce(
    (max, d) => (d.totalAmount > max.totalAmount ? d : max),
    data[0] || { dayName: 'Mon', totalAmount: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-deep-blue-700 dark:text-cream-300">
        <span>
          Peak Spending Day:{' '}
          <strong className="text-deep-blue-900 dark:text-cream-100 font-bold">
            {peakDay.dayName} ({formatCurrency(peakDay.totalAmount, { hideDecimals: true })})
          </strong>
        </span>
        <span className="text-[11px] text-deep-blue-600 dark:text-cream-300">
          Aggregated by day of week
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="currentColor"
              className="text-cream-200 dark:text-dark-border"
            />
            <XAxis
              dataKey="dayName"
              stroke="currentColor"
              className="text-xs text-deep-blue-700 dark:text-cream-300"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              stroke="currentColor"
              className="text-xs text-deep-blue-700 dark:text-cream-300"
              tickFormatter={(val) => formatCurrency(val, { compact: true, hideDecimals: true })}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length && payload[0]) {
                  const item = payload[0].payload as DayOfWeekData;
                  return (
                    <div className="bg-white dark:bg-dark-surface p-3 rounded-xl border border-cream-200 dark:border-dark-border shadow-lg text-xs space-y-1">
                      <div className="font-bold text-deep-blue-900 dark:text-cream-100 flex items-center justify-between gap-2">
                        <span>{item.dayName}</span>
                        {item.isPeak && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-status-warning-bg text-status-warning font-bold">
                            Peak Spend
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                        <span>Total Spend:</span>
                        <span className="font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">
                          {formatCurrency(item.totalAmount, { hideDecimals: true })}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                        <span>Transactions:</span>
                        <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                          {item.txCount}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                        <span>Avg / Tx:</span>
                        <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                          {formatCurrency(item.averageSpend, { hideDecimals: true })}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="totalAmount" radius={[6, 6, 0, 0]} maxBarSize={40}>
              {data.map((entry) => (
                <Cell
                  key={entry.dayName}
                  fill={entry.isPeak ? '#16587B' : '#84B3CE'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
