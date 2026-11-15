export interface ClassificationResult {
  categoryId: string;
  subcategoryId?: string | null;
  confidence: number; // 0.0 to 1.0
  source: 'rule' | 'dictionary' | 'ai' | 'fallback';
  ruleId?: string;
  reason?: string;
}

export interface CategorizeOptions {
  useAi?: boolean;
  apiKey?: string;
  model?: string;
}

export interface DictionaryEntry {
  patterns: string[];
  categoryId: string;
  subcategoryId?: string;
}
