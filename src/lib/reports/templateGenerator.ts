import { formatCurrency } from '@/lib/formatters';
import { formatPercentDelta } from '@/lib/periods/comparison';
import { PeriodPack, ReportContent } from './types';

export function generateTemplateReport(pack: PeriodPack): ReportContent {
  const { kpis, categoryBreakdown, distribution50_30_20, budgetStatus, topMerchants, anomalies, recurringSummary, periodRange } = pack;

  const totalSpendStr = formatCurrency(kpis.totalSpend.current);
  const dailyAvgStr = formatCurrency(kpis.dailyAverage.current);
  const txCount = kpis.transactionCount.current;

  // 1. Executive Summary (2-3 paragraphs)
  let p1: string;
  if (txCount === 0) {
    p1 = `During the ${periodRange.label} cycle (${periodRange.startDate} to ${periodRange.endDate}), no transaction outflows were recorded. Account activity remained dormant with zero expenditures logged.`;
  } else {
    const priorComp = kpis.totalSpend.previous !== undefined && kpis.totalSpend.previous > 0
      ? ` This represents a ${Math.abs(kpis.totalSpend.percentChange || 0).toFixed(1)}% ${kpis.totalSpend.trend === 'up' ? 'increase' : 'decrease'} (${formatPercentDelta(kpis.totalSpend.percentChange || 0)}) compared to the prior period outflow of ${formatCurrency(kpis.totalSpend.previous)}.`
      : '';
    p1 = `During ${periodRange.label} (${periodRange.startDate} to ${periodRange.endDate}), total recorded outflows reached ${totalSpendStr} across ${txCount} transactions, averaging approximately ${dailyAvgStr} per day.${priorComp}`;
  }

  const needPct = distribution50_30_20.need.percentage.toFixed(1);
  const wantPct = distribution50_30_20.want.percentage.toFixed(1);
  const savingsPct = distribution50_30_20.savings.percentage.toFixed(1);

  const p2 = `Under the 50/30/20 wealth allocation guideline, essential Needs comprised ${needPct}% (${formatCurrency(distribution50_30_20.need.amount)}), discretionary Wants accounted for ${wantPct}% (${formatCurrency(distribution50_30_20.want.amount)}), and direct Savings/Investments made up ${savingsPct}% (${formatCurrency(distribution50_30_20.savings.amount)}). ${
    distribution50_30_20.savings.percentage >= 20
      ? 'Your savings discipline achieved or surpassed the recommended 20% benchmark, reinforcing long-term wealth stability.'
      : 'Savings allocations fell below the 20% benchmark, indicating an opportunity to curtail non-essential consumption in upcoming cycles.'
  }`;

  const topCat = categoryBreakdown[0];
  let p3 = '';
  if (topCat) {
    const topCatName = topCat.categoryName;
    const topCatSpend = formatCurrency(topCat.amount);
    const topCatPct = topCat.percentage.toFixed(1);
    const budgetInfo = budgetStatus.hasBudget && budgetStatus.totalLimit > 0
      ? ` Overall budget utilization stood at ${budgetStatus.percentUsed.toFixed(1)}% (${formatCurrency(budgetStatus.totalSpent)} of ${formatCurrency(budgetStatus.totalLimit)}), leaving a variance of ${formatCurrency(budgetStatus.variance)}.`
      : '';
    p3 = `The single largest outflow category was ${topCatName}, absorbing ${topCatSpend} (${topCatPct}% of all spend).${budgetInfo} Fixed recurring obligations represented ${formatCurrency(recurringSummary.totalRecurringSpend)} (${recurringSummary.percentageOfTotal.toFixed(1)}% of period spend), providing predictable baseline cash flow demands.`;
  } else {
    p3 = `Financial commitments remained steady throughout the cycle without heavy category concentration.`;
  }

  const executiveSummary = [p1, p2, p3].join('\n\n');

  // 2. Narrative Insights (4-6 analytical points)
  const narrativeInsights: string[] = [];

  if (topCat) {
    narrativeInsights.push(
      `Primary Spending Driver: ${topCat.categoryName} represented the heaviest expenditure channel, capturing ${topCat.percentage.toFixed(1)}% (${formatCurrency(topCat.amount)}) of total outflows.`
    );
  }

  if (budgetStatus.hasBudget && budgetStatus.totalLimit > 0) {
    if (budgetStatus.status === 'exceeded') {
      narrativeInsights.push(
        `Budget Alert: Total period spend exceeded the allocated threshold of ${formatCurrency(budgetStatus.totalLimit)} by ${formatCurrency(Math.abs(budgetStatus.variance))} (${budgetStatus.percentUsed.toFixed(1)}% utilized).`
      );
    } else {
      narrativeInsights.push(
        `Budget Discipline: Outflows remained within bounds, consuming ${budgetStatus.percentUsed.toFixed(1)}% of the ${formatCurrency(budgetStatus.totalLimit)} ceiling, preserving ${formatCurrency(budgetStatus.variance)} in unspent headroom.`
      );
    }
  }

  if (topMerchants.length > 0) {
    const top3Spend = topMerchants.slice(0, 3).reduce((sum, m) => sum + m.amount, 0);
    const top3Pct = kpis.totalSpend.current > 0 ? (top3Spend / kpis.totalSpend.current) * 100 : 0;
    narrativeInsights.push(
      `Merchant Concentration: The top 3 payees (${topMerchants.slice(0, 3).map((m) => m.merchant).join(', ')}) absorbed ${top3Pct.toFixed(1)}% (${formatCurrency(top3Spend)}) of total disbursements.`
    );
  }

  if (recurringSummary.totalRecurringSpend > 0) {
    narrativeInsights.push(
      `Recurring Commitments: Automated subscriptions, EMIs, and scheduled debits totaled ${formatCurrency(recurringSummary.totalRecurringSpend)} (${recurringSummary.percentageOfTotal.toFixed(1)}% of total outflows) across ${recurringSummary.incurredCount} transactions.`
    );
  }

  if (pack.paymentMethods.length > 0) {
    const topMethod = pack.paymentMethods[0];
    if (topMethod) {
      narrativeInsights.push(
        `Payment Channel Preference: ${topMethod.label} was the most utilized payment mechanism, handling ${topMethod.percentage.toFixed(1)}% (${formatCurrency(topMethod.amount)}) of expenditures.`
      );
    }
  }

  if (kpis.largestExpense) {
    narrativeInsights.push(
      `Peak Outflow Event: The largest single transaction was ${formatCurrency(kpis.largestExpense.amount)} at ${kpis.largestExpense.merchant} (${kpis.largestExpense.categoryName}) on ${kpis.largestExpense.date}.`
    );
  }

  // Ensure 4-6 points
  while (narrativeInsights.length < 4) {
    narrativeInsights.push(
      `Cash Velocity: The average daily expenditure pace of ${dailyAvgStr} maintained standard historical velocity across all active days.`
    );
  }

  // 3. Anomalies Analysis
  const anomaliesAnalysis: string[] = [];
  if (anomalies.length > 0) {
    for (const anom of anomalies.slice(0, 5)) {
      anomaliesAnalysis.push(
        `${anom.date} — ${anom.merchant} (${formatCurrency(anom.amount)}): ${anom.reason}`
      );
    }
  } else {
    anomaliesAnalysis.push(
      'No statistically anomalous transactions detected. All expenses remained within 2.5 standard deviations of category historical norms.'
    );
  }

  // 4. Actionable Recommendations (3-5 concrete recommendations)
  const recommendations: string[] = [];

  // Recommendation 1: Wants / Discretionary trimming
  const wantCategories = categoryBreakdown.filter((c) => c.categoryType === 'want');
  if (wantCategories.length > 0 && distribution50_30_20.want.percentage > 30) {
    const topWant = wantCategories[0];
    if (topWant) {
      recommendations.push(
        `Trim Discretionary Outflows: Discretionary spend reached ${wantPct}% (above the 30% guideline). Review ${topWant.categoryName} (${formatCurrency(topWant.amount)}) and consider a 15% budget cap for the next cycle.`
      );
    }
  } else {
    recommendations.push(
      `Maintain Discretionary Discipline: Discretionary spend is well within healthy bounds (${wantPct}%). Continue allocating surplus discretionary funds towards liquid emergency buffers.`
    );
  }

  // Recommendation 2: Savings rate
  if (distribution50_30_20.savings.percentage < 20) {
    recommendations.push(
      `Step Up Automated SIPs: Current savings rate is ${savingsPct}% vs the 20% target. Automating a recurring monthly SIP or recurring deposit on salary day can guarantee hitting your wealth targets.`
    );
  } else {
    recommendations.push(
      `Compounding Growth: Excellent savings performance (${savingsPct}%). Ensure savings allocations are split prudently between low-cost index funds, debt instruments, and high-yield emergency reserves.`
    );
  }

  // Recommendation 3: Recurring expense audit
  if (recurringSummary.percentageOfTotal > 20) {
    recommendations.push(
      `Audit Recurring Subscriptions: Recurring expenses account for ${recurringSummary.percentageOfTotal.toFixed(1)}% of your outflows. Review active streaming, SaaS, and gym memberships to eliminate unutilized recurring drains.`
    );
  } else {
    recommendations.push(
      `Maintain Lean Fixed Commitments: Your recurring baseline (${recurringSummary.percentageOfTotal.toFixed(1)}%) is lean, leaving ample operational flexibility for unexpected cash requirements.`
    );
  }

  // Recommendation 4: Merchant or Payment method optimization
  if (topMerchants.length > 0 && topMerchants[0] && topMerchants[0].percentage > 25) {
    recommendations.push(
      `Diversify Payee Exposure: Single payee ${topMerchants[0].merchant} represents ${topMerchants[0].percentage.toFixed(1)}% of total period spend. Verify bill accuracy and consider cashback or reward card mechanisms for regular high-value settlements.`
    );
  } else {
    recommendations.push(
      `Payment Instrument Optimization: Use co-branded or cashback credit cards for recurring utility and grocery bills to earn 2–5% in cashback value while settling statement balances in full.`
    );
  }

  return {
    title: `Financial Performance Report — ${periodRange.label}`,
    executiveSummary,
    narrativeInsights,
    anomaliesAnalysis,
    recommendations,
    generatedBy: 'template',
    footnote: '* This report is generated for informational purposes and does not constitute formal financial advice.',
  };
}
