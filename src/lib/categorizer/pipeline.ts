import type { Repository } from '@/data/repository/types';
import type { ClassificationResult, CategorizeOptions } from './types';
import { matchMerchantDictionary } from './dictionary';
import { batchClassifyWithGemini, classifySingleWithGemini } from './geminiClassifier';
import { secretsAdapter } from '@/lib/secrets';

export interface CategorizationInput {
  merchant: string;
  amount?: number;
  notes?: string;
}

/**
 * 3-tier Categorisation Pipeline:
 * Tier 1: User's learned merchant rules
 * Tier 2: Built-in merchant dictionary
 * Tier 3: Gemini AI classification (gemini-3.5-flash-lite)
 * Tier 4: Fallback category
 */
export async function classifyTransaction(
  repository: Repository,
  input: CategorizationInput,
  options?: CategorizeOptions
): Promise<ClassificationResult> {
  const merchant = input.merchant.trim();
  if (!merchant) {
    return {
      categoryId: 'cat_misc',
      subcategoryId: 'sub_general',
      confidence: 0.1,
      source: 'fallback',
      reason: 'Empty merchant',
    };
  }

  // Tier 1: User's learned rules
  const matchingRule = await repository.findMatchingRule(merchant);
  if (matchingRule) {
    return {
      categoryId: matchingRule.categoryId,
      subcategoryId: matchingRule.subcategoryId || null,
      confidence: 1.0,
      source: 'rule',
      ruleId: matchingRule.id,
      reason: 'Learned merchant rule',
    };
  }

  // Tier 2: Built-in merchant dictionary
  const dictMatch = matchMerchantDictionary(merchant);
  if (dictMatch) {
    return {
      categoryId: dictMatch.categoryId,
      subcategoryId: dictMatch.subcategoryId || null,
      confidence: 0.95,
      source: 'dictionary',
      reason: 'Matched built-in merchant dictionary',
    };
  }

  // Tier 3: Gemini AI classification
  if (options?.useAi) {
    const key = options.apiKey || (await secretsAdapter.getApiKey());
    if (key) {
      try {
        const aiResult = await classifySingleWithGemini(
          input,
          key,
          options.model || 'gemini-3.5-flash-lite',
          options.privacyMode ?? true
        );
        return {
          categoryId: aiResult.categoryId,
          subcategoryId: aiResult.subcategoryId,
          confidence: aiResult.confidence,
          source: 'ai',
          reason: aiResult.reason,
        };
      } catch (err: unknown) {
        console.warn('AI classification failed in pipeline, falling back:', err);
      }
    }
  }

  // Tier 4: Fallback
  return {
    categoryId: 'cat_misc',
    subcategoryId: 'sub_general',
    confidence: 0.3,
    source: 'fallback',
    reason: 'Unclassified default',
  };
}

/**
 * Batch classify transactions through the 3-tier pipeline
 */
export async function batchClassifyTransactions(
  repository: Repository,
  inputs: CategorizationInput[],
  options?: CategorizeOptions
): Promise<ClassificationResult[]> {
  const results: Array<ClassificationResult | null> = new Array(inputs.length).fill(null);
  const pendingAiIndices: number[] = [];
  const pendingAiInputs: CategorizationInput[] = [];

  // Pass 1: Tier 1 & Tier 2
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    if (!input) continue;
    const merchant = input.merchant.trim();
    if (!merchant) {
      results[i] = {
        categoryId: 'cat_misc',
        subcategoryId: 'sub_general',
        confidence: 0.1,
        source: 'fallback',
        reason: 'Empty merchant',
      };
      continue;
    }

    // Tier 1: Rules
    const matchingRule = await repository.findMatchingRule(merchant);
    if (matchingRule) {
      results[i] = {
        categoryId: matchingRule.categoryId,
        subcategoryId: matchingRule.subcategoryId || null,
        confidence: 1.0,
        source: 'rule',
        ruleId: matchingRule.id,
        reason: 'Learned merchant rule',
      };
      continue;
    }

    // Tier 2: Dictionary
    const dictMatch = matchMerchantDictionary(merchant);
    if (dictMatch) {
      results[i] = {
        categoryId: dictMatch.categoryId,
        subcategoryId: dictMatch.subcategoryId || null,
        confidence: 0.95,
        source: 'dictionary',
        reason: 'Matched built-in merchant dictionary',
      };
      continue;
    }

    // Collect for Tier 3
    if (options?.useAi) {
      pendingAiIndices.push(i);
      pendingAiInputs.push(input);
    } else {
      results[i] = {
        categoryId: 'cat_misc',
        subcategoryId: 'sub_general',
        confidence: 0.3,
        source: 'fallback',
        reason: 'Unclassified default',
      };
    }
  }

  // Pass 2: Tier 3 AI Batching
  if (pendingAiInputs.length > 0) {
    const key = options?.apiKey || (await secretsAdapter.getApiKey());
    if (key) {
      try {
        const aiResults = await batchClassifyWithGemini(
          pendingAiInputs,
          key,
          options?.model || 'gemini-3.5-flash-lite',
          options?.privacyMode ?? true
        );
        for (let j = 0; j < aiResults.length; j++) {
          const originalIdx = pendingAiIndices[j];
          const r = aiResults[j];
          if (originalIdx !== undefined && r) {
            results[originalIdx] = {
              categoryId: r.categoryId,
              subcategoryId: r.subcategoryId,
              confidence: r.confidence,
              source: 'ai',
              reason: r.reason,
            };
          }
        }
      } catch (e) {
        console.warn('Batch AI classification failed:', e);
      }
    }

    // Any remaining unanswered indices fall back
    for (let k = 0; k < pendingAiIndices.length; k++) {
      const idx = pendingAiIndices[k];
      if (idx !== undefined && !results[idx]) {
        results[idx] = {
          categoryId: 'cat_misc',
          subcategoryId: 'sub_general',
          confidence: 0.3,
          source: 'fallback',
          reason: 'Unclassified fallback',
        };
      }
    }
  }

  return results.map(
    (r) =>
      r || {
        categoryId: 'cat_misc',
        subcategoryId: 'sub_general',
        confidence: 0.3,
        source: 'fallback',
        reason: 'Default fallback',
      }
  );
}
