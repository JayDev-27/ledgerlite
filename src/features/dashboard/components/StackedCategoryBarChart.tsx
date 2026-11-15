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
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';

export interface StackedBucketItem {
  bucketLabel: string;
  [categoryKey: string]: string | number; // e.g. cat_housing: 4000
}

export interface CategoryBarMeta {
  key: string;
  name: string;
  color: string;
}

interface StackedCategoryBarChartProps {
  data: StackedBucketItem[];
  categories: CategoryBarMeta[];
}

export const StackedCategoryBarChart: React.FC<StackedCategoryBarChartProps> = ({
  data,
  categories,
}) => {
  if (!data.length || !categories.length) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-deep-blue-500 dark:text-cream-300">
        No breakdown data available.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 15, left: 0, bottom: 15 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="currentColor"
            className="text-cream-200 dark:text-dark-border"
          />
          <XAxis
            dataKey="bucketLabel"
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
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const totalInBucket = payload.reduce(
                  (acc, p) => acc + (typeof p.value === 'number' ? p.value : 0),
                  0
                );
                return (
                  <div className="bg-white dark:bg-dark-surface p-3 rounded-xl border border-cream-200 dark:border-dark-border shadow-lg text-xs space-y-1.5 min-w-[180px]">
                    <div className="font-bold text-deep-blue-900 dark:text-cream-100 flex items-center justify-between border-b border-cream-100 dark:border-dark-border pb-1">
                      <span>{label}</span>
                      <span className="tabular-nums">
                        {formatCurrency(totalInBucket, { hideDecimals: true })}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {payload
                        .filter((p) => typeof p.value === 'number' && p.value > 0)
                        .map((p) => (
                          <div
                            key={p.dataKey as string}
                            className="flex items-center justify-between text-deep-blue-700 dark:text-cream-200 gap-3"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="truncate">{p.name}</span>
                            </span>
                            <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100 flex-shrink-0">
                              {formatCurrency(p.value as number, { hideDecimals: true })}
                            </span>
                          </div>
                        ))}
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
              <span className="text-[11px] font-medium text-deep-blue-800 dark:text-cream-200">
                {value}
              </span>
            )}
          />
          {categories.map((cat, idx) => (
            <Bar
              key={cat.key}
              dataKey={cat.key}
              name={cat.name}
              stackId="categoryStack"
              fill={cat.color || '#16587B'}
              radius={idx === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
