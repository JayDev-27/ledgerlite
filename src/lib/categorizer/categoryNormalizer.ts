import { DEFAULT_CATEGORIES, CATEGORY_MAP } from '@/data/categories';

export interface NormalizedCategoryResult {
  categoryId: string;
  subcategoryId?: string | null;
}

/**
 * Robust normalizer for AI classification and quick-add outputs.
 * Maps variations, aliases, and lowercase strings to valid category IDs from DEFAULT_CATEGORIES.
 */
export function normalizeCategoryId(
  rawId?: string | null,
  rawSubId?: string | null
): NormalizedCategoryResult {
  if (!rawId || !rawId.trim()) {
    return { categoryId: 'cat_misc', subcategoryId: null };
  }

  const trimmed = rawId.trim();

  // 1. Direct ID match
  if (CATEGORY_MAP.has(trimmed)) {
    const cat = CATEGORY_MAP.get(trimmed)!;
    if (cat.parentId) {
      return { categoryId: cat.parentId, subcategoryId: cat.id };
    }
    return {
      categoryId: cat.id,
      subcategoryId: resolveSubcategoryId(cat.id, rawSubId),
    };
  }

  // 2. Direct with 'cat_' prefix
  const withCatPrefix = `cat_${trimmed}`;
  if (CATEGORY_MAP.has(withCatPrefix)) {
    return {
      categoryId: withCatPrefix,
      subcategoryId: resolveSubcategoryId(withCatPrefix, rawSubId),
    };
  }

  // 3. Direct with 'sub_' prefix
  const withSubPrefix = `sub_${trimmed}`;
  if (CATEGORY_MAP.has(withSubPrefix)) {
    const sub = CATEGORY_MAP.get(withSubPrefix)!;
    return { categoryId: sub.parentId || 'cat_misc', subcategoryId: sub.id };
  }

  // 4. Normalized alphanumeric match against known category names and IDs
  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const cat of DEFAULT_CATEGORIES) {
    const catNameNorm = cat.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const catIdNorm = cat.id.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (catNameNorm === normalized || catIdNorm === normalized) {
      if (cat.parentId) {
        return { categoryId: cat.parentId, subcategoryId: cat.id };
      }
      return {
        categoryId: cat.id,
        subcategoryId: resolveSubcategoryId(cat.id, rawSubId),
      };
    }
  }

  // 5. Semantic substring match
  if (normalized.includes('food') || normalized.includes('dining') || normalized.includes('restaurant') || normalized.includes('cafe')) {
    return { categoryId: 'cat_food_dining', subcategoryId: resolveSubcategoryId('cat_food_dining', rawSubId) };
  }
  if (normalized.includes('grocer') || normalized.includes('supermarket') || normalized.includes('staple')) {
    return { categoryId: 'cat_groceries', subcategoryId: resolveSubcategoryId('cat_groceries', rawSubId) };
  }
  if (normalized.includes('transport') || normalized.includes('transit') || normalized.includes('cab') || normalized.includes('fuel')) {
    return { categoryId: 'cat_transport', subcategoryId: resolveSubcategoryId('cat_transport', rawSubId) };
  }
  if (normalized.includes('utilit') || normalized.includes('bill') || normalized.includes('electricity') || normalized.includes('broadband')) {
    return { categoryId: 'cat_utilities', subcategoryId: resolveSubcategoryId('cat_utilities', rawSubId) };
  }
  if (normalized.includes('health') || normalized.includes('medic') || normalized.includes('pharma') || normalized.includes('doctor')) {
    return { categoryId: 'cat_health', subcategoryId: resolveSubcategoryId('cat_health', rawSubId) };
  }
  if (normalized.includes('shop') || normalized.includes('cloth') || normalized.includes('apparel') || normalized.includes('gadget')) {
    return { categoryId: 'cat_shopping', subcategoryId: resolveSubcategoryId('cat_shopping', rawSubId) };
  }
  if (normalized.includes('entertain') || normalized.includes('movie') || normalized.includes('cinema') || normalized.includes('game')) {
    return { categoryId: 'cat_entertainment', subcategoryId: resolveSubcategoryId('cat_entertainment', rawSubId) };
  }
  if (normalized.includes('subscript') || normalized.includes('stream') || normalized.includes('software')) {
    return { categoryId: 'cat_subscriptions', subcategoryId: resolveSubcategoryId('cat_subscriptions', rawSubId) };
  }
  if (normalized.includes('travel') || normalized.includes('flight') || normalized.includes('hotel')) {
    return { categoryId: 'cat_travel', subcategoryId: resolveSubcategoryId('cat_travel', rawSubId) };
  }
  if (normalized.includes('invest') || normalized.includes('stock') || normalized.includes('mutual') || normalized.includes('saving')) {
    return { categoryId: 'cat_investments', subcategoryId: resolveSubcategoryId('cat_investments', rawSubId) };
  }
  if (normalized.includes('loan') || normalized.includes('emi')) {
    return { categoryId: 'cat_emi_loans', subcategoryId: resolveSubcategoryId('cat_emi_loans', rawSubId) };
  }
  if (normalized.includes('insur')) {
    return { categoryId: 'cat_insurance', subcategoryId: resolveSubcategoryId('cat_insurance', rawSubId) };
  }
  if (normalized.includes('educat') || normalized.includes('course') || normalized.includes('school')) {
    return { categoryId: 'cat_education', subcategoryId: resolveSubcategoryId('cat_education', rawSubId) };
  }
  if (normalized.includes('tax') || normalized.includes('fee')) {
    return { categoryId: 'cat_fees_taxes', subcategoryId: resolveSubcategoryId('cat_fees_taxes', rawSubId) };
  }

  // Fallback
  return { categoryId: 'cat_misc', subcategoryId: null };
}

function resolveSubcategoryId(parentId: string, rawSubId?: string | null): string | null {
  if (!rawSubId || !rawSubId.trim()) return null;
  const subTrimmed = rawSubId.trim();

  if (CATEGORY_MAP.has(subTrimmed)) {
    const sub = CATEGORY_MAP.get(subTrimmed)!;
    if (sub.parentId === parentId) return sub.id;
  }

  const withSub = `sub_${subTrimmed}`;
  if (CATEGORY_MAP.has(withSub)) {
    const sub = CATEGORY_MAP.get(withSub)!;
    if (sub.parentId === parentId) return sub.id;
  }

  const normalized = subTrimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  const childSubcategories = DEFAULT_CATEGORIES.filter((c) => c.parentId === parentId);
  for (const child of childSubcategories) {
    const nameNorm = child.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const idNorm = child.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (nameNorm === normalized || idNorm === normalized) {
      return child.id;
    }
  }

  return null;
}
