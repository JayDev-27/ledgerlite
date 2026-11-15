import { GoogleGenAI, Type } from '@google/genai';
import { parseExpenseTextLocally, ParsedDraft } from './quickAddParser';
import { secretsAdapter } from '@/lib/secrets';
import { DEFAULT_CATEGORIES } from '@/data/categories';
import { normalizeCategoryId } from '@/lib/categorizer/categoryNormalizer';
import { PaymentMethod } from '@/types';

export interface AiQuickAddOptions {
  apiKey?: string;
  currentDate?: string; // YYYY-MM-DD
  timezone?: string;
  currency?: string;
}

const CATEGORY_NAMES = DEFAULT_CATEGORIES.filter((c) => !c.parentId)
  .map((c) => `${c.id} (${c.name})`)
  .join(', ');

export async function parseQuickAddExpense(
  text: string,
  options?: AiQuickAddOptions
): Promise<ParsedDraft> {
  const trimmed = text.trim();
  if (!trimmed) {
    return parseExpenseTextLocally('');
  }

  const key = options?.apiKey || (await secretsAdapter.getApiKey());
  if (!key) {
    return parseExpenseTextLocally(trimmed);
  }

  const now = new Date();
  const currentDate = options?.currentDate || now.toISOString().split('T')[0];
  const timezone = options?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  const currency = options?.currency || 'INR';

  try {
    const ai = new GoogleGenAI({ apiKey: key.trim() });
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: `Parse this expense string: "${trimmed}"`,
      config: {
        systemInstruction: `You are an expert expense parser. Current date is ${currentDate}, timezone is ${timezone}, currency is ${currency}.
Extract the amount (number), merchant/payee (string), date (YYYY-MM-DD format, resolving relative terms like 'yesterday', 'today', 'last Friday'), categoryId (one of: ${CATEGORY_NAMES}), paymentMethod (one of: 'upi', 'card', 'cash', 'net_banking', 'wallet'), and optional notes.
If payment method is not mentioned, infer 'upi' for Indian context. If merchant is not obvious, use a concise description.`,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: 'Numeric expense amount' },
            merchant: { type: Type.STRING, description: 'Payee or merchant name' },
            date: { type: Type.STRING, description: 'ISO date YYYY-MM-DD' },
            categoryId: { type: Type.STRING, description: 'Best matching category ID' },
            subcategoryId: { type: Type.STRING, description: 'Optional subcategory ID' },
            paymentMethod: {
              type: Type.STRING,
              enum: ['upi', 'card', 'cash', 'net_banking', 'wallet'],
            },
            notes: { type: Type.STRING, description: 'Optional notes' },
          },
          required: ['amount', 'merchant', 'date', 'categoryId', 'paymentMethod'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.amount && parsed.merchant) {
      const normalizedCat = normalizeCategoryId(parsed.categoryId, parsed.subcategoryId);
      const validPaymentMethods: PaymentMethod[] = ['upi', 'card', 'cash', 'net_banking', 'wallet'];
      const paymentMethod: PaymentMethod = validPaymentMethods.includes(parsed.paymentMethod)
        ? parsed.paymentMethod
        : 'upi';

      return {
        amount: Math.abs(Number(parsed.amount)),
        merchant: String(parsed.merchant).trim(),
        date: String(parsed.date || currentDate),
        categoryId: normalizedCat.categoryId,
        subcategoryId: parsed.subcategoryId || normalizedCat.subcategoryId || null,
        paymentMethod,
        notes: parsed.notes || undefined,
        rawInput: trimmed,
      };
    }
  } catch (err: unknown) {
    console.warn('Gemini quick-add parsing failed, using local parser fallback:', err);
  }

  // Fallback to local regex parser
  return parseExpenseTextLocally(trimmed);
}
