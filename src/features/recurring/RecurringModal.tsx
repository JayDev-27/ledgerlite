import React, { useState, useEffect } from 'react';
import {
  X,
  Repeat,
  Plus,
  Trash2,
  Calendar,
  Check,
  Play,
  Pause,
  Zap,
} from 'lucide-react';
import type { Category, PaymentMethod, RecurringCadence, RecurringExpense } from '@/types';
import { repository } from '@/data/repository';
import { generateDueRecurringTransactions } from './recurringService';
import { formatCurrency } from '@/lib/formatters';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onUpdated?: () => void;
}

export const RecurringModal: React.FC<RecurringModalProps> = ({
  isOpen,
  onClose,
  categories,
  onUpdated,
}) => {
  const [recurringList, setRecurringList] = useState<RecurringExpense[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form State
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [cadence, setCadence] = useState<RecurringCadence>('monthly');
  const [nextDue, setNextDue] = useState(new Date().toISOString().split('T')[0] ?? '2026-11-15');
  const [categoryId, setCategoryId] = useState('cat_housing');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [notes, setNotes] = useState('');
  const modalRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose });

  const loadData = async () => {
    const list = await repository.getRecurring();
    setRecurringList(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setIsAdding(false);
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parentCategories = categories.filter((c) => !c.parentId);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0 || !merchant.trim()) return;

    await repository.createRecurring({
      template: {
        amount: amountNum,
        currency: 'INR',
        merchant: merchant.trim(),
        categoryId,
        paymentMethod,
        notes: notes.trim() || undefined,
        tags: ['recurring', cadence],
      },
      cadence,
      nextDue: nextDue || (new Date().toISOString().split('T')[0] ?? '2026-11-15'),
      active: true,
    });

    setIsAdding(false);
    setMerchant('');
    setAmount('');
    await loadData();
    onUpdated?.();
  };

  const handleToggleActive = async (item: RecurringExpense) => {
    await repository.updateRecurring(item.id, { active: !item.active });
    await loadData();
    onUpdated?.();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this recurring expense template?')) {
      await repository.deleteRecurring(id);
      await loadData();
      onUpdated?.();
    }
  };

  const handleGenerateNow = async () => {
    setIsGenerating(true);
    try {
      const res = await generateDueRecurringTransactions(repository);
      setFeedback(`Generated ${res.generatedCount} due transactions!`);
      await loadData();
      onUpdated?.();
      window.dispatchEvent(new CustomEvent('transactions-updated'));
      setTimeout(() => setFeedback(null), 4000);
    } catch (e) {
      console.error(e);
      setFeedback('Error generating recurring transactions.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurring-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/75 backdrop-blur-sm animate-fadeIn"
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
            <Repeat className="w-5 h-5 text-deep-blue-600 dark:text-cream-300" />
            <div>
              <h3 id="recurring-modal-title" className="font-semibold text-base text-deep-blue-950 dark:text-cream-100">
                Recurring Expense Templates
              </h3>
              <p className="text-xs text-deep-blue-700/70 dark:text-cream-400">
                Auto-generate rent, subscriptions, and EMIs on schedule
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateNow}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 hover:bg-sky-50 dark:hover:bg-dark-elevated text-xs font-semibold transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-deep-blue-500" />
              <span>{isGenerating ? 'Checking...' : 'Check & Generate Now'}</span>
            </button>
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold transition-all shadow-sm dark:bg-white dark:text-black dark:hover:bg-cream-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Template</span>
          </button>
        </div>

        {feedback && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-status-success-bg text-status-success text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Add Form */}
          {isAdding && (
            <form
              onSubmit={handleCreate}
              className="p-4 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border space-y-3 animate-fadeIn text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-deep-blue-900 dark:text-cream-100">
                  New Recurring Template:
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-deep-blue-600 hover:text-deep-blue-900 dark:text-cream-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Merchant / Name *</label>
                  <input
                    type="text"
                    required
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="e.g. House Rent or Netflix"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="25000"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Cadence *</label>
                  <select
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value as RecurringCadence)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly (14 days)</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Next Due Date *</label>
                  <input
                    type="date"
                    required
                    value={nextDue}
                    onChange={(e) => setNextDue(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
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
                  <label className="block font-semibold mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border uppercase"
                  >
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="net_banking">Net Banking</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Notes / Description (Optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Society maintenance flat 402"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border"
                  />
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
                  <span>Save Template</span>
                </button>
              </div>
            </form>
          )}

          {/* List */}
          {recurringList.length === 0 ? (
            <div className="text-center py-8 text-xs text-deep-blue-500 dark:text-cream-400">
              No recurring expenses set up yet. Add templates for monthly rent, WiFi, subscriptions, or EMIs.
            </div>
          ) : (
            <div className="divide-y divide-cream-100 dark:divide-dark-border">
              {recurringList.map((item) => {
                const cat = catMap.get(item.template.categoryId);

                return (
                  <div
                    key={item.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-cream-50/50 dark:hover:bg-dark-elevated/40 px-2 rounded-xl transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-deep-blue-900 dark:text-cream-100 truncate">
                          {item.template.merchant}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-sky-100 dark:bg-dark-border text-deep-blue-700 dark:text-cream-300">
                          {item.cadence}
                        </span>
                        {!item.active && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cream-200 dark:bg-dark-elevated text-deep-blue-400">
                            Paused
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-deep-blue-600 dark:text-cream-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Next due: {item.nextDue}</span>
                        </span>
                        <span>•</span>
                        <span>{cat?.name || 'General'}</span>
                        <span>•</span>
                        <span className="uppercase font-mono">{item.template.paymentMethod}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="font-semibold tabular-nums text-sm text-deep-blue-950 dark:text-cream-100">
                        {formatCurrency(item.template.amount)}
                      </div>

                      <button
                        onClick={() => handleToggleActive(item)}
                        title={item.active ? 'Pause auto-generation' : 'Resume auto-generation'}
                        className="p-1.5 rounded-lg text-deep-blue-600 hover:bg-cream-200 dark:hover:bg-dark-border transition-colors"
                      >
                        {item.active ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 text-status-success" />
                        )}
                      </button>

                      <button
                        onClick={() => handleDelete(item.id)}
                        title="Delete template"
                        className="p-1.5 rounded-lg text-deep-blue-400 hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
