import type { Repository } from '@/data/repository';
import type { MemoryItem } from '@/types';

const STOP_WORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'doing',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'just',
  'me',
  'more',
  'most',
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  's',
  'same',
  'she',
  'should',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
  'yours',
  'yourself',
]);

/**
 * Tokenizes a string into lowercased meaningful search tokens
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Computes relevance score between a query and an approved memory item
 */
export function scoreMemoryItem(query: string, memory: MemoryItem): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return 0;
  }

  const memoryTokens = tokenize(memory.text);
  const memoryTextLower = memory.text.toLowerCase();
  const queryLower = query.toLowerCase();

  let score = 0;

  // 1. Exact or partial substring match gives high weight
  if (memoryTextLower.includes(queryLower)) {
    score += 5.0;
  }

  // 2. Token overlap score
  const memoryTokenSet = new Set(memoryTokens);
  let matches = 0;
  for (const token of new Set(queryTokens)) {
    if (memoryTokenSet.has(token)) {
      matches += 1;
    } else {
      // Substring match inside token (e.g. "laptop" in "laptops")
      for (const mToken of memoryTokens) {
        if (Math.min(token.length, mToken.length) >= 4 && (mToken.startsWith(token) || token.startsWith(mToken))) {
          matches += 0.5;
          break;
        }
      }
    }
  }

  // Normalization
  score += matches * 1.5;

  // 3. Kind-specific relevance bonus
  const kindBonusWords: Record<string, string[]> = {
    goal: ['goal', 'target', 'save', 'saving', 'future', 'march', 'buy', 'purchase', 'afford'],
    income: ['income', 'salary', 'earnings', 'revenue', 'inflow', 'pay', 'ctc'],
    preference: ['prefer', 'preference', 'budget', 'rule', 'always', 'habit', 'like'],
    recurring_fact: ['recurring', 'monthly', 'commitment', 'rent', 'subscription', 'emi'],
  };

  const relevantWords = kindBonusWords[memory.kind] || [];
  for (const word of relevantWords) {
    if (queryTokens.includes(word)) {
      score += 2.0;
      break;
    }
  }

  return score;
}

/**
 * Retrieves the top-k relevant approved memories from the repository
 */
export async function retrieveRelevantMemories(
  query: string,
  repo: Repository,
  k = 5
): Promise<MemoryItem[]> {
  const approvedMemories = await repo.getMemoryItems(true);
  if (approvedMemories.length === 0) {
    return [];
  }

  const scored = approvedMemories.filter((item) => item.approvedAt)
    .map((item) => ({ item, score: scoreMemoryItem(query, item) }))
    .filter(({ score }) => score > 0);

  // Sort descending by score, tiebreak by createdAt desc
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime();
  });

  return scored.slice(0, k).map((s) => s.item);
}

/**
 * Formats memories into a concise text block for the system prompt
 */
export function formatMemoriesForPrompt(memories: MemoryItem[]): string {
  if (memories.length === 0) {
    return 'None recorded yet.';
  }

  return memories
    .map(
      (m, idx) =>
        `${idx + 1}. [${m.kind.toUpperCase()}] ${m.text}`
    )
    .join('\n');
}
