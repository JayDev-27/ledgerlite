import { repository } from '@/data/repository';
import type { Repository } from '@/data/repository';
import type { AiUsageRecord } from '@/types';

export type ModelTier = 'heavy' | 'light';

export interface RequestQueueConfig {
  heavyRpmLimit?: number; // default 10
  lightRpmLimit?: number; // default 15
  dailyBudgetHeavy?: number; // default 20
  dailyBudgetLight?: number; // default 200
  maxRetries?: number; // default 3
  baseBackoffMs?: number; // default 1000
  repo?: Repository;
  storage?: {
    get: <T>(key: string) => Promise<T | undefined>;
    set: <T>(key: string, value: T) => Promise<void>;
  };
  configuredHeavyModel?: string;
  configuredLightModel?: string;
}

export interface EnqueueOptions<T> {
  tier: ModelTier;
  model: string;
  fallbackModel?: string;
  cacheKey?: string;
  execute: (modelName: string) => Promise<T>;
  fallbackDeterministic?: () => Promise<T> | T;
}

export interface TodayUsageStats {
  day: string;
  heavyCount: number;
  lightCount: number;
  totalCount: number;
  heavyBudget: number;
  lightBudget: number;
  records: AiUsageRecord[];
}

export function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object') {
    const errorObj = err as Record<string, unknown>;
    if (
      errorObj.status === 429 ||
      errorObj.statusCode === 429 ||
      errorObj.code === 429 ||
      errorObj.status === 'RESOURCE_EXHAUSTED'
    ) {
      return true;
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('rate limit')
  );
}

export class RequestQueue {
  private heavyRpmLimit: number;
  private lightRpmLimit: number;
  private dailyBudgetHeavy: number;
  private dailyBudgetLight: number;
  private maxRetries: number;
  private baseBackoffMs: number;
  private repo: Repository;
  private storage: {
    get: <T>(key: string) => Promise<T | undefined>;
    set: <T>(key: string, value: T) => Promise<void>;
  };

  private configuredHeavyModel?: string;
  private configuredLightModel?: string;

  private memoryCache = new Map<string, unknown>();
  private recentTimestamps: { heavy: number[]; light: number[] } = {
    heavy: [],
    light: [],
  };

  // Serialized queue chains per tier to guarantee ordered rate slot reservations
  private queueChains: { heavy: Promise<void>; light: Promise<void> } = {
    heavy: Promise.resolve(),
    light: Promise.resolve(),
  };

  constructor(config?: RequestQueueConfig) {
    this.heavyRpmLimit = config?.heavyRpmLimit ?? 10;
    this.lightRpmLimit = config?.lightRpmLimit ?? 15;
    this.dailyBudgetHeavy = config?.dailyBudgetHeavy ?? 20;
    this.dailyBudgetLight = config?.dailyBudgetLight ?? 200;
    this.maxRetries = config?.maxRetries ?? 3;
    this.baseBackoffMs = config?.baseBackoffMs ?? 1000;
    this.repo = config?.repo ?? repository;
    this.storage = config?.storage ?? {
      get: <T>(key: string) => this.repo.getSetting<T>(key),
      set: <T>(key: string, val: T) => this.repo.setSetting<T>(key, val),
    };
    this.configuredHeavyModel = config?.configuredHeavyModel;
    this.configuredLightModel = config?.configuredLightModel;
  }

  public updateBudgets(heavy: number, light: number): void {
    if (!isNaN(heavy) && heavy > 0) this.dailyBudgetHeavy = heavy;
    if (!isNaN(light) && light > 0) this.dailyBudgetLight = light;
  }

  public setConfiguredModels(heavy?: string, light?: string): void {
    if (heavy) this.configuredHeavyModel = heavy;
    if (light) this.configuredLightModel = light;
  }

  public isHeavyModel(model: string): boolean {
    if (this.configuredHeavyModel && model === this.configuredHeavyModel) {
      return true;
    }
    if (this.configuredLightModel && model === this.configuredLightModel) {
      return false;
    }
    const m = model.toLowerCase();
    return m.includes('3.8') || m.includes('pro') || m.includes('heavy');
  }

  private normalizeCacheKey(key: string): string {
    if (key.length <= 128) {
      return key;
    }
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    const prefix = key.slice(0, 32).replace(/[^a-zA-Z0-9_\-:]/g, '_');
    return `${prefix}:${Math.abs(hash).toString(36)}:${key.length}`;
  }

  public async getFromCache<T>(key: string): Promise<T | null> {
    const normKey = this.normalizeCacheKey(key);
    if (this.memoryCache.has(normKey)) {
      return this.memoryCache.get(normKey) as T;
    }
    try {
      const persisted = await this.storage.get<T>(`cache:ai:${normKey}`);
      if (persisted !== undefined && persisted !== null) {
        this.memoryCache.set(normKey, persisted);
        return persisted;
      }
    } catch (e) {
      console.warn('Failed to read from persistent cache:', e);
    }
    return null;
  }

  public async setInCache<T>(key: string, value: T): Promise<void> {
    const normKey = this.normalizeCacheKey(key);
    this.memoryCache.set(normKey, value);
    try {
      await this.storage.set(`cache:ai:${normKey}`, value);
    } catch (e) {
      console.warn('Failed to write to persistent cache:', e);
    }
  }

