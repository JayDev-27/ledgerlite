import { DEFAULT_CATEGORIES } from './categories';
import type {
  Transaction,
  Budget,
  Rule,
  RecurringExpense,
  MemoryItem,
  PaymentMethod,
  TransactionSource,
} from '@/types';
import { Repository } from './repository/types';

interface SeedResult {
  categoriesCount: number;
  transactionsCount: number;
  budgetsCount: number;
  rulesCount: number;
  recurringCount: number;
  memoryCount: number;
}

// Pseudo-random deterministic number generator (so seed data is reproducible)
class SeedRandom {
  private seed: number;
  constructor(seed = 42) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  range(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }
  pick<T>(arr: T[]): T {
    const idx = Math.floor(this.next() * arr.length);
    const item = arr[idx];
    if (item === undefined) {
      throw new Error('Cannot pick from empty array');
    }
    return item;
  }
}

export function generateSeedData(): {
  transactions: Transaction[];
  budgets: Budget[];
  rules: Rule[];
  recurring: RecurringExpense[];
  memory: MemoryItem[];
} {
  const rng = new SeedRandom(12345);
  const transactions: Transaction[] = [];
  const rules: Rule[] = [];
  const recurring: RecurringExpense[] = [];
  const memory: MemoryItem[] = [];
  const budgets: Budget[] = [];

  // -----------------------------------------------------------------
  // 1. RECURRING TEMPLATES & RULES
  // -----------------------------------------------------------------
  const recurringSpecs: Array<{
    merchant: string;
    amount: number;
    categoryId: string;
    subcategoryId: string;
    dayOfMonth: number;
    paymentMethod: PaymentMethod;
    cadence: 'monthly';
    tags: string[];
    notes: string;
  }> = [
    {
      merchant: 'House Rent (Mr. Ramesh)',
      amount: 35000,
      categoryId: 'cat_housing',
      subcategoryId: 'sub_rent',
      dayOfMonth: 1,
      paymentMethod: 'net_banking',
      cadence: 'monthly',
      tags: ['fixed', 'rent', 'housing'],
      notes: 'Monthly apartment rent via NEFT',
    },
    {
      merchant: 'Sobha Society Maintenance',
      amount: 3800,
      categoryId: 'cat_housing',
      subcategoryId: 'sub_maintenance',
      dayOfMonth: 5,
      paymentMethod: 'upi',
      cadence: 'monthly',
      tags: ['housing', 'maintenance'],
      notes: 'Apartment maintenance & amenities charge',
    },
    {
      merchant: 'HDFC Bank Home Loan EMI',
      amount: 42500,
      categoryId: 'cat_emi_loans',
      subcategoryId: 'sub_home_loan',
      dayOfMonth: 10,
      paymentMethod: 'net_banking',
      cadence: 'monthly',
      tags: ['fixed', 'emi', 'loan'],
      notes: 'Auto-debit loan account #4892',
    },
    {
      merchant: 'ICICI Bank Auto Loan EMI',
      amount: 14200,
      categoryId: 'cat_emi_loans',
      subcategoryId: 'sub_auto_loan',
      dayOfMonth: 7,
      paymentMethod: 'net_banking',
      cadence: 'monthly',
      tags: ['fixed', 'emi', 'car'],
      notes: 'Car loan auto-debit #9124',
    },
    {
      merchant: 'Parag Parikh Flexi Cap SIP',
      amount: 25000,
      categoryId: 'cat_investments',
      subcategoryId: 'sub_mutual_funds',
      dayOfMonth: 5,
      paymentMethod: 'net_banking',
      cadence: 'monthly',
      tags: ['investment', 'sip', 'wealth'],
      notes: 'Monthly SIP via Zerodha Coin',
    },
    {
      merchant: 'UTI Nifty 50 Index SIP',
      amount: 15000,
      categoryId: 'cat_investments',
      subcategoryId: 'sub_mutual_funds',
      dayOfMonth: 12,
      paymentMethod: 'net_banking',
      cadence: 'monthly',
      tags: ['investment', 'sip', 'index-fund'],
      notes: 'Monthly Index SIP via Groww',
    },
    {
      merchant: 'Airtel Fiber Broadband',
      amount: 1179,
      categoryId: 'cat_utilities',
      subcategoryId: 'sub_broadband',
      dayOfMonth: 15,
      paymentMethod: 'upi',
      cadence: 'monthly',
      tags: ['utility', 'internet'],
      notes: '300 Mbps unlimited fiber connection',
    },
    {
      merchant: 'Netflix India Premium',
      amount: 649,
      categoryId: 'cat_subscriptions',
      subcategoryId: 'sub_streaming_video',
      dayOfMonth: 18,
      paymentMethod: 'card',
      cadence: 'monthly',
      tags: ['subscription', 'entertainment'],
      notes: '4K Ultra HD family plan',
    },
    {
      merchant: 'Spotify Premium Duo',
      amount: 149,
      categoryId: 'cat_subscriptions',
      subcategoryId: 'sub_streaming_audio',
      dayOfMonth: 22,
      paymentMethod: 'card',
      cadence: 'monthly',
      tags: ['subscription', 'music'],
      notes: 'Monthly music streaming',
    },
    {
      merchant: 'Apple iCloud 200GB',
      amount: 219,
      categoryId: 'cat_subscriptions',
      subcategoryId: 'sub_software',
      dayOfMonth: 28,
      paymentMethod: 'card',
      cadence: 'monthly',
      tags: ['subscription', 'cloud'],
      notes: 'Family storage sharing',
    },
  ];

  recurringSpecs.forEach((spec, idx) => {
    const recId = `rec_${idx + 1}`;
    recurring.push({
      id: recId,
      template: {
        amount: spec.amount,
        currency: 'INR',
        merchant: spec.merchant,
        categoryId: spec.categoryId,
        subcategoryId: spec.subcategoryId,
        paymentMethod: spec.paymentMethod,
        notes: spec.notes,
        tags: spec.tags,
      },
      cadence: spec.cadence,
      nextDue: `2026-11-${String(spec.dayOfMonth).padStart(2, '0')}`,
      active: true,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    });
  });

  // Learned merchant rules
  const rulesList: Array<{ matcher: string; categoryId: string; subcategoryId?: string; hits: number }> = [
    { matcher: 'zepto', categoryId: 'cat_groceries', subcategoryId: 'sub_supermarket', hits: 78 },
    { matcher: 'blinkit', categoryId: 'cat_groceries', subcategoryId: 'sub_supermarket', hits: 54 },
    { matcher: 'swiggy', categoryId: 'cat_food_dining', subcategoryId: 'sub_delivery', hits: 92 },
    { matcher: 'zomato', categoryId: 'cat_food_dining', subcategoryId: 'sub_delivery', hits: 67 },
    { matcher: 'uber', categoryId: 'cat_transport', subcategoryId: 'sub_cabs', hits: 85 },
    { matcher: 'ola', categoryId: 'cat_transport', subcategoryId: 'sub_cabs', hits: 24 },
    { matcher: 'blue tokai', categoryId: 'cat_food_dining', subcategoryId: 'sub_cafes', hits: 41 },
    { matcher: 'third wave coffee', categoryId: 'cat_food_dining', subcategoryId: 'sub_cafes', hits: 36 },
    { matcher: 'starbucks', categoryId: 'cat_food_dining', subcategoryId: 'sub_cafes', hits: 18 },
    { matcher: 'amazon', categoryId: 'cat_shopping', subcategoryId: 'sub_electronics', hits: 39 },
    { matcher: 'myntra', categoryId: 'cat_shopping', subcategoryId: 'sub_clothing', hits: 22 },
    { matcher: 'netflix', categoryId: 'cat_subscriptions', subcategoryId: 'sub_streaming_video', hits: 7 },
    { matcher: 'apollo pharmacy', categoryId: 'cat_health', subcategoryId: 'sub_pharmacy', hits: 15 },
    { matcher: 'tata power', categoryId: 'cat_utilities', subcategoryId: 'sub_electricity', hits: 7 },
  ];

  rulesList.forEach((r, idx) => {
    rules.push({
      id: `rule_${idx + 1}`,
      matcher: {
        field: 'merchant',
        operator: 'contains',
        value: r.matcher,
      },
      categoryId: r.categoryId,
      subcategoryId: r.subcategoryId,
      hits: r.hits,
      createdAt: '2026-05-10T10:00:00.000Z',
    });
  });

  // Long-term financial memory items
  memory.push(
    {
      id: 'mem_1',
      kind: 'income',
      text: 'Monthly in-hand salary of ₹2,10,000 is credited on the 28th of every month from Tech Corp.',
      createdAt: '2026-05-01T10:00:00.000Z',
      approvedAt: '2026-05-01T10:05:00.000Z',
    },
    {
      id: 'mem_2',
      kind: 'goal',
      text: 'Emergency fund target: Maintain ₹4,50,000 (6 months of baseline survival spend) in liquid funds.',
      createdAt: '2026-05-02T14:30:00.000Z',
      approvedAt: '2026-05-02T14:35:00.000Z',
    },
    {
      id: 'mem_3',
      kind: 'goal',
      text: 'Saving for Autumn 2027 Japan & Europe vacation with an estimated target of ₹2,80,000.',
      createdAt: '2026-06-15T09:20:00.000Z',
      approvedAt: '2026-06-15T09:22:00.000Z',
    },
    {
      id: 'mem_4',
      kind: 'preference',
      text: 'Prefers UPI (PhonePe) for local transactions under ₹2,000, and HDFC Regalia Credit Card for flights, luxury dining, and electronics to maximize reward points.',
      createdAt: '2026-07-04T16:00:00.000Z',
      approvedAt: '2026-07-04T16:01:00.000Z',
    },
    {
      id: 'mem_5',
      kind: 'recurring_fact',
      text: 'House rent ₹35,000 is paid directly to landlord Mr. Ramesh via NEFT on the 1st of every month.',
      createdAt: '2026-05-01T11:00:00.000Z',
      approvedAt: '2026-05-01T11:00:00.000Z',
    }
  );

  // -----------------------------------------------------------------
  // 2. BUDGETS (May 2026 to Nov 2026)
  // -----------------------------------------------------------------
  const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
  months.forEach((m) => {
    budgets.push({
      id: `budget_${m}`,
      month: m,
      totalLimit: 150000,
      categoryLimits: {
        cat_housing: 38800,
        cat_emi_loans: 56700,
        cat_groceries: 20000,
        cat_food_dining: 16000,
        cat_transport: 12000,
        cat_utilities: 7500,
        cat_shopping: 14000,
        cat_entertainment: 8000,
        cat_subscriptions: 2500,
        cat_health: 6000,
        cat_personal_care: 5000,
        cat_investments: 40000,
      },
      rollover: true,
      createdAt: `${m}-01T00:00:00.000Z`,
      updatedAt: `${m}-01T00:00:00.000Z`,
    });
  });

  // -----------------------------------------------------------------
  // 3. TRANSACTIONS GENERATION (~800 transactions across 199 days)
  // May 1, 2026 to Nov 15, 2026
  // -----------------------------------------------------------------
  const startDate = new Date(2026, 4, 1); // May 1, 2026
  const endDate = new Date(2026, 10, 15); // Nov 15, 2026
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  let txCounter = 1000;

  // Generate monthly recurring entries for each of the 7 months
  months.forEach((m) => {
    recurringSpecs.forEach((spec, rIdx) => {
      // If November, only include if dayOfMonth <= 15
      if (m === '2026-11' && spec.dayOfMonth > 15) {
        return;
      }
      const dayStr = String(spec.dayOfMonth).padStart(2, '0');
      const isoDate = `${m}-${dayStr}T09:30:00.000Z`;

      transactions.push({
        id: `tx_${++txCounter}`,
        amount: spec.amount,
        currency: 'INR',
        date: isoDate,
        merchant: spec.merchant,
        categoryId: spec.categoryId,
        subcategoryId: spec.subcategoryId,
        paymentMethod: spec.paymentMethod,
        notes: spec.notes,
        tags: spec.tags,
        recurringId: `rec_${rIdx + 1}`,
        source: 'recurring',
        confidence: 1.0,
        createdAt: isoDate,
        updatedAt: isoDate,
      });
    });

    // Monthly Electricity bill around the 20th
    if (m !== '2026-11') {
      const elecDate = `${m}-20T11:15:00.000Z`;
      const elecAmount = rng.range(2100, 3900);
      transactions.push({
        id: `tx_${++txCounter}`,
        amount: elecAmount,
        currency: 'INR',
        date: elecDate,
        merchant: 'Tata Power Electricity Bill',
        categoryId: 'cat_utilities',
        subcategoryId: 'sub_electricity',
        paymentMethod: 'upi',
        notes: 'Monthly power consumption bill',
        tags: ['utility', 'electricity'],
        recurringId: null,
        source: 'manual',
        confidence: 1.0,
        createdAt: elecDate,
        updatedAt: elecDate,
      });
    }
  });

  // Daily pool of realistic merchant events
  const dailyTemplates: Array<{
    merchant: string;
    minAmt: number;
    maxAmt: number;
    categoryId: string;
    subcategoryId: string;
    paymentMethod: PaymentMethod;
    tags: string[];
    weight: number; // probability weight
    notesPrefix: string;
  }> = [
    // Groceries (high frequency)
    { merchant: 'Zepto Instant Grocery', minAmt: 190, maxAmt: 850, categoryId: 'cat_groceries', subcategoryId: 'sub_supermarket', paymentMethod: 'upi', tags: ['quick-commerce', 'groceries'], weight: 14, notesPrefix: 'Daily essentials & milk' },
    { merchant: 'Blinkit Essentials', minAmt: 320, maxAmt: 1250, categoryId: 'cat_groceries', subcategoryId: 'sub_supermarket', paymentMethod: 'upi', tags: ['groceries', 'household'], weight: 10, notesPrefix: 'Weekly kitchen restock' },
    { merchant: 'Swiggy Instamart', minAmt: 150, maxAmt: 650, categoryId: 'cat_groceries', subcategoryId: 'sub_supermarket', paymentMethod: 'upi', tags: ['snacks', 'groceries'], weight: 8, notesPrefix: 'Snacks and beverages' },
    { merchant: "Nature's Basket Organic", minAmt: 1800, maxAmt: 4200, categoryId: 'cat_groceries', subcategoryId: 'sub_fresh_produce', paymentMethod: 'card', tags: ['organic', 'groceries'], weight: 3, notesPrefix: 'Gourmet cheese & organic vegetables' },

    // Food & Dining (high frequency)
    { merchant: 'Swiggy Food Delivery', minAmt: 280, maxAmt: 780, categoryId: 'cat_food_dining', subcategoryId: 'sub_delivery', paymentMethod: 'upi', tags: ['food-delivery', 'dinner'], weight: 12, notesPrefix: 'Dinner delivery at home' },
    { merchant: 'Zomato Online Order', minAmt: 310, maxAmt: 850, categoryId: 'cat_food_dining', subcategoryId: 'sub_delivery', paymentMethod: 'upi', tags: ['food-delivery', 'lunch'], weight: 10, notesPrefix: 'Office lunch order' },
    { merchant: 'Blue Tokai Coffee Roasters', minAmt: 220, maxAmt: 540, categoryId: 'cat_food_dining', subcategoryId: 'sub_cafes', paymentMethod: 'upi', tags: ['coffee', 'work'], weight: 9, notesPrefix: 'Cold brew and croissant' },
    { merchant: 'Third Wave Coffee', minAmt: 240, maxAmt: 580, categoryId: 'cat_food_dining', subcategoryId: 'sub_cafes', paymentMethod: 'upi', tags: ['coffee', 'meeting'], weight: 8, notesPrefix: 'Iced latte & almond cookie' },
    { merchant: 'Starbucks Coffee', minAmt: 350, maxAmt: 720, categoryId: 'cat_food_dining', subcategoryId: 'sub_cafes', paymentMethod: 'card', tags: ['coffee', 'casual'], weight: 4, notesPrefix: 'Caramel macchiato & muffin' },
    { merchant: 'Chai Point', minAmt: 60, maxAmt: 180, categoryId: 'cat_food_dining', subcategoryId: 'sub_cafes', paymentMethod: 'upi', tags: ['tea', 'snack'], weight: 12, notesPrefix: 'Ginger chai & samosa' },
    { merchant: 'Social Pub & Dining', minAmt: 1600, maxAmt: 3800, categoryId: 'cat_food_dining', subcategoryId: 'sub_restaurant', paymentMethod: 'card', tags: ['weekend', 'dining-out'], weight: 3, notesPrefix: 'Weekend dinner with friends' },
    { merchant: 'Toit Brewpub', minAmt: 2100, maxAmt: 4500, categoryId: 'cat_food_dining', subcategoryId: 'sub_restaurant', paymentMethod: 'card', tags: ['weekend', 'dining-out'], weight: 2, notesPrefix: 'Dinner and craft beverages' },
    { merchant: 'Smoke House Deli', minAmt: 1400, maxAmt: 3200, categoryId: 'cat_food_dining', subcategoryId: 'sub_restaurant', paymentMethod: 'card', tags: ['dining-out'], weight: 2, notesPrefix: 'Sunday brunch' },

    // Transport & Commute (high frequency)
    { merchant: 'Uber Ride', minAmt: 160, maxAmt: 520, categoryId: 'cat_transport', subcategoryId: 'sub_cabs', paymentMethod: 'upi', tags: ['commute', 'cab'], weight: 15, notesPrefix: 'Cab ride to tech park' },
    { merchant: 'Ola Cabs', minAmt: 140, maxAmt: 480, categoryId: 'cat_transport', subcategoryId: 'sub_cabs', paymentMethod: 'upi', tags: ['commute', 'cab'], weight: 7, notesPrefix: 'Auto ride back home' },
    { merchant: 'Metro Transit Smart Card', minAmt: 500, maxAmt: 500, categoryId: 'cat_transport', subcategoryId: 'sub_transit', paymentMethod: 'upi', tags: ['commute', 'metro'], weight: 4, notesPrefix: 'Smart card recharge' },
    { merchant: 'Indian Oil Petrol Pump', minAmt: 2000, maxAmt: 3500, categoryId: 'cat_transport', subcategoryId: 'sub_fuel', paymentMethod: 'card', tags: ['fuel', 'car'], weight: 4, notesPrefix: 'Full tank petrol fuel' },
    { merchant: 'Shell Fuel Station', minAmt: 2200, maxAmt: 3800, categoryId: 'cat_transport', subcategoryId: 'sub_fuel', paymentMethod: 'card', tags: ['fuel', 'v-power'], weight: 3, notesPrefix: 'V-Power petrol & wiper wash' },

    // Shopping (medium frequency)
    { merchant: 'Amazon India', minAmt: 450, maxAmt: 4800, categoryId: 'cat_shopping', subcategoryId: 'sub_electronics', paymentMethod: 'card', tags: ['online-shopping'], weight: 6, notesPrefix: 'Gadgets & desk accessories' },
    { merchant: 'Flipkart Online', minAmt: 520, maxAmt: 3100, categoryId: 'cat_shopping', subcategoryId: 'sub_home_decor', paymentMethod: 'card', tags: ['online-shopping', 'home'], weight: 4, notesPrefix: 'Kitchen storage containers' },
    { merchant: 'Myntra Fashion', minAmt: 1200, maxAmt: 4500, categoryId: 'cat_shopping', subcategoryId: 'sub_clothing', paymentMethod: 'card', tags: ['clothing', 'apparel'], weight: 3, notesPrefix: 'Formal shirts & casual polo' },
    { merchant: 'Uniqlo Store', minAmt: 1990, maxAmt: 5990, categoryId: 'cat_shopping', subcategoryId: 'sub_clothing', paymentMethod: 'card', tags: ['apparel', 'in-store'], weight: 2, notesPrefix: 'AIRism tees & chinos' },
    { merchant: 'Zara India', minAmt: 2500, maxAmt: 7990, categoryId: 'cat_shopping', subcategoryId: 'sub_clothing', paymentMethod: 'card', tags: ['fashion', 'apparel'], weight: 2, notesPrefix: 'Weekend jacket & trousers' },

    // Health (low frequency)
    { merchant: 'Apollo Pharmacy', minAmt: 180, maxAmt: 950, categoryId: 'cat_health', subcategoryId: 'sub_pharmacy', paymentMethod: 'upi', tags: ['health', 'medicines'], weight: 4, notesPrefix: 'Monthly multivitamins and basic first-aid' },
    { merchant: 'Tata 1mg Online', minAmt: 450, maxAmt: 1650, categoryId: 'cat_health', subcategoryId: 'sub_pharmacy', paymentMethod: 'card', tags: ['health', 'pharmacy'], weight: 3, notesPrefix: 'Prescription refills & protein' },
    { merchant: 'Practo Health Consult', minAmt: 750, maxAmt: 1500, categoryId: 'cat_health', subcategoryId: 'sub_consultation', paymentMethod: 'upi', tags: ['doctor', 'health'], weight: 1, notesPrefix: 'Routine dental / eye checkup' },

    // Personal Care & Entertainment
    { merchant: 'Enrich Salon & Grooming', minAmt: 600, maxAmt: 1800, categoryId: 'cat_personal_care', subcategoryId: 'sub_salon', paymentMethod: 'upi', tags: ['grooming', 'salon'], weight: 2, notesPrefix: 'Haircut and grooming' },
    { merchant: 'BookMyShow Movies', minAmt: 500, maxAmt: 1400, categoryId: 'cat_entertainment', subcategoryId: 'sub_movies', paymentMethod: 'card', tags: ['movies', 'weekend'], weight: 3, notesPrefix: 'IMAX movie tickets & popcorn' },
    { merchant: 'Steam Games', minAmt: 799, maxAmt: 2499, categoryId: 'cat_entertainment', subcategoryId: 'sub_gaming', paymentMethod: 'card', tags: ['gaming'], weight: 1, notesPrefix: 'Weekend indie game release' },
  ];

  // Build weighted array for fast random selection
  const weightedPool: Array<typeof dailyTemplates[0]> = [];
  dailyTemplates.forEach((t) => {
    for (let w = 0; w < t.weight; w++) {
      weightedPool.push(t);
    }
  });

  // Iterate over each day from May 1 to Nov 15
  for (let d = 0; d < totalDays; d++) {
    const currentDate = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}-${mm}-${dd}`;
    const dayOfWeek = currentDate.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Number of transactions on this day: 3 to 5 on weekdays, 4 to 6 on weekends
    const dailyTxCount = isWeekend ? rng.range(3, 6) : rng.range(2, 5);

    for (let i = 0; i < dailyTxCount; i++) {
      const template = rng.pick(weightedPool);
      const amount = rng.range(template.minAmt, template.maxAmt);

      // Distribute hours realistically throughout the day (8 AM to 11 PM)
      const hour = rng.range(8, 22);
      const minute = rng.range(0, 59);
      const second = rng.range(0, 59);
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`;
      const txTimestamp = `${datePrefix}T${timeStr}`;

      const source: TransactionSource = rng.next() > 0.85 ? 'quick_add' : 'manual';
      const paymentMethod: PaymentMethod = template.paymentMethod;

      transactions.push({
        id: `tx_${++txCounter}`,
        amount,
        currency: 'INR',
        date: txTimestamp,
        merchant: template.merchant,
        categoryId: template.categoryId,
        subcategoryId: template.subcategoryId,
        paymentMethod,
        notes: `${template.notesPrefix} (${datePrefix})`,
        tags: [...template.tags, isWeekend ? 'weekend' : 'weekday'],
        recurringId: null,
        source,
        confidence: 0.95,
        createdAt: txTimestamp,
        updatedAt: txTimestamp,
      });
    }
  }

  // Add 2 special vacation trip expenses in July & September
  transactions.push(
    {
      id: `tx_${++txCounter}`,
      amount: 14850,
      currency: 'INR',
      date: '2026-07-16T14:20:00.000Z',
      merchant: 'MakeMyTrip Flight to Goa',
      categoryId: 'cat_travel',
      subcategoryId: 'sub_flights',
      paymentMethod: 'card',
      notes: 'Monsoon Goa trip roundtrip flight tickets',
      tags: ['travel', 'vacation', 'trip'],
      recurringId: null,
      source: 'manual',
      confidence: 1.0,
      createdAt: '2026-07-16T14:20:00.000Z',
      updatedAt: '2026-07-16T14:20:00.000Z',
    },
    {
      id: `tx_${++txCounter}`,
      amount: 18500,
      currency: 'INR',
      date: '2026-07-18T11:00:00.000Z',
      merchant: 'Taj Fort Aguada Goa Resort',
      categoryId: 'cat_travel',
      subcategoryId: 'sub_hotels',
      paymentMethod: 'card',
      notes: 'Weekend resort stay in North Goa',
      tags: ['travel', 'hotel', 'luxury'],
      recurringId: null,
      source: 'manual',
      confidence: 1.0,
      createdAt: '2026-07-18T11:00:00.000Z',
      updatedAt: '2026-07-18T11:00:00.000Z',
    },
    {
      id: `tx_${++txCounter}`,
      amount: 12400,
      currency: 'INR',
      date: '2026-09-25T16:45:00.000Z',
      merchant: 'Coorg Heritage Plantation Resort',
      categoryId: 'cat_travel',
      subcategoryId: 'sub_hotels',
      paymentMethod: 'card',
      notes: 'Coffee plantation bungalow stay',
      tags: ['travel', 'weekend-getaway'],
      recurringId: null,
      source: 'manual',
      confidence: 1.0,
      createdAt: '2026-09-25T16:45:00.000Z',
      updatedAt: '2026-09-25T16:45:00.000Z',
    }
  );

  return {
    transactions,
    budgets,
    rules,
    recurring,
    memory,
  };
}

