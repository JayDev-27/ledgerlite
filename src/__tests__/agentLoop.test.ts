import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAgentTurn } from '@/lib/gemini/agent/agentLoop';
import { RequestQueue } from '@/lib/gemini/requestQueue';
import type { Repository } from '@/data/repository';
import type { Category, Transaction } from '@/types';

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    })),
    FunctionCallingConfigMode: { AUTO: 'AUTO', ANY: 'ANY', NONE: 'NONE' },
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      ARRAY: 'ARRAY',
    },
  };
});

describe('Agentic Chat Assistant Loop — Max 2 Tool Rounds & Code Computation', () => {
  let mockRepo: Repository;
  let mockQueue: RequestQueue;
  let mockTransactions: Transaction[];
  let mockCategories: Category[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockCategories = [
      { id: 'cat_dining', name: 'Dining Out', type: 'want', color: '#f59e0b', icon: 'Utensils' },
      { id: 'cat_groceries', name: 'Groceries', type: 'need', color: '#10b981', icon: 'ShoppingCart' },
    ];

    mockTransactions = [
      {
        id: 'tx-1',
        date: '2026-11-03',
        merchant: 'Swiggy',
        amount: 650,
        currency: 'INR',
        categoryId: 'cat_dining',
        paymentMethod: 'upi',
        tags: [],
        source: 'manual',
        createdAt: '2026-11-03T10:00:00Z',
        updatedAt: '2026-11-03T10:00:00Z',
      },
      {
        id: 'tx-2',
        date: '2026-11-08',
        merchant: 'BigBasket',
        amount: 2100,
        currency: 'INR',
        categoryId: 'cat_groceries',
        paymentMethod: 'card',
        tags: [],
        source: 'manual',
        createdAt: '2026-11-08T12:00:00Z',
        updatedAt: '2026-11-08T12:00:00Z',
      },
    ];

    mockRepo = {
      getAllTransactions: vi.fn(async () => mockTransactions),
      getCategories: vi.fn(async () => mockCategories),
      getBudgetForMonth: vi.fn(async () => undefined),
      setBudget: vi.fn(async (b) => b),
      getMemoryItems: vi.fn(async () => []),
      createMemoryItem: vi.fn(async (item) => ({
        ...item,
        id: 'mem-prop-123',
        createdAt: new Date().toISOString(),
        approvedAt: null,
      })),
      getAiUsageToday: vi.fn(async () => []),
      incrementAiUsage: vi.fn(async () => 1),
      getSetting: vi.fn(async () => undefined),
      setSetting: vi.fn(async () => undefined),
    } as unknown as Repository;

    mockQueue = new RequestQueue({ repo: mockRepo });
  });

  it('completes direct answering with 0 tool calls when query needs no data', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Hello! I am ready to analyze your personal finance data.',
      functionCalls: undefined,
    });

    const result = await runAgentTurn(
      {
        userQuery: 'Hi, what can you do?',
        apiKey: 'test-key',
      },
      mockRepo,
      mockQueue
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.text).toContain('Hello! I am ready');
    expect(result.toolExecutions.length).toBe(0);
  });

  it('executes 1 tool call round, feeds verified output back to model, and returns final answer', async () => {
    // Round 1: Model calls query_transactions
    mockGenerateContent.mockResolvedValueOnce({
      functionCalls: [
        {
          name: 'query_transactions',
          args: { category: 'Dining Out' },
        },
      ],
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ functionCall: { name: 'query_transactions', args: { category: 'Dining Out' } } }],
          },
        },
      ],
    });

    // Round 2: Model receives verified data and provides final answer citing exact count and amount
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Based on 1 dining transaction in your ledger, you spent exactly ₹650 on Swiggy on 3rd November 2026.',
      functionCalls: undefined,
    });

    const result = await runAgentTurn(
      {
        userQuery: 'How much did I spend on dining out recently?',
        apiKey: 'test-key',
      },
      mockRepo,
      mockQueue
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.toolExecutions.length).toBe(1);
    expect(result.toolExecutions[0]?.name).toBe('query_transactions');
    expect(result.text).toContain('₹650');
    expect(result.text).toContain('Swiggy');
  });

  it('strictly terminates after maximum 2 tool calling rounds', async () => {
    // Round 1: Model calls query_transactions
    mockGenerateContent.mockResolvedValueOnce({
      functionCalls: [{ name: 'query_transactions', args: {} }],
      candidates: [{ content: { role: 'model', parts: [] } }],
    });

    // Round 2: Model calls aggregate
    mockGenerateContent.mockResolvedValueOnce({
      functionCalls: [{ name: 'aggregate', args: { groupBy: 'category' } }],
      candidates: [{ content: { role: 'model', parts: [] } }],
    });

    // Final Synthesis: Tools are terminated; model synthesizes final output
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Final quantitative synthesis: Total expenditure is ₹2,750 across 2 transactions.',
    });

    const result = await runAgentTurn(
      {
        userQuery: 'Break down all my spending across categories',
        apiKey: 'test-key',
      },
      mockRepo,
      mockQueue
    );

    // Round 1 + Round 2 + Final Synthesis = exactly 3 LLM calls, max 2 tool rounds
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    expect(result.toolExecutions.length).toBe(2);
    expect(result.toolExecutions[0]?.name).toBe('query_transactions');
    expect(result.toolExecutions[1]?.name).toBe('aggregate');
    expect(result.text).toContain('Total expenditure is ₹2,750');
  });

  it('captures propose_memory tool call as interactive proposal record without direct save', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      functionCalls: [
        {
          name: 'propose_memory',
          args: {
            kind: 'goal',
            text: 'Saving ₹45,000 for emergency fund by December',
          },
        },
      ],
      candidates: [{ content: { role: 'model', parts: [] } }],
    });

    mockGenerateContent.mockResolvedValueOnce({
      text: 'I have proposed saving ₹45,000 for your emergency fund. Please confirm using the card below.',
      functionCalls: undefined,
    });

    const result = await runAgentTurn(
      {
        userQuery: 'I want to set a goal to save ₹45,000 for an emergency fund by December',
        apiKey: 'test-key',
      },
      mockRepo,
      mockQueue
    );

    expect(result.proposals.length).toBe(1);
    expect(result.proposals[0]?.kind).toBe('goal');
    expect(result.proposals[0]?.text).toBe('Saving ₹45,000 for emergency fund by December');
    expect(mockRepo.createMemoryItem).toHaveBeenCalledWith({
      kind: 'goal',
      text: 'Saving ₹45,000 for emergency fund by December',
      approvedAt: null, // Proposes with null approval
    });
  });

  it('executes set_budget tool call and persists budget to repository', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      functionCalls: [
        {
          name: 'set_budget',
          args: {
            month: '2026-11',
            totalLimit: 40000,
            categoryLimits: {
              'Dining Out': 8000,
              'Groceries': 12000,
            },
          },
        },
      ],
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                functionCall: {
                  name: 'set_budget',
                  args: {
                    month: '2026-11',
                    totalLimit: 40000,
                    categoryLimits: { 'Dining Out': 8000, 'Groceries': 12000 },
                  },
                },
              },
            ],
          },
        },
      ],
    });

    mockGenerateContent.mockResolvedValueOnce({
      text: 'I have set your November 2026 budget to ₹40,000 with ₹8,000 for Dining Out and ₹12,000 for Groceries.',
      functionCalls: undefined,
    });

    const result = await runAgentTurn(
      {
        userQuery: 'Set my November budget to 40000 with 8000 for dining out and 12000 for groceries',
        apiKey: 'test-key',
      },
      mockRepo,
      mockQueue
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.toolExecutions.length).toBe(1);
    expect(result.toolExecutions[0]?.name).toBe('set_budget');
    expect(mockRepo.setBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        month: '2026-11',
        totalLimit: 40000,
        categoryLimits: {
          cat_dining: 8000,
          cat_groceries: 12000,
        },
      })
    );
    expect(result.text).toContain('₹40,000');
  });

  it('sends a consented receipt image for typed extraction and proposes the paid total', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        documentType: 'receipt',
        transactions: [{ date: '2026-11-14', amount: 720, merchant: 'Swiggy Instamart',
          currency: 'INR', evidence: 'paid_receipt', kind: 'expense', category: 'Groceries', paymentMethod: 'upi' }],
      }),
    });

    const data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const result = await runAgentTurn({
      userQuery: 'Analyze this receipt and add any transactions',
      attachments: [{ name: 'receipt.png', mimeType: 'image/png', data: 'data:image/png;base64,' + data }],
      apiKey: 'test-key',
      allowCloudAttachments: true,
    }, mockRepo, mockQueue);

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent.mock.calls[0]?.[0].contents[0].parts[1].inlineData).toEqual({ mimeType: 'image/png', data });
    expect(result.extractedTransactions).toMatchObject([
      { merchant: 'Swiggy Instamart', amount: 720, categoryId: 'cat_groceries', direction: 'debit', importBlockedReason: undefined },
    ]);
    expect(result.text).toContain('1 eligible to add as spending');
  });
});

