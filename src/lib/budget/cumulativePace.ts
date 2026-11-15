import { getDaysInMonth, getDate, isSameMonth } from 'date-fns';
import { Transaction } from '@/types';
import { CumulativeDayPoint } from './types';
import { parseReferenceDate } from '@/lib/periods/financialYear';

export function generateCumulativePaceData(
  month: string,
  effectiveTotalLimit: number,
  transactions: Transaction[],
  options?: { referenceDate?: Date | string }
): CumulativeDayPoint[] {
  const monthDate = parseReferenceDate(`${month}-01`);
  const totalDays = getDaysInMonth(monthDate);
  const refDate = parseReferenceDate(options?.referenceDate);

  let daysElapsed: number;
  if (isSameMonth(refDate, monthDate)) {
    daysElapsed = Math.min(totalDays, Math.max(1, getDate(refDate)));
  } else if (refDate > monthDate) {
    // Month is in the past
    daysElapsed = totalDays;
  } else {
    // Future month
    daysElapsed = 0;
  }

  // Aggregate daily spends
  const dailySpendMap: Record<number, number> = {};
  for (const tx of transactions) {
    if (tx.date.startsWith(month)) {
      const dayNum = parseInt(tx.date.substring(8, 10), 10);
      if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= totalDays) {
        dailySpendMap[dayNum] = (dailySpendMap[dayNum] || 0) + tx.amount;
      }
    }
  }

  // Calculate actual cumulative up to daysElapsed
  let runningActual = 0;
  const elapsedSpendArray: number[] = [];
  for (let d = 1; d <= daysElapsed; d++) {
    runningActual += dailySpendMap[d] || 0;
    elapsedSpendArray.push(runningActual);
  }

  const burnRate = daysElapsed > 0 ? runningActual / daysElapsed : 0;
  const points: CumulativeDayPoint[] = [];

  for (let d = 1; d <= totalDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${month}-${dayStr}`;
    const dailySpend = dailySpendMap[d] || 0;
    const idealCumulative = Math.round((d / totalDays) * effectiveTotalLimit);

    if (d <= daysElapsed) {
      const actualVal = elapsedSpendArray[d - 1] ?? 0;
      points.push({
        day: d,
        date: dateStr,
        dailySpend,
        actualCumulative: actualVal,
        idealCumulative,
        projectedCumulative: d === daysElapsed ? actualVal : undefined,
      });
    } else {
      // Future day in the month
      const projectedVal = Math.round(
        runningActual + burnRate * (d - daysElapsed)
      );
      points.push({
        day: d,
        date: dateStr,
        dailySpend: 0,
        idealCumulative,
        projectedCumulative: projectedVal,
      });
    }
  }

  return points;
}
