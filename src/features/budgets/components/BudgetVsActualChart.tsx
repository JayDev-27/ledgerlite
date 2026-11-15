import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import { CategoryBudgetMetrics } from '@/lib/budget';
import { formatCurrency } from '@/lib/formatters';

interface BudgetVsActualChartProps {
  categories: CategoryBudgetMetrics[];
}

export const BudgetVsActualChart: React.FC<BudgetVsActualChartProps> = ({
  categories,
}) => {
  // Sort by spent descending
  const data = [...categories]
    .filter((c) => c.effectiveLimit > 0 || c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .map((c) => ({
      name: c.categoryName,
      limit: c.effectiveLimit,
      spent: c.spent,
      percentUsed: c.percentUsed,
      status: c.status,
    }));

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-deep-blue-500 dark:text-cream-300">
        No active category budgets set for this month.
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Budget versus actual spending comparison chart and summary table"
      className="h-80 w-full"
    >
      {/* Screen-reader accessible data table */}
      <table className="sr-only">
        <caption>Budget vs actual spending comparison</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Budget Limit</th>
            <th scope="col">Spent</th>
            <th scope="col">Percentage Used</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{formatCurrency(row.limit)}</td>
              <td>{formatCurrency(row.spent)}</td>
              <td>{row.percentUsed.toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 20, left: 0, bottom: 25 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="currentColor"
            className="text-cream-200 dark:text-dark-border"
          />
          <XAxis
            dataKey="name"
            stroke="currentColor"
            className="text-xs text-deep-blue-700 dark:text-cream-300"
            tick={{ fontSize: 11 }}
            angle={-20}
            textAnchor="end"
            interval={0}
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
                const item = payload[0].payload as (typeof data)[0];
                return (
                  <div className="bg-white dark:bg-dark-surface p-3 rounded-xl border border-cream-200 dark:border-dark-border shadow-lg text-xs space-y-1">
                    <div className="font-semibold text-deep-blue-900 dark:text-cream-100 mb-1">
                      {item.name}
                    </div>
                    <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                      <span>Budget Limit:</span>
                      <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                        {formatCurrency(item.limit, { hideDecimals: true })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                      <span>Actual Spent:</span>
                      <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                        {formatCurrency(item.spent, { hideDecimals: true })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 pt-1 border-t border-cream-100 dark:border-dark-border">
                      <span>Budget Used:</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          item.percentUsed > 100
                            ? 'text-status-danger'
                            : item.percentUsed >= 80
                            ? 'text-status-warning'
                            : 'text-status-success'
                        }`}
                      >
                        {item.percentUsed.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: '10px' }}
            formatter={(value) => (
              <span className="text-xs font-medium text-deep-blue-800 dark:text-cream-200 capitalize">
                {value === 'limit' ? 'Budget Limit' : 'Actual Spent'}
              </span>
            )}
          />
          <Bar dataKey="limit" name="limit" fill="#847DFF" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="spent" name="spent" fill="#00B3DD" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {data.map((entry, index) => {
              let fill = '#00B3DD';
              if (entry.spent > entry.limit && entry.limit > 0) {
                fill = '#B92E2E'; // Exceeded limit
              } else if (entry.percentUsed >= 80) {
                fill = '#B86A04'; // Caution
              }
              return <Cell key={`cell-${index}`} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