describe('Statement uploads and spending review', () => {
  const mixedStatement = [
    'Example checking account,INR',
    'Date,Description,Debit,Credit,Balance',
    '2026-11-01,Opening balance,,,500',
    '2026-11-02,Salary credit Test Employer,,45000,45500',
    '2026-11-03,Fresh Foods,1250.20,,44249.80',
    '2026-11-04,Merchant refund,,250.20,44500',
    '2026-11-05,Credit card bill payment,2000,,42500',
    '2026-11-06,Transfer to own savings,8000,,34500',
    '2026-11-09,ATM withdrawal,1000,,33500',
    '2026-11-10,Coffee,90,,33410',
    '2026-11-10,Coffee,90,,33320',
    ',Total,12430.20,45250.20,',
  ].join('\n');
  const attachment = (text: string, mimeType = 'text/csv') => ({
    name: mimeType === 'text/csv' ? 'statement.csv' : 'statement.pdf',
    mimeType,
    data: Buffer.from(text).toString('base64'),
  });
  const repo = {
    getCategories: vi.fn(async () => [{ id: 'cat_misc', name: 'Miscellaneous' }]),
    getAiUsageToday: vi.fn(async () => []),
    incrementAiUsage: vi.fn(async () => 1),
    getSetting: vi.fn(async () => undefined),
  } as unknown as Repository;
  const queue = new RequestQueue({ repo, lightRpmLimit: 100 });

  beforeEach(() => mockGenerateContent.mockReset());

  it('reads a mixed statement locally, without a key, and preserves identical genuine purchases', async () => {
    const file = attachment(mixedStatement);
    const options = { userQuery: 'Review my statement', apiKey: '', attachments: [file, file] };
    const result = await runAgentTurn(options, repo, queue);
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(result.extractedTransactions.map(({ kind }) => kind)).toEqual([
      'income', 'expense', 'refund', 'card_payment', 'transfer', 'cash_withdrawal', 'expense', 'expense',
    ]);
    const expenses = result.extractedTransactions.filter((row) => !row.importBlockedReason);
    expect(expenses.map(({ amount }) => amount)).toEqual([1250.2, 90, 90]);
    expect(new Set(expenses.map(({ id }) => id)).size).toBe(3);
    const retry = await runAgentTurn(options, repo, queue);
    expect(retry.extractedTransactions.map(({ id }) => id))
      .toEqual(result.extractedTransactions.map(({ id }) => id));
  });

  it('blocks full attachments until consent, and sends only the current file after opt-in', async () => {
    const file = attachment('synthetic data', 'application/pdf');
    const options = { userQuery: 'Review this PDF', apiKey: 'test-key', attachments: [file] };
    await expect(runAgentTurn(options, repo, queue)).resolves.toMatchObject({ modelUsed: 'local', extractedTransactions: [] });
    expect(mockGenerateContent).not.toHaveBeenCalled();
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        documentType: 'bank_statement',
        transactions: [
          { date: '2026-11-03', merchant: 'Food store', amount: 100, currency: 'INR',
            kind: 'expense', evidence: 'bank_debit', balanceBefore: 1000, balanceAfter: 900 },
          { date: '2026-11-03', merchant: 'Incoming wire', amount: 500, currency: 'INR',
            kind: 'expense', evidence: 'bank_debit', balanceBefore: 900, balanceAfter: 1400 },
        ],
      }),
    });
    const result = await runAgentTurn({ ...options, allowCloudAttachments: true }, repo, queue);
    expect(result.extractedTransactions.map(({ direction }) => direction)).toEqual(['debit', 'unknown']);
    expect(result.extractedTransactions.filter((row) => !row.importBlockedReason)).toHaveLength(1);
    const request = mockGenerateContent.mock.calls[0]?.[0];
    expect(request.contents[0].parts[1].inlineData).toEqual({ mimeType: 'application/pdf', data: file.data });
    expect(request.config.tools).toBeUndefined();
  });

  it('excludes malformed, summary, unknown, and foreign-currency rows from expense persistence', async () => {
    const { reviewTransactions, saveReviewedExpense } = await import('@/lib/gemini/agent/transactionReview');
    const categories = [{ id: 'cat_misc', name: 'Miscellaneous', type: 'want' as const, color: '', icon: '' }];
    const base = { date: '2026-11-03', merchant: 'Food store', amount: 100, currency: 'INR', kind: 'expense', evidence: 'bank_debit' };
    const rows = reviewTransactions([
      base, { ...base, merchant: 'Salary credit Test Co' }, { ...base, evidence: 'bank_credit' },
      { ...base, amount: -100 }, { ...base, amount: Infinity }, { ...base, date: '2026-02-30' },
      { ...base, currency: 'USD' }, { ...base, evidence: 'explicit_expense' }, { ...base, merchant: 'Closing balance' },
      { ...base, merchant: 'ACH DEBIT AMEX EPAYMENT' },
    ], categories, true, true);
    expect(rows).toHaveLength(7);
    expect(rows[rows.length - 1]?.kind).toBe('card_payment');
    expect(rows.filter((row) => !row.importBlockedReason)).toHaveLength(1);
    const stored = new Map();
    const write = vi.fn(async (tx) => {
      if (stored.has(tx.id)) throw new Error('Duplicate primary key');
      stored.set(tx.id, tx);
      return tx;
    });
    const localRepo = {
      getTransaction: async (id: string) => stored.get(id),
      getCategories: async () => categories,
      addTransaction: write,
    } as unknown as Repository;
    for (const row of rows.slice(1)) await expect(saveReviewedExpense(row, localRepo)).rejects.toThrow();
    await Promise.all([saveReviewedExpense(rows[0]!, localRepo), saveReviewedExpense(rows[0]!, localRepo)]);
    await saveReviewedExpense(rows[0]!, localRepo);
    expect(stored.size).toBe(1);
    expect(stored.get(rows[0]!.id)).toMatchObject({ amount: 100, currency: 'INR', categoryId: 'cat_misc' });
  });
});
