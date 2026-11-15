import React, { useState } from 'react';
import { Trash2, FolderEdit, CreditCard, X } from 'lucide-react';
import type { Category, PaymentMethod } from '@/types';

interface BulkActionBarProps {
  selectedCount: number;
  categories: Category[];
  onClearSelection: () => void;
  onBulkChangeCategory: (categoryId: string, subcategoryId?: string | null) => Promise<void>;
  onBulkChangePaymentMethod: (paymentMethod: PaymentMethod) => Promise<void>;
  onBulkDelete: () => Promise<void>;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  categories,
  onClearSelection,
  onBulkChangeCategory,
  onBulkChangePaymentMethod,
  onBulkDelete,
}) => {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('upi');

  if (selectedCount === 0) return null;

  const parentCategories = categories.filter((c) => !c.parentId);

  const handleApplyCategory = async () => {
    if (!selectedCatId) return;
    await onBulkChangeCategory(selectedCatId);
    setShowCategoryPicker(false);
  };

  const handleApplyPayment = async () => {
    await onBulkChangePaymentMethod(selectedPayment);
    setShowPaymentPicker(false);
  };

  return (
    <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-40 bg-deep-blue-950 text-cream-100 px-5 py-3 rounded-2xl shadow-modal border border-deep-blue-800 flex items-center gap-3 sm:gap-4 animate-slideUp text-xs font-semibold">
      <div className="flex items-center gap-2 pr-3 border-r border-deep-blue-800">
        <span className="tabular-nums font-bold text-cream-100 text-sm">{selectedCount}</span>
        <span className="hidden sm:inline text-cream-200">selected</span>
      </div>

      {/* Change Category Action */}
      <div className="relative">
        <button
          onClick={() => {
            setShowCategoryPicker(!showCategoryPicker);
            setShowPaymentPicker(false);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deep-blue-900 hover:bg-deep-blue-800 text-cream-100 transition-colors"
        >
          <FolderEdit className="w-3.5 h-3.5 text-cream-200" />
          <span>Category</span>
        </button>

        {showCategoryPicker && (
          <div className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-dark-surface text-deep-blue-950 dark:text-cream-100 p-3 rounded-xl border border-cream-200 dark:border-dark-border shadow-modal space-y-2 z-50 animate-fadeIn">
            <div className="font-bold text-[11px] text-deep-blue-700/80 dark:text-cream-400">
              Select New Category:
            </div>
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-xs"
            >
              <option value="">-- Choose Category --</option>
              {parentCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowCategoryPicker(false)}
                className="px-2.5 py-1 text-[11px] rounded hover:bg-cream-100 dark:hover:bg-dark-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedCatId}
                onClick={handleApplyCategory}
                className="px-3 py-1 bg-deep-blue-500 hover:bg-deep-blue-600 text-white rounded text-[11px] font-bold disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Change Payment Action */}
      <div className="relative">
        <button
          onClick={() => {
            setShowPaymentPicker(!showPaymentPicker);
            setShowCategoryPicker(false);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deep-blue-900 hover:bg-deep-blue-800 text-cream-100 transition-colors"
        >
          <CreditCard className="w-3.5 h-3.5 text-cream-200" />
          <span>Payment</span>
        </button>

        {showPaymentPicker && (
          <div className="absolute bottom-full mb-2 left-0 w-56 bg-white dark:bg-dark-surface text-deep-blue-950 dark:text-cream-100 p-3 rounded-xl border border-cream-200 dark:border-dark-border shadow-modal space-y-2 z-50 animate-fadeIn">
            <div className="font-bold text-[11px] text-deep-blue-700/80 dark:text-cream-400">
              Select Payment Method:
            </div>
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value as PaymentMethod)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-xs uppercase"
            >
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="net_banking">Net Banking</option>
              <option value="cash">Cash</option>
              <option value="wallet">Wallet</option>
            </select>
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowPaymentPicker(false)}
                className="px-2.5 py-1 text-[11px] rounded hover:bg-cream-100 dark:hover:bg-dark-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyPayment}
                className="px-3 py-1 bg-deep-blue-500 hover:bg-deep-blue-600 text-white rounded text-[11px] font-bold"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Action */}
      <button
        onClick={async () => {
          if (window.confirm(`Delete ${selectedCount} selected transactions?`)) {
            await onBulkDelete();
          }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-status-danger/20 hover:bg-status-danger text-status-danger hover:text-white transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Delete ({selectedCount})</span>
      </button>

      {/* Deselect */}
      <button
        onClick={onClearSelection}
        title="Deselect all"
        className="p-1 rounded-md text-cream-400 hover:text-white hover:bg-deep-blue-900 transition-colors ml-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
