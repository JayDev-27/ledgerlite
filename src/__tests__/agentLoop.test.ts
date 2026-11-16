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

  it('includes multimodal attachment inlineData in user turn contents and handles import_extracted_transactions', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      functionCalls: [
        {
          name: 'import_extracted_transactions',
          args: {
            transactions: [
              {
                date: '2026-11-14',
                amount: 720,
                merchant: 'Swiggy Instamart',
                category: 'Groceries',
                paymentMethod: 'upi',
              },
            ],
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
                  name: 'import_extracted_transactions',
                  args: {
                    transactions: [
                      {
                        date: '2026-11-14',
                        amount: 720,
                        merchant: 'Swiggy Instamart',
                        category: 'Groceries',
                        paymentMethod: 'upi',
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
    });

    mockGenerateContent.mockResolvedValueOnce({
      text: 'I detected 1 transaction of ₹720 from your receipt image at Swiggy Instamart. Click "Add to Transactions" to add it to your ledger.',
      functionCalls: undefined,
    });

    const result = await runAgentTurn(
      {
        userQuery: 'Analyze this receipt and add any transactions',
        attachments: [
          {
            name: 'receipt.png',
            mimeType: 'image/png',
            data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          },
        ],
        apiKey: 'test-key',
      },
      mockRepo,
      mockQueue
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);

    // Verify first call passed inlineData in user turn
    const firstCallArgs = mockGenerateContent.mock.calls[0]?.[0];
    const userTurn = firstCallArgs?.contents.find((c: { role: string }) => c.role === 'user');
    expect(userTurn).toBeDefined();
    expect(userTurn.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inlineData: {
            mimeType: 'image/png',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          },
        }),
        expect.objectContaining({
          text: 'Analyze this receipt and add any transactions',
        }),
      ])
    );

    // Verify extractedTransactions are returned in AgentTurnResult
    expect(result.extractedTransactions.length).toBe(1);
    expect(result.extractedTransactions[0]?.merchant).toBe('Swiggy Instamart');
    expect(result.extractedTransactions[0]?.amount).toBe(720);
    expect(result.extractedTransactions[0]?.categoryId).toBe('cat_groceries');
    expect(result.text).toContain('₹720');
  });
});