  public clearMemoryCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Acquires an execution slot according to the tier's RPM limit.
   * Serializes callers so that concurrent calls cannot race and exceed the rate limit.
   * Records the dispatch timestamp immediately upon slot grant.
   */
  public async acquireSlot(tier: ModelTier): Promise<void> {
    const limit = tier === 'heavy' ? this.heavyRpmLimit : this.lightRpmLimit;
    const windowMs = 60_000;

    let releaseSlot!: () => void;
    const slotGranted = new Promise<void>((resolve) => {
      releaseSlot = resolve;
    });

    const previousChain = this.queueChains[tier];
    this.queueChains[tier] = (async () => {
      try {
        await previousChain;
      } catch {
        // Continue even if previous queue task failed
      }

      const now = Date.now();
      // Remove expired timestamps from the 60-second sliding window
      this.recentTimestamps[tier] = this.recentTimestamps[tier].filter(
        (ts) => now - ts < windowMs
      );

      if (this.recentTimestamps[tier].length >= limit) {
        const oldest = this.recentTimestamps[tier][0] ?? now;
        const waitTime = oldest + windowMs - now + 20;
        if (waitTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        const postWait = Date.now();
        this.recentTimestamps[tier] = this.recentTimestamps[tier].filter(
          (ts) => postWait - ts < windowMs
        );
      }

      // Reserve slot immediately upon acquisition
      this.recentTimestamps[tier].push(Date.now());
      releaseSlot();
    })();

    await slotGranted;
  }

  public async getBudgets(): Promise<{ heavy: number; light: number }> {
    try {
      const storedHeavy = await this.repo.getSetting<number>('dailyAiBudgetHeavy');
      const storedLight = await this.repo.getSetting<number>('dailyAiBudgetLight');
      const heavy = storedHeavy && !isNaN(storedHeavy) && storedHeavy > 0 ? storedHeavy : this.dailyBudgetHeavy;
      const light = storedLight && !isNaN(storedLight) && storedLight > 0 ? storedLight : this.dailyBudgetLight;
      return { heavy, light };
    } catch {
      return { heavy: this.dailyBudgetHeavy, light: this.dailyBudgetLight };
    }
  }

  public async getTodayUsage(day?: string): Promise<TodayUsageStats> {
    const targetDay = day || new Date().toISOString().slice(0, 10);
    const records = await this.repo.getAiUsageToday(targetDay);

    let heavyCount = 0;
    let lightCount = 0;

    for (const r of records) {
      if (this.isHeavyModel(r.model)) {
        heavyCount += r.count;
      } else {
        lightCount += r.count;
      }
    }

    const budgets = await this.getBudgets();

    return {
      day: targetDay,
      heavyCount,
      lightCount,
      totalCount: heavyCount + lightCount,
      heavyBudget: budgets.heavy,
      lightBudget: budgets.light,
      records,
    };
  }

  public async isDailyBudgetExceeded(tier: ModelTier, day?: string): Promise<boolean> {
    const stats = await this.getTodayUsage(day);
    if (tier === 'heavy') {
      return stats.heavyCount >= stats.heavyBudget;
    } else {
      return stats.lightCount >= stats.lightBudget;
    }
  }

  public async enqueue<T>(options: EnqueueOptions<T>): Promise<T> {
    // 1. Result Caching: Check memory and IndexedDB first
    if (options.cacheKey) {
      const cached = await this.getFromCache<T>(options.cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    let currentTier = options.tier;
    let currentModel = options.model;

    // 2. Daily Quota Check with model fallback
    const heavyExceeded = await this.isDailyBudgetExceeded('heavy', today);
    if (currentTier === 'heavy' && heavyExceeded) {
      if (options.fallbackModel) {
        currentTier = 'light';
        currentModel = options.fallbackModel;
      } else if (options.fallbackDeterministic) {
        return await options.fallbackDeterministic();
      } else {
        const budgets = await this.getBudgets();
        throw new Error(
          `Daily budget of ${budgets.heavy} requests exceeded for heavy model (${options.model}).`
        );
      }
    }

    if (currentTier === 'light') {
      const lightExceeded = await this.isDailyBudgetExceeded('light', today);
      if (lightExceeded) {
        if (options.fallbackDeterministic) {
          return await options.fallbackDeterministic();
        } else {
          const budgets = await this.getBudgets();
          throw new Error(
            `Daily budget of ${budgets.light} requests exceeded for light model (${currentModel}).`
          );
        }
      }
    }

    // 3. Execution with Serialized Slot Throttling & 429 Exponential Backoff + Jitter
    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        await this.acquireSlot(currentTier);
        const result = await options.execute(currentModel);

        // Success: record AI usage in IndexedDB
        await this.repo.incrementAiUsage(today, currentModel);

        // Cache result if cacheKey provided
        if (options.cacheKey) {
          await this.setInCache(options.cacheKey, result);
        }

        return result;
      } catch (err: unknown) {
        if (isRateLimitError(err)) {
          attempt++;
          if (attempt <= this.maxRetries) {
            const jitter = Math.random() * 200;
            const delay = this.baseBackoffMs * (2 ** (attempt - 1)) + jitter;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          // Retries exhausted on this model!
          // Try model fallback if we started on heavy tier and haven't tried fallbackModel yet
          if (
            currentTier === 'heavy' &&
            options.fallbackModel &&
            currentModel !== options.fallbackModel
          ) {
            currentTier = 'light';
            currentModel = options.fallbackModel;
            attempt = 0; // reset retry counter for fallback model

            const lightExceeded = await this.isDailyBudgetExceeded('light', today);
            if (lightExceeded) {
              if (options.fallbackDeterministic) {
                return await options.fallbackDeterministic();
              }
              throw new Error('Daily budget exceeded on fallback light model.');
            }
            continue;
          }
        }

        // Fatal non-rate-limit error or all retries exhausted:
        if (options.fallbackDeterministic) {
          return await options.fallbackDeterministic();
        }
        throw err;
      }
    }

    if (options.fallbackDeterministic) {
      return await options.fallbackDeterministic();
    }
    throw new Error('Execution failed after retries.');
  }
}

export const requestQueue = new RequestQueue();
