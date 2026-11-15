import { subDays, format } from 'date-fns';
import { PaymentMethod } from '@/types';

export interface ParsedDraft {
  amount: number | null;
  merchant: string;
  paymentMethod: PaymentMethod;
  date: string; // ISO YYYY-MM-DD
  categoryId?: string;
  subcategoryId?: string;
  notes?: string;
  rawInput: string;
}

const PAYMENT_KEYWORDS: Record<string, PaymentMethod> = {
  upi: 'upi',
  gpay: 'upi',
  phonepe: 'upi',
  paytm: 'upi',
  card: 'card',
  credit: 'card',
  debit: 'card',
  cash: 'cash',
  netbanking: 'net_banking',
  neft: 'net_banking',
  rtgs: 'net_banking',
  imps: 'net_banking',
  wallet: 'wallet',
};

const MERCHANT_CATEGORY_MAP: Record<string, { categoryId: string; subcategoryId?: string }> = {
  zomato: { categoryId: 'cat_food_dining', subcategoryId: 'sub_delivery' },
  swiggy: { categoryId: 'cat_food_dining', subcategoryId: 'sub_delivery' },
  zepto: { categoryId: 'cat_groceries', subcategoryId: 'sub_supermarket' },
  blinkit: { categoryId: 'cat_groceries', subcategoryId: 'sub_supermarket' },
  instamart: { categoryId: 'cat_groceries', subcategoryId: 'sub_supermarket' },
  uber: { categoryId: 'cat_transport', subcategoryId: 'sub_cabs' },
  ola: { categoryId: 'cat_transport', subcategoryId: 'sub_cabs' },
  metro: { categoryId: 'cat_transport', subcategoryId: 'sub_transit' },
  starbucks: { categoryId: 'cat_food_dining', subcategoryId: 'sub_cafes' },
  coffee: { categoryId: 'cat_food_dining', subcategoryId: 'sub_cafes' },
  amazon: { categoryId: 'cat_shopping', subcategoryId: 'sub_electronics' },
  flipkart: { categoryId: 'cat_shopping', subcategoryId: 'sub_home_decor' },
  myntra: { categoryId: 'cat_shopping', subcategoryId: 'sub_clothing' },
  netflix: { categoryId: 'cat_subscriptions', subcategoryId: 'sub_streaming_video' },
  spotify: { categoryId: 'cat_subscriptions', subcategoryId: 'sub_streaming_audio' },
  rent: { categoryId: 'cat_housing', subcategoryId: 'sub_rent' },
  petrol: { categoryId: 'cat_transport', subcategoryId: 'sub_fuel' },
  fuel: { categoryId: 'cat_transport', subcategoryId: 'sub_fuel' },
  electricity: { categoryId: 'cat_utilities', subcategoryId: 'sub_electricity' },
  wifi: { categoryId: 'cat_utilities', subcategoryId: 'sub_broadband' },
  doctor: { categoryId: 'cat_health', subcategoryId: 'sub_consultation' },
  medicine: { categoryId: 'cat_health', subcategoryId: 'sub_pharmacy' },
  pharmacy: { categoryId: 'cat_health', subcategoryId: 'sub_pharmacy' },
};

const CURRENCY_SYMBOLS = new Set(['₹', 'rs', 'rs.', 'inr', '/-']);

/**
 * Local regex fallback parser for natural language expense string
 * e.g., "450 zomato yesterday upi" -> { amount: 450, merchant: 'zomato', ... }
 */
export function parseExpenseTextLocally(input: string): ParsedDraft {
  const trimmed = input.trim();
  const tokens = trimmed.split(/\s+/);

  let amount: number | null = null;
  let paymentMethod: PaymentMethod = 'upi'; // default in India
  let date = format(new Date(), 'yyyy-MM-dd');
  const merchantTokens: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const rawToken = tokens[i];
    if (!rawToken) continue;
    const token = rawToken.toLowerCase();

    // Check for standalone currency symbol (e.g. "₹", "Rs.", "inr", "/-")
    if (CURRENCY_SYMBOLS.has(token)) {
      continue;
    }

    // Check for amount (e.g. 450, ₹450, 450/-, ₹450/-, 450.50, rs.450, 1,500, 15k)
    // Strip commas and trailing /-
    const cleanToken = token.replace(/,/g, '').replace(/\/-\s*$/, '');
    const amountMatch = cleanToken.match(/^(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)(k)?$/i);
    if (amountMatch && amount === null) {
      let val = parseFloat(amountMatch[1] || '0');
      if (amountMatch[2] && amountMatch[2].toLowerCase() === 'k') {
        val *= 1000;
      }
      amount = val;
      continue;
    }

    // Check for payment method
    if (PAYMENT_KEYWORDS[token]) {
      paymentMethod = PAYMENT_KEYWORDS[token] as PaymentMethod;
      continue;
    }

    // Check for relative date
    if (token === 'yesterday') {
      date = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      continue;
    }
    if (token === 'today') {
      date = format(new Date(), 'yyyy-MM-dd');
      continue;
    }

    // Don't add isolated symbols or punctuation to merchant name
    if (!CURRENCY_SYMBOLS.has(token.replace(/[.,/\\-]/g, ''))) {
      merchantTokens.push(rawToken);
    }
  }

  const rawMerchant = merchantTokens.join(' ').trim();
  const merchant = rawMerchant.length > 0 ? rawMerchant : 'Expense';

  // Category lookup
  let categoryId: string | undefined = undefined;
  let subcategoryId: string | undefined = undefined;

  for (const [key, mapping] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (merchant.toLowerCase().includes(key)) {
      categoryId = mapping.categoryId;
      subcategoryId = mapping.subcategoryId;
      break;
    }
  }

  // Default category if not matched
  if (!categoryId) {
    categoryId = 'cat_misc';
    subcategoryId = 'sub_general';
  }

  return {
    amount,
    merchant: merchant.charAt(0).toUpperCase() + merchant.slice(1),
    paymentMethod,
    date,
    categoryId,
    subcategoryId,
    notes: `Quick-added: "${input}"`,
    rawInput: input,
  };
}
