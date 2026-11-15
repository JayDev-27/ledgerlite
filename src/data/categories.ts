import { Category } from '@/types';

export const DEFAULT_CATEGORIES: Category[] = [
  // 1. Housing (Need)
  { id: 'cat_housing', name: 'Housing', parentId: null, type: 'need', color: '#16587B', icon: 'Home', order: 1 },
  { id: 'sub_rent', name: 'House Rent', parentId: 'cat_housing', type: 'need', color: '#16587B', icon: 'Key', order: 1 },
  { id: 'sub_maintenance', name: 'Society & Maintenance', parentId: 'cat_housing', type: 'need', color: '#1E6B94', icon: 'Building', order: 2 },
  { id: 'sub_home_repair', name: 'Repairs & Upkeep', parentId: 'cat_housing', type: 'need', color: '#2C80AD', icon: 'Wrench', order: 3 },

  // 2. Food & Dining (Want)
  { id: 'cat_food_dining', name: 'Food & Dining', parentId: null, type: 'want', color: '#C05621', icon: 'Utensils', order: 2 },
  { id: 'sub_restaurant', name: 'Dining Out', parentId: 'cat_food_dining', type: 'want', color: '#C05621', icon: 'UtensilsCrossed', order: 1 },
  { id: 'sub_delivery', name: 'Food Delivery', parentId: 'cat_food_dining', type: 'want', color: '#DD6B20', icon: 'Bike', order: 2 },
  { id: 'sub_cafes', name: 'Cafes & Coffee', parentId: 'cat_food_dining', type: 'want', color: '#ED8936', icon: 'Coffee', order: 3 },

  // 3. Groceries (Need)
  { id: 'cat_groceries', name: 'Groceries', parentId: null, type: 'need', color: '#276749', icon: 'ShoppingCart', order: 3 },
  { id: 'sub_supermarket', name: 'Supermarket & Staples', parentId: 'cat_groceries', type: 'need', color: '#276749', icon: 'ShoppingBag', order: 1 },
  { id: 'sub_fresh_produce', name: 'Fresh Fruits & Vegetables', parentId: 'cat_groceries', type: 'need', color: '#2F855A', icon: 'Apple', order: 2 },
  { id: 'sub_dairy', name: 'Dairy & Bakery', parentId: 'cat_groceries', type: 'need', color: '#38A169', icon: 'Milk', order: 3 },

  // 4. Transport (Need)
  { id: 'cat_transport', name: 'Transport', parentId: null, type: 'need', color: '#2B6CB0', icon: 'Car', order: 4 },
  { id: 'sub_fuel', name: 'Fuel', parentId: 'cat_transport', type: 'need', color: '#2B6CB0', icon: 'Fuel', order: 1 },
  { id: 'sub_cabs', name: 'Cabs & Auto', parentId: 'cat_transport', type: 'need', color: '#3182CE', icon: 'Navigation', order: 2 },
  { id: 'sub_transit', name: 'Metro & Public Transit', parentId: 'cat_transport', type: 'need', color: '#4299E1', icon: 'Train', order: 3 },
  { id: 'sub_vehicle_service', name: 'Service & Parking', parentId: 'cat_transport', type: 'need', color: '#63B3ED', icon: 'Wrench', order: 4 },

  // 5. Utilities & Bills (Need)
  { id: 'cat_utilities', name: 'Utilities & Bills', parentId: null, type: 'need', color: '#84B3CE', icon: 'Zap', order: 5 },
  { id: 'sub_electricity', name: 'Electricity', parentId: 'cat_utilities', type: 'need', color: '#5C98BC', icon: 'Zap', order: 1 },
  { id: 'sub_water_gas', name: 'Water & Gas', parentId: 'cat_utilities', type: 'need', color: '#72A9CA', icon: 'Flame', order: 2 },
  { id: 'sub_broadband', name: 'Broadband Internet', parentId: 'cat_utilities', type: 'need', color: '#84B3CE', icon: 'Wifi', order: 3 },
  { id: 'sub_mobile', name: 'Mobile Recharge', parentId: 'cat_utilities', type: 'need', color: '#9FC7DE', icon: 'Smartphone', order: 4 },

  // 6. Health (Need)
  { id: 'cat_health', name: 'Health', parentId: null, type: 'need', color: '#9B2C2C', icon: 'Activity', order: 6 },
  { id: 'sub_consultation', name: 'Doctor & Clinics', parentId: 'cat_health', type: 'need', color: '#9B2C2C', icon: 'Stethoscope', order: 1 },
  { id: 'sub_pharmacy', name: 'Pharmacy & Medicines', parentId: 'cat_health', type: 'need', color: '#C53030', icon: 'Pill', order: 2 },
  { id: 'sub_diagnostics', name: 'Diagnostics & Labs', parentId: 'cat_health', type: 'need', color: '#E53E3E', icon: 'FileText', order: 3 },

  // 7. Education (Need)
  { id: 'cat_education', name: 'Education', parentId: null, type: 'need', color: '#553C9A', icon: 'GraduationCap', order: 7 },
  { id: 'sub_courses', name: 'Courses & Certifications', parentId: 'cat_education', type: 'need', color: '#553C9A', icon: 'BookOpen', order: 1 },
  { id: 'sub_books', name: 'Books & Supplies', parentId: 'cat_education', type: 'need', color: '#6B46C1', icon: 'BookMarked', order: 2 },

  // 8. Shopping (Want)
  { id: 'cat_shopping', name: 'Shopping', parentId: null, type: 'want', color: '#D69E2E', icon: 'ShoppingBag', order: 8 },
  { id: 'sub_clothing', name: 'Clothing & Footwear', parentId: 'cat_shopping', type: 'want', color: '#D69E2E', icon: 'Shirt', order: 1 },
  { id: 'sub_electronics', name: 'Electronics & Gadgets', parentId: 'cat_shopping', type: 'want', color: '#ECC94B', icon: 'Laptop', order: 2 },
  { id: 'sub_home_decor', name: 'Home & Kitchen', parentId: 'cat_shopping', type: 'want', color: '#B7791F', icon: 'Armchair', order: 3 },

  // 9. Entertainment (Want)
  { id: 'cat_entertainment', name: 'Entertainment', parentId: null, type: 'want', color: '#805AD5', icon: 'Film', order: 9 },
  { id: 'sub_movies', name: 'Movies & Cinema', parentId: 'cat_entertainment', type: 'want', color: '#805AD5', icon: 'Ticket', order: 1 },
  { id: 'sub_gaming', name: 'Gaming', parentId: 'cat_entertainment', type: 'want', color: '#9F7AEA', icon: 'Gamepad2', order: 2 },
  { id: 'sub_events', name: 'Events & Concerts', parentId: 'cat_entertainment', type: 'want', color: '#B794F4', icon: 'PartyPopper', order: 3 },

  // 10. Subscriptions (Want)
  { id: 'cat_subscriptions', name: 'Subscriptions', parentId: null, type: 'want', color: '#4A5568', icon: 'Tv', order: 10 },
  { id: 'sub_streaming_video', name: 'Video Streaming', parentId: 'cat_subscriptions', type: 'want', color: '#4A5568', icon: 'PlaySquare', order: 1 },
  { id: 'sub_streaming_audio', name: 'Music Streaming', parentId: 'cat_subscriptions', type: 'want', color: '#718096', icon: 'Headphones', order: 2 },
  { id: 'sub_software', name: 'Software & Cloud', parentId: 'cat_subscriptions', type: 'want', color: '#A0AEC0', icon: 'Cloud', order: 3 },

  // 11. Travel (Want)
  { id: 'cat_travel', name: 'Travel', parentId: null, type: 'want', color: '#319795', icon: 'Plane', order: 11 },
  { id: 'sub_flights', name: 'Flights & Rail', parentId: 'cat_travel', type: 'want', color: '#319795', icon: 'PlaneTakeoff', order: 1 },
  { id: 'sub_hotels', name: 'Hotels & Lodging', parentId: 'cat_travel', type: 'want', color: '#38B2AC', icon: 'Hotel', order: 2 },
  { id: 'sub_sightseeing', name: 'Sightseeing & Trips', parentId: 'cat_travel', type: 'want', color: '#4FD1C5', icon: 'Compass', order: 3 },

  // 12. Personal Care (Want)
  { id: 'cat_personal_care', name: 'Personal Care', parentId: null, type: 'want', color: '#B83280', icon: 'Sparkles', order: 12 },
  { id: 'sub_salon', name: 'Salon & Grooming', parentId: 'cat_personal_care', type: 'want', color: '#B83280', icon: 'Scissors', order: 1 },
  { id: 'sub_fitness', name: 'Fitness & Gym', parentId: 'cat_personal_care', type: 'want', color: '#D53F8C', icon: 'Dumbbell', order: 2 },
  { id: 'sub_cosmetics', name: 'Skincare & Cosmetics', parentId: 'cat_personal_care', type: 'want', color: '#ED64A6', icon: 'Sparkle', order: 3 },

  // 13. Gifts & Donations (Want)
  { id: 'cat_gifts_donations', name: 'Gifts & Donations', parentId: null, type: 'want', color: '#DD6B20', icon: 'Gift', order: 13 },
  { id: 'sub_gifts', name: 'Gifts', parentId: 'cat_gifts_donations', type: 'want', color: '#DD6B20', icon: 'Gift', order: 1 },
  { id: 'sub_charity', name: 'Charity & Donations', parentId: 'cat_gifts_donations', type: 'want', color: '#ED8936', icon: 'Heart', order: 2 },

  // 14. Insurance (Need)
  { id: 'cat_insurance', name: 'Insurance', parentId: null, type: 'need', color: '#2C5282', icon: 'ShieldCheck', order: 14 },
  { id: 'sub_health_insurance', name: 'Health Insurance', parentId: 'cat_insurance', type: 'need', color: '#2C5282', icon: 'Shield', order: 1 },
  { id: 'sub_life_insurance', name: 'Term & Life Insurance', parentId: 'cat_insurance', type: 'need', color: '#2B6CB0', icon: 'ShieldAlert', order: 2 },
  { id: 'sub_vehicle_insurance', name: 'Vehicle Insurance', parentId: 'cat_insurance', type: 'need', color: '#3182CE', icon: 'Car', order: 3 },

  // 15. EMI & Loans (Need)
  { id: 'cat_emi_loans', name: 'EMI & Loans', parentId: null, type: 'need', color: '#742A2A', icon: 'CreditCard', order: 15 },
  { id: 'sub_home_loan', name: 'Home Loan EMI', parentId: 'cat_emi_loans', type: 'need', color: '#742A2A', icon: 'Home', order: 1 },
  { id: 'sub_auto_loan', name: 'Auto Loan EMI', parentId: 'cat_emi_loans', type: 'need', color: '#9B2C2C', icon: 'Car', order: 2 },
  { id: 'sub_personal_loan', name: 'Personal EMI', parentId: 'cat_emi_loans', type: 'need', color: '#C53030', icon: 'Receipt', order: 3 },

  // 16. Investments & Savings (Savings)
  { id: 'cat_investments', name: 'Investments & Savings', parentId: null, type: 'savings', color: '#1B6B4C', icon: 'TrendingUp', order: 16 },
  { id: 'sub_mutual_funds', name: 'Mutual Funds & SIP', parentId: 'cat_investments', type: 'savings', color: '#1B6B4C', icon: 'TrendingUp', order: 1 },
  { id: 'sub_stocks', name: 'Direct Equity & Stocks', parentId: 'cat_investments', type: 'savings', color: '#228B5E', icon: 'BarChart2', order: 2 },
  { id: 'sub_fixed_deposits', name: 'PPF, EPF & Fixed Deposits', parentId: 'cat_investments', type: 'savings', color: '#2FA873', icon: 'PiggyBank', order: 3 },
  { id: 'sub_gold', name: 'Sovereign Gold & Bullion', parentId: 'cat_investments', type: 'savings', color: '#3DC488', icon: 'Coins', order: 4 },

  // 17. Fees & Taxes (Need)
  { id: 'cat_fees_taxes', name: 'Fees & Taxes', parentId: null, type: 'need', color: '#4A5568', icon: 'Receipt', order: 17 },
  { id: 'sub_bank_charges', name: 'Bank & Card Charges', parentId: 'cat_fees_taxes', type: 'need', color: '#4A5568', icon: 'CreditCard', order: 1 },
  { id: 'sub_taxes', name: 'Income & Advance Tax', parentId: 'cat_fees_taxes', type: 'need', color: '#718096', icon: 'FileText', order: 2 },

  // 18. Miscellaneous (Want)
  { id: 'cat_misc', name: 'Miscellaneous', parentId: null, type: 'want', color: '#718096', icon: 'HelpCircle', order: 18 },
  { id: 'sub_general', name: 'General', parentId: 'cat_misc', type: 'want', color: '#718096', icon: 'MoreHorizontal', order: 1 },
];

export const CATEGORY_MAP = new Map<string, Category>(
  DEFAULT_CATEGORIES.map((c) => [c.id, c])
);
