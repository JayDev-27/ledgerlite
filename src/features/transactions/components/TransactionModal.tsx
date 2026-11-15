import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Trash2,
  Check,
  Repeat,
} from 'lucide-react';
import type { Category, PaymentMethod, RecurringCadence, Transaction } from '@/types';
import { transactionSchema, TransactionFormData } from '../schemas';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  initialData?: Transaction | null;
  onSave: (data: TransactionFormData, isEdit: boolean, id?: string) => Promise<void>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  categories,
  initialData,
  onSave,
}) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [createRecurring, setCreateRecurring] = useState(false);
  const [recurringCadence, setRecurringCadence] = useState<RecurringCadence>('monthly');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setAmount(String(initialData.amount));
        const d = new Date(initialData.date);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const h = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          setDate(`${y}-${m}-${day}T${h}:${min}`);
        } else {
          setDate(initialData.date.slice(0, 16));
        }
        setMerchant(initialData.merchant);
        setCategoryId(initialData.categoryId);
        setSubcategoryId(initialData.subcategoryId || '');
        setPaymentMethod(initialData.paymentMethod);
        setNotes(initialData.notes || '');
        setTags(initialData.tags || []);
        setReceiptImage(initialData.receiptImage || null);
        setCreateRecurring(!!initialData.recurringId);
      } else {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        setAmount('');
        setDate(`${y}-${m}-${d}T${h}:${min}`);
        setMerchant('');
        setCategoryId('cat_food_dining');
        setSubcategoryId('');
        setPaymentMethod('upi');
        setNotes('');
        setTags([]);
        setReceiptImage(null);
        setCreateRecurring(false);
        setRecurringCadence('monthly');
      }
      setErrors({});
      setTagInput('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const parentCategories = categories.filter((c) => !c.parentId);
  const subcategories = categories.filter((c) => c.parentId === categoryId);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#|,/g, '').toLowerCase();
      if (clean && !tags.includes(clean)) {
        setTags([...tags, clean]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, receiptImage: 'Receipt photo must be under 5MB' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptImage(event.target?.result as string);
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.receiptImage;
        return copy;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const dateObj = new Date(date);
    const validIsoDate = isNaN(dateObj.getTime())
      ? new Date().toISOString()
      : dateObj.toISOString();

    const formDataToValidate = {
      amount: parseFloat(amount),
      date: validIsoDate,
      merchant: merchant.trim(),
      categoryId,
      subcategoryId: subcategoryId || null,
      paymentMethod,
      notes: notes.trim() || undefined,
      tags,
      receiptImage: receiptImage || undefined,
      createRecurring,
      recurringCadence: createRecurring ? recurringCadence : undefined,
    };

    const validation = transactionSchema.safeParse(formDataToValidate);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(validation.data, !!initialData, initialData?.id);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to save transaction:', err);
      setErrors({ form: err instanceof Error ? err.message : 'Failed to save transaction.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-tx-title"
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-14 px-4 pb-8 overflow-y-auto bg-black/50 dark:bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-xl bg-white dark:bg-dark-surface rounded-modal border border-cream-200 dark:border-dark-border shadow-modal overflow-hidden transform transition-all my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 dark:border-dark-border">
          <h3 id="modal-tx-title" className="font-semibold text-base text-deep-blue-950 dark:text-cream-100">
            {initialData ? 'Edit Expense' : 'Add New Expense'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            title="Close dialog"
            className="p-1 rounded-lg text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-blue-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errors.form && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-status-danger-bg text-status-danger text-xs font-semibold">
            {errors.form}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Amount & Date/Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-deep-blue-800 dark:text-cream-200 mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="450.00"
                className={`w-full px-3.5 py-2 text-sm rounded-xl bg-cream-50 dark:bg-dark-elevated border ${
                  errors.amount ? 'border-status-danger' : 'border-cream-300 dark:border-dark-border'
                } text-deep-blue-900 dark:text-cream-100 font-mono focus:outline-none focus:ring-2 focus:ring-sky-400`}
              />
              {errors.amount && (
                <p className="text-[11px] text-status-danger mt-1">{errors.amount}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-deep-blue-800 dark:text-cream-200 mb-1">
                Date & Time *
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl bg-cream-50 dark:bg-dark-elevated border ${
                    errors.date ? 'border-status-danger' : 'border-cream-300 dark:border-dark-border'
                  } text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400`}
                />
              </div>
              {errors.date && (
                <p className="text-[11px] text-status-danger mt-1">{errors.date}</p>
              )}
            </div>
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-xs font-semibold text-deep-blue-800 dark:text-cream-200 mb-1">
              Merchant / Payee *
            </label>
            <input
              type="text"
              required
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. Swiggy, Uber, Shell Petrol, Landlord"
              className={`w-full px-3.5 py-2 text-sm rounded-xl bg-cream-50 dark:bg-dark-elevated border ${
                errors.merchant ? 'border-status-danger' : 'border-cream-300 dark:border-dark-border'
              } text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400`}
            />
            {errors.merchant && (
              <p className="text-[11px] text-status-danger mt-1">{errors.merchant}</p>
            )}
          </div>

          {/* Cascaded Category & Subcategory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-deep-blue-800 dark:text-cream-200 mb-1">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubcategoryId('');
                }}
                className="w-full px-3.5 py-2 text-xs font-medium rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                {parentCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-deep-blue-800 dark:text-cream-200 mb-1">
                Subcategory
              </label>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                disabled={subcategories.length === 0}
                className="w-full px-3.5 py-2 text-xs font-medium rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="">-- None / General --</option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-deep-blue-800 dark:text-cream-200 mb-1">
              Payment Method *
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {(
                [
                  { id: 'upi', label: 'UPI' },
                  { id: 'card', label: 'Card' },
                  { id: 'net_banking', label: 'Net Bank' },
                  { id: 'cash', label: 'Cash' },
                  { id: 'wallet', label: 'Wallet' },
                ] as const
              ).map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id)}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl border text-center transition-all ${
                    paymentMethod === method.id
                      ? 'bg-deep-blue-500 text-cream-100 border-deep-blue-500 shadow-sm'
                      : 'bg-cream-50 dark:bg-dark-elevated border-cream-200 dark:border-dark-border text-deep-blue-800 dark:text-cream-200 hover:bg-cream-100'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags Chips Input */}
          <div>
            <label className="block text-xs font-semibold text-deep-blue-800 dark:text-cream-200 mb-1">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border min-h-[42px]">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-sky-100 dark:bg-dark-border text-deep-blue-800 dark:text-cream-200 text-xs font-mono"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    aria-label={`Remove tag ${t}`}
                    title={`Remove tag ${t}`}
                    className="hover:text-status-danger rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-deep-blue-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder={tags.length === 0 ? 'Type tag and press Enter...' : 'Add more...'}
                className="flex-1 min-w-[120px] bg-transparent text-xs text-deep-blue-900 dark:text-cream-100 focus:outline-none placeholder:text-deep-blue-400/50"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-deep-blue-800 dark:text-cream-200 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add personal note or context..."
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          {/* Receipt Image Upload */}
          <div>
            <label className="block text-xs font-semibold text-deep-blue-800 dark:text-cream-200 mb-1">
              Receipt Photo (Stored Offline)
            </label>
            {receiptImage ? (
              <div className="relative inline-block border border-cream-300 dark:border-dark-border rounded-xl overflow-hidden group">
                <img
                  src={receiptImage}
                  alt="Receipt"
                  className="h-28 w-auto object-cover max-w-full"
                />
                <button
                  type="button"
                  onClick={() => setReceiptImage(null)}
                  aria-label="Remove receipt photo"
                  title="Remove receipt photo"
                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/80 text-white hover:bg-status-danger transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cream-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-cream-300 dark:border-dark-border hover:bg-cream-50 dark:hover:bg-dark-elevated cursor-pointer transition-colors text-xs text-deep-blue-700 dark:text-cream-300">
                <Upload className="w-4 h-4 text-deep-blue-500 dark:text-cream-300" />
                <span>Upload receipt photo (PNG/JPEG)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
            {errors.receiptImage && (
              <p className="text-[11px] text-status-danger mt-1">{errors.receiptImage}</p>
            )}
          </div>

          {/* Recurring Template Checkbox */}
          {!initialData && (
            <div className="pt-2 border-t border-cream-100 dark:border-dark-border space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-deep-blue-900 dark:text-cream-100">
                <input
                  type="checkbox"
                  checked={createRecurring}
                  onChange={(e) => setCreateRecurring(e.target.checked)}
                  className="rounded text-deep-blue-500 focus:ring-sky-400"
                />
                <Repeat className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
                <span>Save as Recurring Expense Template</span>
              </label>

              {createRecurring && (
                <div className="pl-6 pt-1 flex items-center gap-3">
                  <span className="text-xs text-deep-blue-700/80 dark:text-cream-300">Cadence:</span>
                  <select
                    value={recurringCadence}
                    onChange={(e) => setRecurringCadence(e.target.value as RecurringCadence)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 font-medium"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly (14 days)</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-cream-200 dark:border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 shadow-sm transition-all dark:bg-white dark:text-black dark:hover:bg-cream-200"
            >
              <Check className="w-4 h-4" />
              <span>{initialData ? 'Update Expense' : 'Save Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
