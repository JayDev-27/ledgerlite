import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';

export interface SpendTrendPoint {
  date: string; // YYYY-MM-DD or week label
  label: string; // Short label
  amount: number;
  txCount: number;
}

interface SpendTrendChartProps {
  data: SpendTrendPoint[];
}

export const SpendTrendChart: React.FC<SpendTrendChartProps> = ({ data }) => {
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-deep-blue-500 dark:text-cream-300">
        No spending trend data in this period.
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Daily spending trend area chart and summary table"
      className="h-80 w-full"
    >
      {/* Screen-reader accessible data table */}
      <table className="sr-only">
        <caption>Daily spending trend summary</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Amount</th>
            <th scope="col">Transactions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point, idx) => (
            <tr key={idx}>
              <td>{point.label || point.date}</td>
              <td>{formatCurrency(point.amount)}</td>
              <td>{point.txCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 15, right: 15, left: 0, bottom: 10 }}
        >
          <defs>
            <linearGradient id="spendTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#84B3CE" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#84B3CE" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="currentColor"
            className="text-cream-200 dark:text-dark-border"
          />
          <XAxis
            dataKey="label"
            stroke="currentColor"
            className="text-xs text-deep-blue-700 dark:text-cream-300"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
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
                const item = payload[0].payload as SpendTrendPoint;
                return (
                  <div className="bg-white dark:bg-dark-surface p-3 rounded-xl border border-cream-200 dark:border-dark-border shadow-lg text-xs space-y-1">
                    <div className="font-bold text-deep-blue-900 dark:text-cream-100">
                      {item.date}
                    </div>
                    <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                      <span>Total Spent:</span>
                      <span className="font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">
                        {formatCurrency(item.amount, { hideDecimals: true })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                      <span>Transactions:</span>
                      <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                        {item.txCount}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#16587B"
            strokeWidth={3}
            fill="url(#spendTrendGradient)"
            dot={{ r: 3, fill: '#84B3CE', strokeWidth: 1.5, stroke: '#16587B' }}
            activeDot={{ r: 6, fill: '#16587B', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
