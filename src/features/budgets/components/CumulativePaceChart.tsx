import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { CumulativeDayPoint } from '@/lib/budget';
import { formatCurrency } from '@/lib/formatters';

interface CumulativePaceChartProps {
  data: CumulativeDayPoint[];
  totalLimit: number;
}

export const CumulativePaceChart: React.FC<CumulativePaceChartProps> = ({
  data,
  totalLimit,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-deep-blue-500 dark:text-cream-300">
        No pace data available.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
        >
          <defs>
            <linearGradient id="actualSpendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#84B3CE" stopOpacity={0.4} />
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
            dataKey="day"
            stroke="currentColor"
            className="text-xs text-deep-blue-700 dark:text-cream-300"
            tick={{ fontSize: 11 }}
            tickFormatter={(day) => `d${day}`}
          />
          <YAxis
            stroke="currentColor"
            className="text-xs text-deep-blue-700 dark:text-cream-300"
            tickFormatter={(val) => formatCurrency(val, { compact: true, hideDecimals: true })}
            tick={{ fontSize: 11 }}
            domain={[0, (dataMax: number) => Math.max(totalLimit, dataMax)]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length && payload[0]) {
                const point = payload[0].payload as CumulativeDayPoint;
                const hasActual = point.actualCumulative !== undefined;
                const variance = hasActual
                  ? point.actualCumulative! - point.idealCumulative
                  : (point.projectedCumulative ?? 0) - point.idealCumulative;

                return (
                  <div className="bg-white dark:bg-dark-surface p-3 rounded-xl border border-cream-200 dark:border-dark-border shadow-lg text-xs space-y-1">
                    <div className="font-bold text-deep-blue-900 dark:text-cream-100 mb-1">
                      Day {point.day} ({point.date})
                    </div>
                    {hasActual && (
                      <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                        <span>Actual Cumulative:</span>
                        <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                          {formatCurrency(point.actualCumulative!, { hideDecimals: true })}
                        </span>
                      </div>
                    )}
                    {point.projectedCumulative !== undefined && !hasActual && (
                      <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                        <span>Projected Spend:</span>
                        <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                          {formatCurrency(point.projectedCumulative, { hideDecimals: true })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 text-deep-blue-700 dark:text-cream-200">
                      <span>Ideal Linear Budget:</span>
                      <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                        {formatCurrency(point.idealCumulative, { hideDecimals: true })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 pt-1 border-t border-cream-100 dark:border-dark-border">
                      <span>Pace Variance:</span>
                      <span
                        className={`font-bold tabular-nums ${
                          variance > 0 ? 'text-status-danger' : 'text-status-success'
                        }`}
                      >
                        {variance > 0 ? '+' : ''}
                        {formatCurrency(variance, { hideDecimals: true })}
                        <span className="ml-1 text-[10px] font-normal">
                          ({variance > 0 ? 'over pace' : 'under pace'})
                        </span>
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
              <span className="text-xs font-medium text-deep-blue-800 dark:text-cream-200">
                {value === 'idealCumulative'
                  ? 'Ideal Pace (Linear)'
                  : value === 'actualCumulative'
                  ? 'Actual Cumulative Spend'
                  : 'Projected Spend'}
              </span>
            )}
          />

          {/* Ideal Linear Pace: Dashed Deep Blue */}
          <Line
            type="monotone"
            dataKey="idealCumulative"
            name="idealCumulative"
            stroke="#16587B"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />

          {/* Actual Cumulative: Solid Sky with Gradient Fill */}
          <Area
            type="monotone"
            dataKey="actualCumulative"
            name="actualCumulative"
            stroke="#84B3CE"
            strokeWidth={3}
            fill="url(#actualSpendGradient)"
            dot={{ r: 3, fill: '#84B3CE', strokeWidth: 1, stroke: '#FFFFFF' }}
            connectNulls={false}
          />

          {/* Projected Spend: Dotted Line */}
          <Line
            type="monotone"
            dataKey="projectedCumulative"
            name="projectedCumulative"
            stroke="#B86A04"
            strokeWidth={2}
            strokeDasharray="3 3"
            dot={false}
            connectNulls={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
