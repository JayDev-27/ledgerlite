import React, { useState, useEffect } from 'react';
import { X, Lightbulb, Plus, Trash2, Check } from 'lucide-react';
import type { Category, Rule, RuleMatcher, RuleMatcherOperator } from '@/types';
import { repository } from '@/data/repository';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onRulesChanged?: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({
  isOpen,
  onClose,
  categories,
  onRulesChanged,
}) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [matcherField, setMatcherField] = useState<'merchant' | 'notes'>('merchant');
  const [matcherOperator, setMatcherOperator] = useState<RuleMatcherOperator>('exact');
  const [matcherValue, setMatcherValue] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('cat_food_dining');
  const [selectedSubcatId, setSelectedSubcatId] = useState('');
  const modalRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose });

  const loadRules = async () => {
    try {
      setLoading(true);
      const all = await repository.getRules();
      setRules(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRules();
      setIsAdding(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parentCategories = categories.filter((c) => !c.parentId);
  const subcategories = categories.filter((c) => c.parentId === selectedCatId);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matcherValue.trim()) return;

    await repository.createRule({
      matcher: {
        field: matcherField,
        operator: matcherOperator,
        value: matcherValue.trim(),
      },
      categoryId: selectedCatId,
      subcategoryId: selectedSubcatId || null,
    });

    setIsAdding(false);
    setMatcherValue('');
    await loadRules();
    onRulesChanged?.();
  };

  const handleDeleteRule = async (id: string) => {
    if (window.confirm('Delete this learned rule?')) {
      await repository.deleteRule(id);
      await loadRules();
      onRulesChanged?.();
    }
  };

  const formatMatcher = (matcher: RuleMatcher | string) => {
    if (typeof matcher === 'string') {
      return `merchant contains "${matcher}"`;
    }
    return `${matcher.field} ${matcher.operator} "${matcher.value}"`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-blue-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-white dark:bg-dark-surface rounded-modal border border-cream-200 dark:border-dark-border shadow-modal overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 dark:border-dark-border">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-deep-blue-600 dark:text-cream-300" />
            <div>
              <h3 id="rules-modal-title" className="font-semibold text-base text-deep-blue-950 dark:text-cream-100">
                Learned Merchant Rules
              </h3>
              <p className="text-xs text-deep-blue-700/70 dark:text-cream-400">
                Tier 1 categorization precedence over dictionary and Gemini AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            title="Close dialog"
            className="p-1 rounded-lg text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-blue-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-cream-100 dark:border-dark-border bg-cream-50/50 dark:bg-dark-elevated/40">
          <span className="text-xs font-semibold text-deep-blue-800 dark:text-cream-200">
            {rules.length} active rules
          </span>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold transition-all shadow-sm dark:bg-white dark:text-black dark:hover:bg-cream-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Rule</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Add Form */}
          {isAdding && (
            <form
              onSubmit={handleCreateRule}
              className="p-4 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border space-y-3 animate-fadeIn text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-deep-blue-900 dark:text-cream-100">
                  Create Learned Rule:
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-deep-blue-600 hover:text-deep-blue-900 dark:text-cream-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Field</label>
                  <select
                    value={matcherField}
                    onChange={(e) => setMatcherField(e.target.value as 'merchant' | 'notes')}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border"
                  >
                    <option value="merchant">Merchant</option>
                    <option value="notes">Notes</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Matcher Operator</label>
                  <select
                    value={matcherOperator}
                    onChange={(e) => setMatcherOperator(e.target.value as RuleMatcherOperator)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border"
                  >
                    <option value="exact">Exact match</option>
                    <option value="contains">Contains</option>
                    <option value="startsWith">Starts with</option>
                    <option value="regex">Regular expression</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Pattern Value *</label>
                  <input
                    type="text"
                    required
                    value={matcherValue}
                    onChange={(e) => setMatcherValue(e.target.value)}
                    placeholder="e.g. Swiggy or ^Uber"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Assign Category *</label>
                  <select
                    value={selectedCatId}
                    onChange={(e) => {
                      setSelectedCatId(e.target.value);
                      setSelectedSubcatId('');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border"
                  >
                    {parentCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Subcategory (Optional)</label>
                  <select
                    value={selectedSubcatId}
                    onChange={(e) => setSelectedSubcatId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border"
                  >
                    <option value="">-- None --</option>
                    {subcategories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1 rounded-lg hover:bg-cream-200/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-white font-semibold dark:bg-white dark:text-black dark:hover:bg-cream-200"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Create Rule</span>
                </button>
              </div>
            </form>
          )}

          {/* Rules List */}
          {loading ? (
            <div className="text-center py-8 text-xs text-deep-blue-500 dark:text-cream-400">
              Loading rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-xs text-deep-blue-500 dark:text-cream-400">
              No rules learned yet. Rules are learned automatically when you categorize transactions, or you can add them manually.
            </div>
          ) : (
            <div className="divide-y divide-cream-100 dark:divide-dark-border">
              {rules.map((rule) => {
                const cat = catMap.get(rule.categoryId);
                const subcat = rule.subcategoryId ? catMap.get(rule.subcategoryId) : undefined;

                return (
                  <div
                    key={rule.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-cream-50/50 dark:hover:bg-dark-elevated/40 px-2 rounded-xl transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-deep-blue-900 dark:text-cream-100">
                        {formatMatcher(rule.matcher)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-deep-blue-600 dark:text-cream-400">
                        <span>→</span>
                        <span className="font-semibold text-deep-blue-950 dark:text-cream-100">
                          {cat?.name || rule.categoryId}
                        </span>
                        {subcat && <span>/ {subcat.name}</span>}
                        <span>•</span>
                        <span className="font-mono text-[11px] tabular-nums">
                          {rule.hits} {rule.hits === 1 ? 'hit' : 'hits'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      title="Delete rule"
                      className="p-1.5 rounded-lg text-deep-blue-400 hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
