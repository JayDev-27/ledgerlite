import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  CreditCard,
  Trash2,
  X,
  Upload,
  Sparkles,
  Repeat,
  CheckCircle,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  FolderTree,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { repository } from '@/data/repository';
import type {
  Transaction,
  Category,
  PaymentMethod,
} from '@/types';
import { formatCurrency, formatRelativeDate } from '@/lib/formatters';
import { CategoryTypeBadge } from '@/components/common/Badge';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { EmptyState } from '@/components/common/EmptyState';

// Modals
import { TransactionModal } from './components/TransactionModal';
import { TransactionFormData } from './schemas';
import { CsvImportModal } from './components/CsvImportModal';
import { BulkActionBar } from './components/BulkActionBar';
import { UndoToast } from './components/UndoToast';
import { RuleLearningModal } from './components/RuleLearningModal';
import { CategoriesModal } from '@/features/categories/CategoriesModal';
import { RulesModal } from '@/features/rules/RulesModal';
import { RecurringModal } from '@/features/recurring/RecurringModal';

export const TransactionsPage: React.FC = () => {
  // Primary Data State
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  // Pagination & Sorting State
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [sortBy, setSortBy] = useState<keyof Transaction>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Active Tab: 'all' | 'review' | 'recurring'
  const [activeTab, setActiveTab] = useState<'all' | 'review' | 'recurring'>('all');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<
    'all' | 'today' | 'week' | 'month' | 'last_month' | 'custom'
  >('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<string>('all');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Selection & Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal Open States
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);

  // Receipt Preview
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Undo Toast State
  const [lastDeletedTx, setLastDeletedTx] = useState<Transaction | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Rule Learning State
  const [ruleLearnData, setRuleLearnData] = useState<{
    isOpen: boolean;
    merchant: string;
    categoryId: string;
    subcategoryId?: string | null;
    categoryName: string;
    affectedCount: number;
  }>({
    isOpen: false,
    merchant: '',
    categoryId: '',
    categoryName: '',
    affectedCount: 0,
  });

  // Calculate Date Preset Boundaries
  const getDateRangeForPreset = (preset: typeof datePreset) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (preset === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      return { start: monday.toISOString().split('T')[0], end: todayStr };
    }
    if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      return { start, end: todayStr };
    }
    if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .split('T')[0];
      return { start, end };
    }
    if (preset === 'custom') {
      return { start: startDate || undefined, end: endDate || undefined };
    }
    return { start: undefined, end: undefined };
  };

  // Main Data Loader
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cats, allTxs] = await Promise.all([
        repository.getCategories(),
        repository.getAllTransactions(),
      ]);

      setCategories(cats);

      // Review count calculation
      const needingReview = allTxs.filter((t) => t.confidence !== undefined && t.confidence < 0.7);
      setReviewCount(needingReview.length);

      const dateRange = getDateRangeForPreset(datePreset);

      const filterPayload = {
        search: searchQuery.trim() || undefined,
        startDate: dateRange.start,
        endDate: dateRange.end,
        categoryIds: selectedCategory !== 'all' ? [selectedCategory] : undefined,
        subcategoryId: selectedSubcategory !== 'all' ? selectedSubcategory : undefined,
        paymentMethods:
          selectedPayment !== 'all' ? [selectedPayment as PaymentMethod] : undefined,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
        tags: selectedTag !== 'all' ? [selectedTag] : undefined,
        recurringOnly: activeTab === 'recurring' ? true : undefined,
        needsReviewOnly: activeTab === 'review' ? true : undefined,
      };

      const result = await repository.getTransactions(filterPayload, {
        page,
        pageSize,
        sortBy,
        sortDirection,
      });

      setTransactions(result.data);
      setTotalCount(result.total);
    } catch (e) {
      console.error('Failed to load transactions:', e);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    sortBy,
    sortDirection,
    activeTab,
    searchQuery,
    datePreset,
    startDate,
    endDate,
    selectedCategory,
    selectedSubcategory,
    selectedPayment,
    minAmount,
    maxAmount,
    selectedTag,
  ]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('transactions-updated', handleUpdate);
    return () => window.removeEventListener('transactions-updated', handleUpdate);
  }, [loadData]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Check if any filter is active
  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    datePreset !== 'all' ||
    selectedCategory !== 'all' ||
    selectedSubcategory !== 'all' ||
    selectedPayment !== 'all' ||
    minAmount !== '' ||
    maxAmount !== '' ||
    selectedTag !== 'all';

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('all');
    setSelectedSubcategory('all');
    setSelectedPayment('all');
    setMinAmount('');
    setMaxAmount('');
    setSelectedTag('all');
    setPage(1);
  };

  // Sorting Handler
  const handleSort = (field: keyof Transaction) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  // Delete with Undo Toast
  const handleDeleteTransaction = async (tx: Transaction) => {
    await repository.deleteTransaction(tx.id);
    setLastDeletedTx(tx);
    setShowUndoToast(true);
    setSelectedIds((prev) => prev.filter((id) => id !== tx.id));
    loadData();
  };

  const handleUndoDelete = async () => {
    if (lastDeletedTx) {
      await repository.restoreTransaction(lastDeletedTx);
      setLastDeletedTx(null);
      setShowUndoToast(false);
      loadData();
    }
  };

  // Bulk Selection
  const handleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
      const pageIds = transactions.map((t) => t.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...pageIds])));
    } else {
      const pageIdSet = new Set(transactions.map((t) => t.id));
      setSelectedIds(selectedIds.filter((id) => !pageIdSet.has(id)));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Bulk Actions
  const handleBulkChangeCategory = async (categoryId: string) => {
    await repository.bulkUpdateTransactions(selectedIds, {
      categoryId,
      subcategoryId: null,
    });
    setSelectedIds([]);
    loadData();
  };

  const handleBulkChangePaymentMethod = async (paymentMethod: PaymentMethod) => {
    await repository.bulkUpdateTransactions(selectedIds, { paymentMethod });
    setSelectedIds([]);
    loadData();
  };

  const handleBulkDelete = async () => {
    await repository.bulkDeleteTransactions(selectedIds);
    setSelectedIds([]);
    loadData();
  };

  // 1-Click Approve in Review Queue
  const handleApproveTransaction = async (tx: Transaction) => {
    await repository.updateTransaction(tx.id, { confidence: 1.0 });
    loadData();
  };

  // Save Transaction (Add / Edit) with Rule Learning Check
  const handleSaveTransaction = async (
    data: TransactionFormData,
    isEdit: boolean,
    id?: string
  ) => {
    if (isEdit && id) {
      await repository.updateTransaction(id, {
        amount: data.amount,
        date: data.date,
        merchant: data.merchant,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        tags: data.tags,
        receiptImage: data.receiptImage,
        confidence: 1.0, // User verified
      });
    } else {
      await repository.createTransaction({
        amount: data.amount,
        currency: 'INR',
        date: data.date,
        merchant: data.merchant,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        tags: data.tags,
        receiptImage: data.receiptImage,
        source: 'manual',
        confidence: 1.0,
      });

      // If user also checked recurring template
      if (data.createRecurring && data.recurringCadence) {
        await repository.createRecurring({
          template: {
            amount: data.amount,
            currency: 'INR',
            merchant: data.merchant,
            categoryId: data.categoryId,
            subcategoryId: data.subcategoryId,
            paymentMethod: data.paymentMethod,
            notes: data.notes,
            tags: data.tags,
          },
          cadence: data.recurringCadence,
          nextDue: data.date.slice(0, 10),
          active: true,
        });
      }
    }

    loadData();

    // Check if we should prompt rule learning for this merchant
    const existingRule = await repository.findMatchingRule(data.merchant);
    if (!existingRule) {
      const allTx = await repository.getAllTransactions();
      const matchingCount = allTx.filter(
        (t) =>
          t.merchant.toLowerCase().trim() === data.merchant.toLowerCase().trim() &&
          t.categoryId !== data.categoryId
      ).length;

      const catName = catMap.get(data.categoryId)?.name || data.categoryId;

      setRuleLearnData({
        isOpen: true,
        merchant: data.merchant,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        categoryName: catName,
        affectedCount: matchingCount,
      });
    }
  };

  // Rule Learning Confirmation
  const handleConfirmRuleLearning = async (applyToPast: boolean) => {
    const { merchant, categoryId, subcategoryId } = ruleLearnData;
    await repository.createRule({
      matcher: {
        field: 'merchant',
        operator: 'exact',
        value: merchant.trim(),
      },
      categoryId,
      subcategoryId: subcategoryId || null,
    });

    if (applyToPast) {
      const allTxs = await repository.getAllTransactions();
      const matchingIds = allTxs
        .filter((t) => t.merchant.toLowerCase().trim() === merchant.toLowerCase().trim())
        .map((t) => t.id);

      if (matchingIds.length > 0) {
        await repository.bulkUpdateTransactions(matchingIds, {
          categoryId,
          subcategoryId: subcategoryId || null,
          confidence: 1.0,
        });
      }
    }

    setRuleLearnData((prev) => ({ ...prev, isOpen: false }));
    loadData();
  };

  const isAllOnPageSelected =
    transactions.length > 0 && transactions.every((t) => selectedIds.includes(t.id));

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-deep-blue-950 dark:text-cream-100">
            Expenses & Transactions
          </h2>
          <p className="text-xs text-deep-blue-700/70 dark:text-cream-400">
            Full CRUD, 3-tier rules, CSV imports, and offline bank statement ledger
          </p>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsCsvImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 text-xs font-semibold hover:bg-cream-50 dark:hover:bg-dark-elevated transition-colors shadow-subtle"
          >
            <Upload className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => setIsCategoriesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 text-xs font-semibold hover:bg-cream-50 dark:hover:bg-dark-elevated transition-colors shadow-subtle"
          >
            <FolderTree className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
            <span>Categories</span>
          </button>

          <button
            onClick={() => setIsRulesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 text-xs font-semibold hover:bg-cream-50 dark:hover:bg-dark-elevated transition-colors shadow-subtle"
          >
            <Sparkles className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
            <span>Rules</span>
          </button>

          <button
            onClick={() => setIsRecurringModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 text-xs font-semibold hover:bg-cream-50 dark:hover:bg-dark-elevated transition-colors shadow-subtle"
          >
            <Repeat className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
            <span>Recurring</span>
          </button>

          <button
            onClick={() => {
              setEditingTransaction(null);
              setIsAddEditOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Tabs Header (All / Review Queue / Recurring) */}
      <div className="flex items-center gap-2 border-b border-cream-200 dark:border-dark-border pb-1">
        <button
          onClick={() => {
            setActiveTab('all');
            setPage(1);
          }}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'all'
              ? 'border-deep-blue-500 text-deep-blue-900 dark:text-cream-100 bg-white dark:bg-dark-surface'
              : 'border-transparent text-deep-blue-700/60 dark:text-cream-400 hover:text-deep-blue-900'
          }`}
        >
          <span>All Transactions</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('review');
            setPage(1);
          }}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'review'
              ? 'border-deep-blue-500 text-deep-blue-900 dark:text-cream-100 bg-white dark:bg-dark-surface'
              : 'border-transparent text-deep-blue-700/60 dark:text-cream-400 hover:text-deep-blue-900'
          }`}
        >
          <span>Review Queue</span>
          {reviewCount > 0 && (
            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
              {reviewCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('recurring');
            setPage(1);
          }}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'recurring'
              ? 'border-deep-blue-500 text-deep-blue-900 dark:text-cream-100 bg-white dark:bg-dark-surface'
              : 'border-transparent text-deep-blue-700/60 dark:text-cream-400 hover:text-deep-blue-900'
          }`}
        >
          <span>Recurring Only</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-deep-blue-500/60 dark:text-cream-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by merchant, note, amount, or tag..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 placeholder:text-deep-blue-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-deep-blue-400 hover:text-deep-blue-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Range Preset */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value as typeof datePreset);
                setPage(1);
              }}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Range...</option>
            </select>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                showAdvancedFilters || hasActiveFilters
                  ? 'bg-sky-50 dark:bg-dark-elevated border-sky-400 text-deep-blue-900 dark:text-cream-100'
                  : 'bg-cream-50 dark:bg-dark-elevated border-cream-200 dark:border-dark-border text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-deep-blue-500" />
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={handleClearAllFilters}
                className="text-xs text-status-danger hover:underline px-1 py-1"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Pickers (if custom selected) */}
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-cream-100 dark:border-dark-border text-xs animate-fadeIn">
            <span className="font-semibold text-deep-blue-700 dark:text-cream-300">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border"
            />
            <span className="font-semibold text-deep-blue-700 dark:text-cream-300">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border"
            />
          </div>
        )}

        {/* Expandable Advanced Filters Bar */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-cream-100 dark:border-dark-border text-xs animate-fadeIn">
            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-deep-blue-700/80 dark:text-cream-400 mb-1">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubcategory('all');
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-xs"
              >
                <option value="all">All Categories</option>
                {categories
                  .filter((c) => !c.parentId)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Subcategory Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-deep-blue-700/80 dark:text-cream-400 mb-1">
                Subcategory
              </label>
              <select
                value={selectedSubcategory}
                onChange={(e) => {
                  setSelectedSubcategory(e.target.value);
                  setPage(1);
                }}
                disabled={selectedCategory === 'all'}
                className="w-full px-2.5 py-1.5 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-xs disabled:opacity-40"
              >
                <option value="all">All Subcategories</option>
                {categories
                  .filter((c) => c.parentId === selectedCategory)
                  .map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Payment Method Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-deep-blue-700/80 dark:text-cream-400 mb-1">
                Payment Method
              </label>
              <select
                value={selectedPayment}
                onChange={(e) => {
                  setSelectedPayment(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-xs"
              >
                <option value="all">All Methods</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="net_banking">Net Banking</option>
                <option value="cash">Cash</option>
                <option value="wallet">Wallet</option>
              </select>
            </div>

            {/* Amount Range Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-deep-blue-700/80 dark:text-cream-400 mb-1">
                Amount Range (₹)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="Min"
                  value={minAmount}
                  onChange={(e) => {
                    setMinAmount(e.target.value);
                    setPage(1);
                  }}
                  className="w-1/2 px-2 py-1.5 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-xs font-mono"
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxAmount}
                  onChange={(e) => {
                    setMaxAmount(e.target.value);
                    setPage(1);
                  }}
                  className="w-1/2 px-2 py-1.5 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Transactions Table Container */}
      <div className="rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle overflow-hidden">
        {/* Table Top Header with Pagination & Count */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-b border-cream-100 dark:border-dark-border text-xs">
          <div className="font-medium text-deep-blue-700/80 dark:text-cream-300">
            Showing <strong className="font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">{transactions.length}</strong> of{' '}
            <strong className="font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">{totalCount}</strong> transactions
            {selectedIds.length > 0 && (
              <span className="ml-2 font-bold text-sky-600 dark:text-sky-300">
                ({selectedIds.length} selected)
              </span>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-lg border border-cream-200 dark:border-dark-border disabled:opacity-40 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-deep-blue-700 dark:text-cream-300 font-mono">
              Page {page} of {Math.ceil(totalCount / pageSize) || 1}
            </span>
            <button
              disabled={page * pageSize >= totalCount}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-cream-200 dark:border-dark-border disabled:opacity-40 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6">
            <SkeletonLoader variant="table-row" count={10} />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={CreditCard}
              title={
                activeTab === 'review'
                  ? 'Review Queue Clear!'
                  : activeTab === 'recurring'
                  ? 'No Recurring Expenses Found'
                  : 'No matching transactions'
              }
              description={
                activeTab === 'review'
                  ? 'All transaction classifications have high confidence. Great job!'
                  : 'Try modifying your search or filter keywords, or add a new expense.'
              }
              actionLabel="Add Transaction"
              onAction={() => {
                setEditingTransaction(null);
                setIsAddEditOpen(true);
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-cream-50/80 dark:bg-dark-elevated/70 text-deep-blue-800 dark:text-cream-200 font-bold border-b border-cream-100 dark:border-dark-border select-none">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllOnPageSelected}
                      onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                      className="rounded text-deep-blue-500 focus:ring-sky-400"
                    />
                  </th>

                  {/* Date Column Header */}
                  <th
                    onClick={() => handleSort('date')}
                    className="p-3 cursor-pointer hover:text-deep-blue-950 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>Date</span>
                      {sortBy === 'date' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-deep-blue-500" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-deep-blue-500" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-deep-blue-300" />
                      )}
                    </div>
                  </th>

                  {/* Merchant Column Header */}
                  <th
                    onClick={() => handleSort('merchant')}
                    className="p-3 cursor-pointer hover:text-deep-blue-950 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>Merchant</span>
                      {sortBy === 'merchant' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-deep-blue-500" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-deep-blue-500" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-deep-blue-300" />
                      )}
                    </div>
                  </th>

                  {/* Category Column Header */}
                  <th
                    onClick={() => handleSort('categoryId')}
                    className="p-3 cursor-pointer hover:text-deep-blue-950 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>Category</span>
                      {sortBy === 'categoryId' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-deep-blue-500" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-deep-blue-500" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-deep-blue-300" />
                      )}
                    </div>
                  </th>

                  <th className="p-3">Payment</th>

                  {/* Amount Column Header */}
                  <th
                    onClick={() => handleSort('amount')}
                    className="p-3 text-right cursor-pointer hover:text-deep-blue-950 dark:hover:text-white"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Amount</span>
                      {sortBy === 'amount' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-deep-blue-500" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-deep-blue-500" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-deep-blue-300" />
                      )}
                    </div>
                  </th>

                  <th className="p-3 text-center">Receipt</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-cream-100 dark:divide-dark-border">
                {transactions.map((tx) => {
                  const cat = catMap.get(tx.categoryId);
                  const isSelected = selectedIds.includes(tx.id);
                  const needsReview = tx.confidence !== undefined && tx.confidence < 0.7;

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-cream-50/70 dark:hover:bg-dark-elevated/40 transition-colors group ${
                        isSelected ? 'bg-sky-50/60 dark:bg-dark-elevated' : ''
                      } ${needsReview ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(tx.id)}
                          className="rounded text-deep-blue-500 focus:ring-sky-400"
                        />
                      </td>

                      {/* Date */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-deep-blue-900 dark:text-cream-100">
                            {formatRelativeDate(tx.date)}
                          </span>
                          <span className="text-[10px] text-deep-blue-500/70 font-mono">
                            {tx.date.slice(0, 10)}
                          </span>
                        </div>
                      </td>

                      {/* Merchant & Badges */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-xs"
                            style={{ backgroundColor: cat?.color || '#16587B' }}
                          >
                            {tx.merchant.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-deep-blue-900 dark:text-cream-100">
                                {tx.merchant}
                              </span>

                              {tx.recurringId && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-deep-blue-50 dark:bg-deep-blue-950 text-deep-blue-700 dark:text-cream-300 font-mono font-bold flex items-center gap-1">
                                  <Repeat className="w-2.5 h-2.5" />
                                  <span>Recurring</span>
                                </span>
                              )}

                              {tx.source === 'quick_add' && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 dark:bg-dark-elevated text-deep-blue-700 dark:text-cream-300 font-semibold">
                                  Quick
                                </span>
                              )}

                              {needsReview && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 font-bold flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Review ({Math.round((tx.confidence || 0) * 100)}%)</span>
                                </span>
                              )}
                            </div>

                            {/* Notes and tags */}
                            {(tx.notes || (tx.tags && tx.tags.length > 0)) && (
                              <div className="flex items-center gap-1.5 text-[11px] text-deep-blue-600/70 dark:text-cream-400 mt-0.5">
                                {tx.notes && (
                                  <span className="italic truncate max-w-xs">{tx.notes}</span>
                                )}
                                {tx.tags &&
                                  tx.tags.slice(0, 2).map((t) => (
                                    <span
                                      key={t}
                                      className="font-mono text-[10px] px-1 rounded bg-cream-100 dark:bg-dark-border"
                                    >
                                      #{t}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-3 whitespace-nowrap">
                        {cat ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="font-medium text-deep-blue-900 dark:text-cream-100">
                              {cat.name}
                            </span>
                            <CategoryTypeBadge type={cat.type} />
                          </div>
                        ) : (
                          <span className="text-deep-blue-400 italic">Uncategorized</span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="p-3 whitespace-nowrap uppercase font-mono text-[11px] text-deep-blue-700 dark:text-cream-300">
                        {tx.paymentMethod}
                      </td>

                      {/* Amount */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className="font-bold tabular-nums text-sm text-deep-blue-950 dark:text-cream-100">
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>

                      {/* Receipt Thumbnail */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {tx.receiptImage ? (
                          <button
                            onClick={() => setPreviewReceiptUrl(tx.receiptImage!)}
                            className="p-1 rounded-lg hover:bg-cream-200 dark:hover:bg-dark-elevated text-deep-blue-600 dark:text-cream-300 transition-colors"
                            title="View receipt photo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-deep-blue-300 dark:text-cream-400/40">—</span>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {needsReview && (
                            <button
                              onClick={() => handleApproveTransaction(tx)}
                              className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1 transition-colors"
                              title="Confirm categorization"
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>Accept</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEditingTransaction(tx);
                              setIsAddEditOpen(true);
                            }}
                            title="Edit transaction"
                            className="p-1.5 rounded-lg text-deep-blue-500 hover:bg-cream-200 dark:hover:bg-dark-elevated transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteTransaction(tx)}
                            title="Delete transaction (with 5s undo)"
                            className="p-1.5 rounded-lg text-deep-blue-400 hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        categories={categories}
        onClearSelection={() => setSelectedIds([])}
        onBulkChangeCategory={handleBulkChangeCategory}
        onBulkChangePaymentMethod={handleBulkChangePaymentMethod}
        onBulkDelete={handleBulkDelete}
      />

      {/* 5-Second Undo Toast */}
      {showUndoToast && lastDeletedTx && (
        <UndoToast
          merchant={lastDeletedTx.merchant}
          amount={lastDeletedTx.amount}
          onUndo={handleUndoDelete}
          onDismiss={() => {
            setShowUndoToast(false);
            setLastDeletedTx(null);
          }}
          durationSeconds={5}
        />
      )}

      {/* Receipt Preview Lightbox Modal */}
      {previewReceiptUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-blue-950/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setPreviewReceiptUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-white dark:bg-dark-surface p-2 rounded-2xl shadow-modal overflow-hidden">
            <button
              onClick={() => setPreviewReceiptUrl(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-deep-blue-950/80 text-white hover:bg-black transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewReceiptUrl}
              alt="Receipt preview"
              className="max-h-[85vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Add / Edit Transaction Modal */}
      <TransactionModal
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false);
          setEditingTransaction(null);
        }}
        categories={categories}
        initialData={editingTransaction}
        onSave={handleSaveTransaction}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        existingTransactions={transactions}
        onImportComplete={loadData}
      />

      {/* Categories & 50/30/20 Manager Modal */}
      <CategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        categories={categories}
        onUpdated={loadData}
      />

      {/* Learned Rules Manager Modal */}
      <RulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        categories={categories}
        onRulesChanged={loadData}
      />

      {/* Recurring Templates Manager Modal */}
      <RecurringModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        categories={categories}
        onUpdated={loadData}
      />

      {/* Rule Learning Prompt Dialog */}
      <RuleLearningModal
        isOpen={ruleLearnData.isOpen}
        merchant={ruleLearnData.merchant}
        categoryName={ruleLearnData.categoryName}
        affectedCount={ruleLearnData.affectedCount}
        onConfirm={handleConfirmRuleLearning}
        onCancel={() => setRuleLearnData((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
