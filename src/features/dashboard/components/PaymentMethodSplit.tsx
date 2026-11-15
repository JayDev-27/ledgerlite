import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';

export interface PaymentMethodItem {
  id: string;
  name: string;
  amount: number;
  txCount: number;
  percent: number;
  color: string;
}

interface PaymentMethodSplitProps {
  data: PaymentMethodItem[];
}

export const PaymentMethodSplit: React.FC<PaymentMethodSplitProps> = ({ data }) => {
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-deep-blue-500 dark:text-cream-300">
        No payment method data available.
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Payment method distribution chart and summary table"
      className="flex flex-col sm:flex-row items-center gap-6 h-80"
    >
      {/* Screen-reader accessible data table */}
      <table className="sr-only">
        <caption>Payment method breakdown</caption>
        <thead>
          <tr>
            <th scope="col">Payment Method</th>
            <th scope="col">Amount</th>
            <th scope="col">Transactions</th>
            <th scope="col">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{formatCurrency(item.amount)}</td>
              <td>{item.txCount}</td>
              <td>{item.percent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="w-full sm:w-1/2 h-64 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="amount"
              stroke="#FFFFFF"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length && payload[0]) {
                  const item = payload[0].payload as PaymentMethodItem;
                  return (
                    <div className="bg-white dark:bg-dark-surface p-3 rounded-xl border border-cream-200 dark:border-dark-border shadow-lg text-xs space-y-1">
                      <div className="flex items-center gap-2 font-bold text-deep-blue-900 dark:text-cream-100">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </div>
                      <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                        <span>Total:</span>
                        <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                          {formatCurrency(item.amount, { hideDecimals: true })}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                        <span>Transactions:</span>
                        <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                          {item.txCount}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                        <span>Share:</span>
                        <span className="font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">
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
      </div>

      <div className="w-full sm:w-1/2 space-y-2.5">
        {data.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between text-xs p-2 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border"
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
              <span className="tabular-nums font-semibold text-deep-blue-900 dark:text-cream-100">
                {formatCurrency(item.amount, { compact: true, hideDecimals: true })}
              </span>
              <span className="font-bold text-deep-blue-700 dark:text-cream-200 tabular-nums w-8 text-right">
                {item.percent.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