/**
 * Seed repository with default categories, ~800 transactions, budgets, rules, recurring, and memory
 */
export async function seedDatabase(repo: Repository, force = false): Promise<SeedResult> {
  const isEmpty = await repo.isDatabaseEmpty();
  if (!isEmpty && !force) {
    const existingCats = await repo.getCategories();
    const existingTxs = await repo.countTransactions();
    const existingBudgets = await repo.getBudgets();
    const existingRules = await repo.getRules();
    const existingRec = await repo.getRecurring();
    const existingMem = await repo.getMemoryItems();

    return {
      categoriesCount: existingCats.length,
      transactionsCount: existingTxs,
      budgetsCount: existingBudgets.length,
      rulesCount: existingRules.length,
      recurringCount: existingRec.length,
      memoryCount: existingMem.length,
    };
  }

  if (force) {
    await repo.clearAll();
  }

  // 1. Seed Categories
  await repo.bulkCreateCategories(DEFAULT_CATEGORIES);

  // 2. Generate Seed Data
  const seed = generateSeedData();

  // 3. Save transactions, budgets, rules, recurring, memory
  await repo.bulkCreateTransactions(seed.transactions);

  for (const b of seed.budgets) {
    await repo.setBudget(b);
  }

  for (const r of seed.rules) {
    await repo.createRule(r);
  }

  for (const rec of seed.recurring) {
    await repo.createRecurring(rec);
  }

  for (const m of seed.memory) {
    await repo.createMemoryItem(m);
  }

  // Mark app settings
  await repo.setSetting('hasCompletedSeed', true);
  await repo.setSetting('seedTimestamp', new Date().toISOString());

  return {
    categoriesCount: DEFAULT_CATEGORIES.length,
    transactionsCount: seed.transactions.length,
    budgetsCount: seed.budgets.length,
    rulesCount: seed.rules.length,
    recurringCount: seed.recurring.length,
    memoryCount: seed.memory.length,
  };
}

