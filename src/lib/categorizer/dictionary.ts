import type { DictionaryEntry } from './types';

export const MERCHANT_DICTIONARY: DictionaryEntry[] = [
  // Food Delivery & Dining
  {
    patterns: ['swiggy', 'zomato', 'eatclub', 'box8', 'faasos', 'behrouz', 'biryani by kilo'],
    categoryId: 'cat_food_dining',
    subcategoryId: 'sub_delivery',
  },
  {
    patterns: ['starbucks', 'blue tokai', 'third wave coffee', 'chaayos', 'chai point', 'costa coffee', 'cafe coffee day', 'ccd'],
    categoryId: 'cat_food_dining',
    subcategoryId: 'sub_cafes',
  },
  {
    patterns: ["mcdonald's", 'mcdonalds', 'burger king', "domino's", 'dominos', 'pizza hut', 'subway', 'kfc', 'haldiram', 'haldirams', 'bikanervala', 'saravanaa bhavan', 'barbeque nation', 'wow momo'],
    categoryId: 'cat_food_dining',
    subcategoryId: 'sub_restaurant',
  },

  // Groceries & Quick Commerce
  {
    patterns: ['blinkit', 'zepto', 'instamart', 'bigbasket', 'bb daily', 'milkbasket', 'dunzo daily', 'country delight'],
    categoryId: 'cat_groceries',
    subcategoryId: 'sub_supermarket',
  },
  {
    patterns: ['d-mart', 'dmart', 'more retail', 'more supermarket', "spencer's", 'spencers', 'reliance fresh', 'reliance smart', 'nature basket', "nature's basket"],
    categoryId: 'cat_groceries',
    subcategoryId: 'sub_supermarket',
  },
  {
    patterns: ['amul', 'mother dairy', 'nandini'],
    categoryId: 'cat_groceries',
    subcategoryId: 'sub_dairy',
  },

  // Transport & Fuel
  {
    patterns: ['uber', 'ola', 'rapido', 'blusmart'],
    categoryId: 'cat_transport',
    subcategoryId: 'sub_cabs',
  },
  {
    patterns: ['shell', 'indian oil', 'iocl', 'hpcl', 'hindustan petroleum', 'bpcl', 'bharat petroleum', 'petrol', 'diesel', 'cng'],
    categoryId: 'cat_transport',
    subcategoryId: 'sub_fuel',
  },
  {
    patterns: ['namma metro', 'delhi metro', 'dmrc', 'bmrc', 'fastag', 'irctc', 'toll', 'nhai'],
    categoryId: 'cat_transport',
    subcategoryId: 'sub_transit',
  },

  // Utilities & Bills
  {
    patterns: ['bescom', 'tata power', 'adani electricity', 'bses', 'msedcl', 'cesc', 'uppcl', 'dhbvn', 'electricity'],
    categoryId: 'cat_utilities',
    subcategoryId: 'sub_electricity',
  },
  {
    patterns: ['bwssb', 'delhi jal board', 'djb', 'igl', 'indraprastha gas', 'mahanagar gas', 'mgl', 'hp gas', 'indane', 'bharat gas', 'piped gas'],
    categoryId: 'cat_utilities',
    subcategoryId: 'sub_water_gas',
  },
  {
    patterns: ['act fibernet', 'airtel broadband', 'jiofiber', 'tata play fiber', 'hathway', 'spectranet', 'broadband'],
    categoryId: 'cat_utilities',
    subcategoryId: 'sub_broadband',
  },
  {
    patterns: ['airtel prepaid', 'airtel postpaid', 'jio prepaid', 'jio postpaid', 'vodafone idea', 'vi recharge', 'bsnl mobile'],
    categoryId: 'cat_utilities',
    subcategoryId: 'sub_mobile',
  },

  // Shopping & E-Commerce
  {
    patterns: ['amazon', 'flipkart', 'meesho', 'tata cliq', 'snapdeal'],
    categoryId: 'cat_shopping',
    subcategoryId: 'sub_clothing',
  },
  {
    patterns: ['myntra', 'ajio', 'zara', 'h&m', 'uniqlo', 'lifestyle', 'shoppers stop', 'marks & spencer', 'pantaloons', 'westside', 'decathlon'],
    categoryId: 'cat_shopping',
    subcategoryId: 'sub_clothing',
  },
  {
    patterns: ['croma', 'reliance digital', 'vijay sales', 'apple store', 'samsung store'],
    categoryId: 'cat_shopping',
    subcategoryId: 'sub_electronics',
  },
  {
    patterns: ['ikea', 'urban ladder', 'pepperfry', 'home centre'],
    categoryId: 'cat_shopping',
    subcategoryId: 'sub_home_decor',
  },

  // Subscriptions & Digital Services
  {
    patterns: ['netflix', 'disney+', 'hotstar', 'amazon prime video', 'prime video', 'sonyliv', 'zee5', 'youtube premium', 'apple tv'],
    categoryId: 'cat_subscriptions',
    subcategoryId: 'sub_streaming_video',
  },
  {
    patterns: ['spotify', 'apple music', 'amazon music', 'gaana', 'wynk', 'youtube music'],
    categoryId: 'cat_subscriptions',
    subcategoryId: 'sub_streaming_audio',
  },
  {
    patterns: ['github', 'openai', 'chatgpt', 'claude', 'midjourney', 'google storage', 'google one', 'icloud', 'notion', 'figma', 'microsoft 365'],
    categoryId: 'cat_subscriptions',
    subcategoryId: 'sub_software',
  },

  // Entertainment & Leisure
  {
    patterns: ['bookmyshow', 'pvr', 'inox', 'cinepolis', 'carnival cinemas'],
    categoryId: 'cat_entertainment',
    subcategoryId: 'sub_movies',
  },
  {
    patterns: ['steam', 'playstation', 'psn', 'xbox', 'nintendo'],
    categoryId: 'cat_entertainment',
    subcategoryId: 'sub_gaming',
  },

  // Health, Pharma & Wellness
  {
    patterns: ['apollo', 'apollo pharmacy', 'tata 1mg', '1mg', 'pharmeasy', 'netmeds', 'medplus', 'wellness forever'],
    categoryId: 'cat_health',
    subcategoryId: 'sub_pharmacy',
  },
  {
    patterns: ['dr lal pathlabs', 'lal pathlabs', 'metropolis', 'srl diagnostics', 'thyrocare'],
    categoryId: 'cat_health',
    subcategoryId: 'sub_diagnostics',
  },
  {
    patterns: ['cult.fit', 'cultfit', 'curefit', 'gold gym', 'anytime fitness', 'practo', 'fortis', 'manipal hospital', 'max healthcare'],
    categoryId: 'cat_health',
    subcategoryId: 'sub_consultation',
  },

  // Investments & Wealth
  {
    patterns: ['zerodha', 'kite', 'groww', 'indmoney', 'kuvera', 'upstox', 'smallcase', 'et money', 'coin zerodha'],
    categoryId: 'cat_investments',
    subcategoryId: 'sub_mutual_funds',
  },

  // Housing & Repairs
  {
    patterns: ['urban company', 'urbanclap', 'housejoy', 'nobroker rent', 'mygate'],
    categoryId: 'cat_housing',
    subcategoryId: 'sub_maintenance',
  },

  // Personal Care
  {
    patterns: ['looks salon', 'toni & guy', 'enrich salon', 'geetanjali salon', 'kaya clinic', 'nykaa'],
    categoryId: 'cat_personal_care',
    subcategoryId: 'sub_salon',
  },

  // Travel
  {
    patterns: ['makemytrip', 'mmt', 'cleartrip', 'goibibo', 'yatra', 'indigo', 'air india', 'vistara', 'booking.com', 'airbnb', 'agoda'],
    categoryId: 'cat_travel',
    subcategoryId: 'sub_flights',
  },

  // Insurance
  {
    patterns: ['hdfc ergo', 'icici lombard', 'star health', 'care health', 'max life', 'lic of india', 'policybazaar'],
    categoryId: 'cat_insurance',
    subcategoryId: 'sub_health_insurance',
  },

  // EMI & Loans
  {
    patterns: ['hdfc bank emi', 'icici loan', 'sbi card emi', 'bajaj finserv', 'tata capital', 'home credit'],
    categoryId: 'cat_emi_loans',
    subcategoryId: 'sub_personal_loan',
  },
];

export function matchMerchantDictionary(merchant: string): DictionaryEntry | undefined {
  if (!merchant) return undefined;
  const normalized = merchant.toLowerCase().trim();
  if (normalized.length === 0) return undefined;

  // 1. Exact match on any pattern
  for (const entry of MERCHANT_DICTIONARY) {
    for (const pat of entry.patterns) {
      if (normalized === pat) return entry;
    }
  }

  // 2. Substring match: check if the transaction text contains the known merchant keyword
  for (const entry of MERCHANT_DICTIONARY) {
    for (const pat of entry.patterns) {
      if (normalized.includes(pat)) {
        return entry;
      }
    }
  }

  // 3. Prefix match if user typed first 4+ characters of a known merchant
  if (normalized.length >= 4) {
    for (const entry of MERCHANT_DICTIONARY) {
      for (const pat of entry.patterns) {
        if (pat.startsWith(normalized)) {
          return entry;
        }
      }
    }
  }

  return undefined;
}
