import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequestQueue, isRateLimitError } from '@/lib/gemini/requestQueue';
import type { Repository } from '@/data/repository';
import type { AiUsageRecord } from '@/types';

describe('RequestQueue — Free-Tier Quota, Throttling, Retries & Fallback', () => {
  let mockUsageStore: Map<string, number>;
  let mockSettingsStore: Map<string, unknown>;
  let mockRepo: Repository;

  beforeEach(() => {
    mockUsageStore = new Map();
    mockSettingsStore = new Map();

    mockRepo = {
      getAiUsageToday: vi.fn(async (day: string): Promise<AiUsageRecord[]> => {
        const records: AiUsageRecord[] = [];
        for (const [key, count] of mockUsageStore.entries()) {
          const [d, model] = key.split('::');
          if (d === day) {
            records.push({ day: d, model: model || 'default', count });
          }
        }
        return records;
      }),
      incrementAiUsage: vi.fn(async (day: string, model: string): Promise<number> => {
        const key = `${day}::${model}`;
        const current = mockUsageStore.get(key) || 0;
        const next = current + 1;
        mockUsageStore.set(key, next);
        return next;
      }),
      getSetting: vi.fn(async <T>(key: string): Promise<T | undefined> => {
        return mockSettingsStore.get(key) as T | undefined;
      }),
      setSetting: vi.fn(async <T>(key: string, value: T): Promise<void> => {
        mockSettingsStore.set(key, value);
      }),
    } as unknown as Repository;
  });

  it('detects rate limit errors correctly', () => {
    expect(isRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isRateLimitError(new Error('RESOURCE_EXHAUSTED: quota exceeded'))).toBe(true);
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ code: 429 })).toBe(true);
    expect(isRateLimitError(new Error('SyntaxError: unexpected token'))).toBe(false);
  });

  it('enforces per-minute throttling by spacing out calls', async () => {
    const queue = new RequestQueue({
      heavyRpmLimit: 2,
      lightRpmLimit: 2,
      baseBackoffMs: 10,
      repo: mockRepo,
    });

    const executionTimestamps: number[] = [];
    const runTask = () =>
      queue.enqueue({
        tier: 'light',
        model: 'gemini-3.5-flash-lite',
        execute: async () => {
          executionTimestamps.push(Date.now());
          return 'ok';
        },
      });

    // Run 2 calls within RPM limit
    await runTask();
    await runTask();
    expect(executionTimestamps.length).toBe(2);
  });

  it('serializes concurrent calls and acquires rate slots safely', async () => {
    const queue = new RequestQueue({
      heavyRpmLimit: 5,
      lightRpmLimit: 5,
      repo: mockRepo,
    });

    const executionOrder: number[] = [];
    const tasks = Array.from({ length: 4 }).map((_, idx) =>
      queue.enqueue({
        tier: 'light',
        model: 'gemini-3.5-flash-lite',
        execute: async () => {
          executionOrder.push(idx);
          return `result-${idx}`;
        },
      })
    );

    const results = await Promise.all(tasks);
    expect(results).toEqual(['result-0', 'result-1', 'result-2', 'result-3']);
    expect(executionOrder.length).toBe(4);
  });

  it('intercepts 429 errors and automatically retries with exponential backoff', async () => {
    const queue = new RequestQueue({
      maxRetries: 3,
      baseBackoffMs: 20,
      repo: mockRepo,
    });

    let attempts = 0;
    const result = await queue.enqueue({
      tier: 'light',
      model: 'gemini-3.5-flash-lite',
      execute: async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('429 RESOURCE_EXHAUSTED: Per-minute quota exceeded');
        }
        return 'recovered-successfully';
      },
    });

    expect(attempts).toBe(3);
    expect(result).toBe('recovered-successfully');
  });

  it('enforces daily budget limits and triggers deterministic fallback', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Simulate daily limit of 2 reached for light model
    mockUsageStore.set(`${today}::gemini-3.5-flash-lite`, 2);

    const queue = new RequestQueue({
      dailyBudgetLight: 2,
      repo: mockRepo,
    });

    const deterministicSpy = vi.fn(() => 'offline-fallback-result');

    const result = await queue.enqueue({
      tier: 'light',
      model: 'gemini-3.5-flash-lite',
      execute: async () => 'online-gemini-result',
      fallbackDeterministic: deterministicSpy,
    });

    expect(deterministicSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe('offline-fallback-result');
  });

  it('throws an error if daily budget is exceeded and no fallback is provided', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockUsageStore.set(`${today}::gemini-3.5-flash-lite`, 5);

    const queue = new RequestQueue({
      dailyBudgetLight: 5,
      repo: mockRepo,
    });

    await expect(
      queue.enqueue({
        tier: 'light',
        model: 'gemini-3.5-flash-lite',
        execute: async () => 'online-gemini-result',
      })
    ).rejects.toThrow(/Daily budget of 5 requests exceeded/);
  });

  it('falls back from heavy to light model when heavy quota is exhausted', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Heavy budget is 1, simulate 1 heavy call already recorded
    mockUsageStore.set(`${today}::gemini-3.8-flash`, 1);

    const queue = new RequestQueue({
      dailyBudgetHeavy: 1,
      dailyBudgetLight: 10,
      repo: mockRepo,
    });

    const modelsInvoked: string[] = [];

    const result = await queue.enqueue({
      tier: 'heavy',
      model: 'gemini-3.8-flash',
      fallbackModel: 'gemini-3.5-flash-lite',
      execute: async (modelUsed) => {
        modelsInvoked.push(modelUsed);
        return `executed-with-${modelUsed}`;
      },
    });

    // Should have switched to fallback light model
    expect(modelsInvoked).toEqual(['gemini-3.5-flash-lite']);
    expect(result).toBe('executed-with-gemini-3.5-flash-lite');
  });

  it('caches results in memory and persistent storage, skipping API calls for identical requests', async () => {
    const queue = new RequestQueue({
      repo: mockRepo,
    });

    const executeSpy = vi.fn(async () => ({ summary: 'Generated Report for FY26' }));
    const cacheKey = 'report:quarterly:2026-07-01:2026-09-30';

    // First call: executes through queue
    const res1 = await queue.enqueue({
      tier: 'heavy',
      model: 'gemini-3.8-flash',
      cacheKey,
      execute: executeSpy,
    });

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(res1).toEqual({ summary: 'Generated Report for FY26' });

    // Second call with same cacheKey: must return cached result immediately
    const res2 = await queue.enqueue({
      tier: 'heavy',
      model: 'gemini-3.8-flash',
      cacheKey,
      execute: executeSpy,
    });

    expect(executeSpy).toHaveBeenCalledTimes(1); // Did NOT call execute again!
    expect(res2).toEqual({ summary: 'Generated Report for FY26' });
  });

  it('synchronizes budgets dynamically with repository settings', async () => {
    const queue = new RequestQueue({
      dailyBudgetHeavy: 10,
      dailyBudgetLight: 100,
      repo: mockRepo,
    });

    // Write custom budgets to mock settings
    mockSettingsStore.set('dailyAiBudgetHeavy', 35);
    mockSettingsStore.set('dailyAiBudgetLight', 350);

    const stats = await queue.getTodayUsage();
    expect(stats.heavyBudget).toBe(35);
    expect(stats.lightBudget).toBe(350);
  });
});
