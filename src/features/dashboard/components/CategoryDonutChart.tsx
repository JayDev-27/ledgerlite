import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';

export interface CategoryDonutItem {
  id: string;
  name: string;
  amount: number;
  color: string;
  percent: number;
}

interface CategoryDonutChartProps {
  data: CategoryDonutItem[];
  totalSpend: number;
}

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({
  data,
  totalSpend,
}) => {
  if (!data.length || totalSpend <= 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-deep-blue-500 dark:text-cream-300">
        No expense data in this period.
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Category spending breakdown donut chart and summary table"
      className="flex flex-col md:flex-row items-center gap-6 h-80"
    >
      {/* Screen-reader accessible data table */}
      <table className="sr-only">
        <caption>Category spending breakdown</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
            <th scope="col">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{formatCurrency(item.amount)}</td>
              <td>{item.percent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Donut with Center Text */}
      <div className="relative w-full md:w-1/2 h-64 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={65}
              outerRadius={95}
              paddingAngle={3}
              dataKey="amount"
              stroke="#FFFFFF"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.id} fill={entry.color || '#847DFF'} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length && payload[0]) {
                  const item = payload[0].payload as CategoryDonutItem;
                  return (
                    <div className="bg-white dark:bg-dark-surface p-3 rounded-xl border border-cream-200 dark:border-dark-border shadow-lg text-xs space-y-1">
                      <div className="flex items-center gap-2 font-semibold text-deep-blue-900 dark:text-cream-100">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </div>
                      <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                        <span>Amount:</span>
                        <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                          {formatCurrency(item.amount, { hideDecimals: true })}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                        <span>Share:</span>
                        <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                          {item.percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center overlay total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-deep-blue-500 dark:text-cream-300">
            Total
          </span>
          <span className="text-base font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
            {formatCurrency(totalSpend, { compact: true, hideDecimals: true })}
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="w-full md:w-1/2 space-y-2 overflow-y-auto max-h-64 pr-2">
        {data.slice(0, 6).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between text-xs p-1.5 rounded-xl hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-semibold text-deep-blue-900 dark:text-cream-100 truncate">
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-deep-blue-700 dark:text-cream-200 tabular-nums">
                {formatCurrency(item.amount, { hideDecimals: true })}
              </span>
              <span className="font-semibold text-deep-blue-900 dark:text-cream-100 tabular-nums w-10 text-right">
                {item.percent.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
