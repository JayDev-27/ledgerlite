import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  tokenize,
  scoreMemoryItem,
  retrieveRelevantMemories,
  formatMemoriesForPrompt,
} from '@/lib/gemini/agent/retrieval';
import type { Repository } from '@/data/repository';
import type { MemoryItem } from '@/types';

describe('Long-Term Memory Retrieval & Scoring System', () => {
  let mockMemories: MemoryItem[];
  let mockRepo: Repository;

  beforeEach(() => {
    mockMemories = [
      {
        id: 'mem-1',
        kind: 'goal',
        text: 'Saving ₹80,000 for a new MacBook Pro by Diwali',
        createdAt: '2026-10-01T10:00:00Z',
        approvedAt: '2026-10-01T10:05:00Z',
      },
      {
        id: 'mem-2',
        kind: 'income',
        text: 'Monthly take-home salary is ₹1,65,000 credited on the 1st',
        createdAt: '2026-10-02T10:00:00Z',
        approvedAt: '2026-10-02T10:05:00Z',
      },
      {
        id: 'mem-3',
        kind: 'preference',
        text: 'Strictly avoid taking personal loans or credit card EMI',
        createdAt: '2026-10-03T10:00:00Z',
        approvedAt: '2026-10-03T10:05:00Z',
      },
      {
        id: 'mem-4',
        kind: 'recurring_fact',
        text: 'Apartment maintenance fee of ₹4,200 due quarterly to RWA',
        createdAt: '2026-10-04T10:00:00Z',
        approvedAt: '2026-10-04T10:05:00Z',
      },
      {
        id: 'mem-5',
        kind: 'goal',
        text: 'Unapproved proposal: Buy a luxury watch',
        createdAt: '2026-11-01T10:00:00Z',
        approvedAt: null, // Pending approval!
      },
    ];

    mockRepo = {
      getMemoryItems: vi.fn(async (approvedOnly?: boolean) => {
        if (approvedOnly) {
          return mockMemories.filter((m) => m.approvedAt !== null && m.approvedAt !== undefined);
        }
        return mockMemories;
      }),
      approveMemoryItem: vi.fn(async (id: string) => {
        const item = mockMemories.find((m) => m.id === id);
        if (item) item.approvedAt = new Date().toISOString();
      }),
      deleteMemoryItem: vi.fn(async (id: string) => {
        mockMemories = mockMemories.filter((m) => m.id !== id);
      }),
    } as unknown as Repository;
  });

  it('tokenizes text by stripping punctuation and stop words', () => {
    const tokens = tokenize('Can I afford a ₹15,000 purchase for my laptop?');
    expect(tokens).toContain('afford');
    expect(tokens).toContain('15');
    expect(tokens).toContain('000');
    expect(tokens).toContain('purchase');
    expect(tokens).toContain('laptop');
    expect(tokens).not.toContain('can');
    expect(tokens).not.toContain('for');
    expect(tokens).not.toContain('my');
  });

  it('scores relevant memories higher based on keyword overlap and kind bonus', () => {
    const goalMemory = mockMemories[0]!; // MacBook goal
    const incomeMemory = mockMemories[1]!; // Salary

    const scoreLaptop = scoreMemoryItem('Can I afford to buy a laptop or MacBook?', goalMemory);
    const scoreSalary = scoreMemoryItem('Can I afford to buy a laptop or MacBook?', incomeMemory);

    expect(scoreLaptop).toBeGreaterThan(scoreSalary);
  });

  it('selects top-k approved memories and strictly filters out unapproved proposals', async () => {
    const results = await retrieveRelevantMemories(
      'What is my laptop goal and take-home salary?',
      mockRepo,
      2
    );

    expect(results.length).toBe(2);
    // Unapproved memory (mem-5) must NEVER be included
    expect(results.some((m) => m.id === 'mem-5')).toBe(false);

    const ids = results.map((r) => r.id);
    expect(ids).toContain('mem-1'); // Laptop goal
    expect(ids).toContain('mem-2'); // Salary
  });

  it('handles approve and reject memory lifecycle correctly', async () => {
    // Check initial approved count
    const initialApproved = await mockRepo.getMemoryItems(true);
    expect(initialApproved.length).toBe(4);

    // Approve mem-5
    await mockRepo.approveMemoryItem('mem-5');
    const postApproval = await mockRepo.getMemoryItems(true);
    expect(postApproval.length).toBe(5);
    expect(postApproval.some((m) => m.id === 'mem-5')).toBe(true);

    // Reject / delete mem-4
    await mockRepo.deleteMemoryItem('mem-4');
    const postDelete = await mockRepo.getMemoryItems(false);
    expect(postDelete.length).toBe(4);
    expect(postDelete.some((m) => m.id === 'mem-4')).toBe(false);
  });

  it('formats retrieved memories into a clean numbered block for system instruction', () => {
    const formatted = formatMemoriesForPrompt([mockMemories[0]!, mockMemories[1]!]);
    expect(formatted).toContain('1. [GOAL] Saving ₹80,000 for a new MacBook Pro by Diwali');
    expect(formatted).toContain('2. [INCOME] Monthly take-home salary is ₹1,65,000 credited on the 1st');
  });
});

it('omits unrelated and pending memories even when the repository over-returns records', async () => {
  const repository = {
    getMemoryItems: async () => [
      { id: 'approved', text: 'Prefer limited travel spending', kind: 'preference', approvedAt: '2026-11-01' },
      { id: 'pending', text: 'This quarter I spent on groceries', kind: 'note', approvedAt: null },
    ],
  } as unknown as Repository;
  expect(await retrieveRelevantMemories('How much for groceries?', repository)).toEqual([]);
});
