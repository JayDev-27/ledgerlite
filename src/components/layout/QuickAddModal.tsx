import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Check,
  Calendar,
  CreditCard,
  Tag,
  PlusCircle,
  Loader2,
} from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { repository } from '@/data/repository';
import { parseExpenseTextLocally, ParsedDraft } from '@/lib/quickAddParser';
import { parseQuickAddExpense } from '@/lib/quickAddAi';
import { formatCurrency } from '@/lib/formatters';
import { DEFAULT_CATEGORIES } from '@/data/categories';
import { PaymentMethod } from '@/types';

export const QuickAddModal: React.FC = () => {
  const { isQuickAddOpen, closeQuickAdd } = useUiStore();
  const [inputText, setInputText] = useState('');
  const [draft, setDraft] = useState<ParsedDraft | null>(null);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [mode, setMode] = useState<'quick' | 'manual'>('quick');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Manual form state
  const [manualAmount, setManualAmount] = useState('');
  const [manualMerchant, setManualMerchant] = useState('');
  const [manualCategory, setManualCategory] = useState('cat_food_dining');
  const [manualPayment, setManualPayment] = useState<PaymentMethod>('upi');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0] || '');

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isQuickAddOpen) {
      document.body.style.overflow = 'hidden';
      setInputText('');
      setDraft(null);
      setSuccessMessage(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [isQuickAddOpen]);

  // Handle parsing on text change with instant local + debounced AI refinement
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (text.trim().length > 2) {
      // 1. Instant local parse
      const localParsed = parseExpenseTextLocally(text);
      setDraft(localParsed);

      // 2. Debounced AI enhancement
      debounceTimerRef.current = setTimeout(async () => {
        try {
          setIsAiParsing(true);
          const aiParsed = await parseQuickAddExpense(text);
          if (aiParsed && aiParsed.amount) {
            setDraft(aiParsed);
          }
        } catch {
          // Keep local draft if AI fails
        } finally {
          setIsAiParsing(false);
        }
      }, 450);
    } else {
      setDraft(null);
      setIsAiParsing(false);
    }
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.amount || draft.amount <= 0) return;

    setIsSubmitting(true);
    try {
      await repository.createTransaction({
        amount: draft.amount,
        currency: 'INR',
        date: `${draft.date}T12:00:00.000Z`,
        merchant: draft.merchant,
        categoryId: draft.categoryId || 'cat_food_dining',
        subcategoryId: draft.subcategoryId,
        paymentMethod: draft.paymentMethod,
        notes: draft.notes,
        tags: ['quick-add'],
        source: 'quick_add',
        confidence: 0.9,
      });

      setSuccessMessage(`Logged ${formatCurrency(draft.amount)} at ${draft.merchant}!`);
      setTimeout(() => {
        closeQuickAdd();
        window.dispatchEvent(new CustomEvent('transactions-updated'));
      }, 900);
    } catch (err) {
      console.error('Failed to log expense:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(manualAmount);
    if (isNaN(amountNum) || amountNum <= 0 || !manualMerchant.trim()) return;

    setIsSubmitting(true);
    try {
      await repository.createTransaction({
        amount: amountNum,
        currency: 'INR',
        date: `${manualDate}T12:00:00.000Z`,
        merchant: manualMerchant.trim(),
        categoryId: manualCategory,
        paymentMethod: manualPayment,
        tags: ['manual'],
        source: 'manual',
        confidence: 1.0,
      });

      setSuccessMessage(`Logged ${formatCurrency(amountNum)} at ${manualMerchant}!`);
      setTimeout(() => {
        closeQuickAdd();
        window.dispatchEvent(new CustomEvent('transactions-updated'));
      }, 900);
    } catch (err) {
      console.error('Failed to log manual expense:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isQuickAddOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick Add Expense"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-deep-blue-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeQuickAdd();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-dark-surface rounded-modal border border-cream-300 dark:border-dark-border shadow-modal overflow-hidden transform transition-all">
        {/* Header Tabs */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-cream-200 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMode('quick')}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${
                mode === 'quick'
                  ? 'border-deep-blue-500 text-deep-blue-900 dark:text-cream-100'
                  : 'border-transparent text-deep-blue-700/60 dark:text-cream-400 hover:text-deep-blue-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-deep-blue-600 dark:text-cream-300" />
                Natural Language Quick-Add
              </span>
            </button>

            <button
              onClick={() => setMode('manual')}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${
                mode === 'manual'
                  ? 'border-deep-blue-500 text-deep-blue-900 dark:text-cream-100'
                  : 'border-transparent text-deep-blue-700/60 dark:text-cream-400 hover:text-deep-blue-900'
              }`}
            >
              Manual Form
            </button>
          </div>

          <button
            onClick={closeQuickAdd}
            className="p-1 rounded-lg text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Message Banner */}
        {successMessage && (
          <div className="p-4 bg-status-success-bg dark:bg-emerald-950/40 text-status-success dark:text-emerald-300 flex items-center justify-center gap-2 text-sm font-medium animate-fadeIn">
            <Check className="w-4 h-4" />
            {successMessage}
          </div>
        )}

        {/* Content Body */}
        {mode === 'quick' ? (
          <form onSubmit={handleQuickSubmit} className="p-6 space-y-4">
            <div>
              <label
                htmlFor="quick-input"
                className="block text-xs font-medium text-deep-blue-700/80 dark:text-cream-300 mb-2"
              >
                Type naturally (e.g. &ldquo;450 zomato yesterday upi&rdquo; or &ldquo;1200 shell petrol card&rdquo;)
              </label>
              <div className="relative">
                <input
                  id="quick-input"
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder="e.g. 350 blue tokai coffee upi"
                  className="w-full px-4 py-3 text-base rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 placeholder:text-deep-blue-400/50 dark:placeholder:text-cream-400/50 focus:outline-none focus:ring-2 focus:ring-sky-400 font-normal"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Parsed Draft Confirmation Card */}
            {draft && draft.amount && (
              <div className="p-4 rounded-xl bg-cream-50/80 dark:bg-dark-elevated/80 border border-sky-200 dark:border-dark-border space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-deep-blue-700 dark:text-cream-300 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
                    <span>Detected Transaction Draft</span>
                  </div>
                  {isAiParsing && (
                    <div className="flex items-center gap-1 text-[11px] text-deep-blue-600 dark:text-cream-200 font-normal lowercase tracking-normal">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>refining with Gemini...</span>
                    </div>
                  )}
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">
                    {formatCurrency(draft.amount)}
                  </div>
                  <div className="text-sm font-medium text-deep-blue-800 dark:text-cream-200">
                    {draft.merchant}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-cream-200 dark:border-dark-border text-xs text-deep-blue-700/80 dark:text-cream-300">
                  <div className="flex items-center gap-1 truncate">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{draft.date}</span>
                  </div>
                  <div className="flex items-center gap-1 truncate uppercase">
                    <CreditCard className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{draft.paymentMethod}</span>
                  </div>
                  <div className="flex items-center gap-1 truncate">
                    <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">Auto-categorised</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 active:bg-deep-blue-700 text-cream-100 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Check className="w-4 h-4" />
                  Confirm & Save
                </button>
              </div>
            )}

            {!draft && (
              <div className="text-xs text-deep-blue-600/70 dark:text-cream-400 space-y-1 py-1">
                <p className="font-medium text-deep-blue-800 dark:text-cream-200">Examples:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '450 zomato upi',
                    '2500 groceries card',
                    '350 uber yesterday upi',
                    '180 blue tokai',
                  ].map((eg) => (
                    <button
                      key={eg}
                      type="button"
                      onClick={() => {
                        setInputText(eg);
                        setDraft(parseExpenseTextLocally(eg));
                      }}
                      className="px-2 py-1 rounded-md bg-cream-100 dark:bg-dark-elevated hover:bg-cream-200 text-deep-blue-800 dark:text-cream-300 text-[11px] font-mono transition-colors"
                    >
                      {eg}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        ) : (
          /* Manual Entry Form */
          <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-deep-blue-700/80 dark:text-cream-300 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="500"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-deep-blue-700/80 dark:text-cream-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-deep-blue-700/80 dark:text-cream-300 mb-1">
                Merchant / Payee
              </label>
              <input
                type="text"
                required
                value={manualMerchant}
                onChange={(e) => setManualMerchant(e.target.value)}
                placeholder="e.g. Swiggy, Uber, Rent"
                className="w-full px-3 py-2 text-sm rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-deep-blue-700/80 dark:text-cream-300 mb-1">
                  Category
                </label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  {DEFAULT_CATEGORIES.filter((c) => !c.parentId).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-deep-blue-700/80 dark:text-cream-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={manualPayment}
                  onChange={(e) => setManualPayment(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400 uppercase"
                >
                  <option value="upi">UPI (GPay / PhonePe)</option>
                  <option value="card">Card (Credit/Debit)</option>
                  <option value="net_banking">Net Banking</option>
                  <option value="cash">Cash</option>
                  <option value="wallet">Wallet</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-2.5 px-4 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Save Transaction
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
