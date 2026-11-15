import { describe, it, expect } from 'vitest';
import { generateTemplateReport } from '@/lib/reports/templateGenerator';
import { generateGeminiReport } from '@/lib/reports/geminiReportGenerator';
import { computePeriodPack } from '@/lib/reports/periodPack';
import { DEFAULT_CATEGORIES } from '@/data/categories';
import { Transaction } from '@/types';
import { PeriodRange } from '@/lib/periods/types';

describe('Report Generator Engine (Template & Gemini Fallback)', () => {
  const periodRange: PeriodRange = {
    type: 'month',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    label: 'November 2026',
    shortLabel: 'Nov 2026',
  };

  const sampleTransactions: Transaction[] = [
    {
      id: 'tx_1',
      amount: 35000,
      currency: 'INR',
      date: '2026-11-01',
      merchant: 'Landlord Rent',
      categoryId: 'cat_housing',
      paymentMethod: 'net_banking',
      tags: ['rent'],
      source: 'recurring',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'tx_2',
      amount: 6000,
      currency: 'INR',
      date: '2026-11-04',
      merchant: 'Zepto',
      categoryId: 'cat_groceries',
      paymentMethod: 'upi',
      tags: [],
      source: 'quick_add',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'tx_3',
      amount: 4500,
      currency: 'INR',
      date: '2026-11-08',
      merchant: 'Zara',
      categoryId: 'cat_shopping',
      paymentMethod: 'card',
      tags: [],
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('generates structured deterministic report adhering to all requirements', () => {
    const pack = computePeriodPack({
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      periodRange,
    });

    const report = generateTemplateReport(pack);

    // Title & Metadata
    expect(report.title).toContain('November 2026');
    expect(report.generatedBy).toBe('template');

    // Executive Summary: 2-3 structured paragraphs separated by double newlines
    const paragraphs = report.executiveSummary.split('\n\n');
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(paragraphs.length).toBeLessThanOrEqual(3);
    expect(report.executiveSummary).toContain('₹45,500'); // total spend

    // Narrative Insights: 4 to 6 analytical bullets
    expect(report.narrativeInsights.length).toBeGreaterThanOrEqual(4);
    expect(report.narrativeInsights.length).toBeLessThanOrEqual(6);

    // Recommendations: 3 to 5 concrete recommendations
    expect(report.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(report.recommendations.length).toBeLessThanOrEqual(5);

    // Footnote
    expect(report.footnote.toLowerCase()).toContain('not');
    expect(report.footnote.toLowerCase()).toContain('financial advice');
  });

  it('handles empty periods cleanly without null pointer or NaN', () => {
    const pack = computePeriodPack({
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      periodRange,
    });

    const report = generateTemplateReport(pack);
    expect(report.executiveSummary).toBeDefined();
    expect(report.executiveSummary).toContain('zero expenditures');
    expect(report.narrativeInsights.length).toBeGreaterThanOrEqual(4);
    expect(report.recommendations.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to template generator when Gemini API key is missing', async () => {
    const pack = computePeriodPack({
      transactions: sampleTransactions,
      categories: DEFAULT_CATEGORIES,
      periodRange,
    });

    const report = await generateGeminiReport(pack, { apiKey: '' });
    expect(report.generatedBy).toBe('template');
    expect(report.executiveSummary).toBeDefined();
    expect(report.recommendations.length).toBeGreaterThanOrEqual(3);
  });
});