/**
 * Hosted website first run: a real vault starts empty — only the category
 * taxonomy the app needs to file transactions. Demo data stays opt-in
 * (Settings → load demo data).
 */
export async function seedCategoriesOnly(repo: Repository): Promise<boolean> {
  const existing = await repo.getCategories();
  if (existing.length > 0) return false;
  await repo.bulkCreateCategories(DEFAULT_CATEGORIES);
  await repo.setSetting('hasCompletedSeed', true);
  return true;
}

/**
 * Removes records generated by seedDatabase() from a vault, leaving anything
 * the user created. Demo records use fixed IDs (tx_N, rule_N, mem_N, rec_N);
 * user records get random UUIDs. Budgets share the budget_YYYY-MM pattern with
 * user budgets, so only budgets identical to the generated demo values are removed.
 */
export async function purgeDemoData(repo: Repository): Promise<number> {
  const seededAt = await repo.getSetting<string>('seedTimestamp');
  if (!seededAt) return 0;
  let removed = 0;
  // A budget is demo only if it is exactly what the seed generated for that month.
  const seedBudgets = new Map(generateSeedData().budgets.map((b) => [b.id, b]));
  const sameAsSeed = (b: Budget) => {
    const s0 = seedBudgets.get(b.id);
    return (
      !!s0 &&
      s0.totalLimit === b.totalLimit &&
      s0.rollover === b.rollover &&
      JSON.stringify(s0.categoryLimits) === JSON.stringify(b.categoryLimits)
    );
  };

  const demoTx = (await repo.getAllTransactions()).filter(
    (t) => /^tx_\d+$/.test(t.id) || (t.recurringId != null && /^rec_\d+$/.test(t.recurringId))
  );
  if (demoTx.length) {
    await repo.bulkDeleteTransactions(demoTx.map((t) => t.id));
    removed += demoTx.length;
  }
  for (const r of await repo.getRules()) if (/^rule_\d+$/.test(r.id)) (await repo.deleteRule(r.id), removed++);
  for (const r of await repo.getRecurring()) if (/^rec_\d+$/.test(r.id)) (await repo.deleteRecurring(r.id), removed++);
  for (const m of await repo.getMemoryItems()) if (/^mem_\d+$/.test(m.id)) (await repo.deleteMemoryItem(m.id), removed++);
  for (const b of await repo.getBudgets()) {
    if (sameAsSeed(b)) {
      await repo.deleteBudget(b.id);
      removed++;
    }
  }
  await repo.setSetting('seedTimestamp', '');
  return removed;
}
