import { MetricComparison } from './types';

export function calculateComparison(
  current: number,
  previous: number
): MetricComparison {
  const delta = current - previous;
  let percentChange: number;

  if (previous === 0) {
    percentChange = current === 0 ? 0 : 100;
  } else {
    percentChange = (delta / Math.abs(previous)) * 100;
  }

  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (delta > 0.001) {
    trend = 'up';
  } else if (delta < -0.001) {
    trend = 'down';
  }

  return {
    current,
    previous,
    delta,
    percentChange,
    trend,
  };
}

export function formatPercentDelta(
  percentChange: number,
  includePlus = true
): string {
  const prefix = includePlus && percentChange > 0 ? '+' : '';
  return `${prefix}${percentChange.toFixed(1)}%`;
}
