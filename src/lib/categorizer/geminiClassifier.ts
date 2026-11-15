import { GoogleGenAI, Type } from '@google/genai';
import { DEFAULT_CATEGORIES } from '@/data/categories';
import { normalizeCategoryId } from './categoryNormalizer';

export interface RawTransactionInput {
  merchant: string;
  amount?: number;
  notes?: string;
}

export interface GeminiClassificationResult {
  categoryId: string;
  subcategoryId?: string | null;
  confidence: number;
  reason?: string;
}

const CATEGORY_PROMPT_LIST = DEFAULT_CATEGORIES.map(
  (c) => `${c.id} (${c.name}, ${c.type}${c.parentId ? `, parent: ${c.parentId}` : ''})`
).join('\n');

/**
 * Classifies a batch of transactions using Gemini API (batch up to 25 items per request)
 */
export async function batchClassifyWithGemini(
  items: RawTransactionInput[],
  apiKey: string,
  modelName = 'gemini-3.5-flash-lite'
): Promise<GeminiClassificationResult[]> {
  if (!items.length) return [];
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API key is missing or empty.');
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const allResults: GeminiClassificationResult[] = [];

  // Batch in chunks of up to 25 items
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    const chunkPayload = chunk.map((item, idx) => ({
      index: idx,
      merchant: item.merchant,
      amount: item.amount,
      notes: item.notes || '',
    }));

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Classify the following transactions:\n${JSON.stringify(chunkPayload, null, 2)}`,
        config: {
          systemInstruction: `You are an expert personal finance categorizer for Indian bank and card transactions.
Map each transaction to the most appropriate categoryId and optional subcategoryId from this taxonomy:
${CATEGORY_PROMPT_LIST}

Return a JSON array where each object has:
- index: integer corresponding to transaction index
- categoryId: exact valid category ID from the list
- subcategoryId: optional matching subcategory ID
- confidence: number between 0.0 and 1.0 (set < 0.7 if uncertain)
- reason: brief 3-5 word rationale`,
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                index: { type: Type.INTEGER },
                categoryId: { type: Type.STRING },
                subcategoryId: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ['index', 'categoryId', 'confidence'],
            },
          },
        },
      });

      const parsed: Array<{
        index: number;
        categoryId: string;
        subcategoryId?: string;
        confidence: number;
        reason?: string;
      }> = JSON.parse(response.text || '[]');

      const resultMap = new Map<number, GeminiClassificationResult>();
      for (const item of parsed) {
        const normalized = normalizeCategoryId(item.categoryId, item.subcategoryId);
        resultMap.set(item.index, {
          categoryId: normalized.categoryId,
          subcategoryId: item.subcategoryId || normalized.subcategoryId || null,
          confidence: typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : 0.5,
          reason: item.reason || 'AI Classified',
        });
      }

      // Fill chunk results in order
      for (let idx = 0; idx < chunk.length; idx++) {
        const res = resultMap.get(idx) || {
          categoryId: 'cat_misc',
          subcategoryId: null,
          confidence: 0.4,
          reason: 'AI classification unmapped',
        };
        allResults.push(res);
      }
    } catch (err: unknown) {
      console.warn('Gemini classification chunk failed:', err);
      // Fallback for this chunk
      for (let idx = 0; idx < chunk.length; idx++) {
        allResults.push({
          categoryId: 'cat_misc',
          subcategoryId: null,
          confidence: 0.3,
          reason: err instanceof Error ? err.message : 'AI call failed',
        });
      }
    }
  }

  return allResults;
}

export async function classifySingleWithGemini(
  item: RawTransactionInput,
  apiKey: string,
  modelName = 'gemini-3.5-flash-lite'
): Promise<GeminiClassificationResult> {
  const results = await batchClassifyWithGemini([item], apiKey, modelName);
  return results[0] || {
    categoryId: 'cat_misc',
    subcategoryId: null,
    confidence: 0.3,
    reason: 'Gemini classification empty',
  };
}
