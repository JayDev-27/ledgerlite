import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Plus,
  CreditCard,
  Trash2,
  Calendar,
} from 'lucide-react';
import { repository } from '@/data/repository';
import { Transaction, Category, PaymentMethod } from '@/types';
import { formatCurrency, formatRelativeDate } from '@/lib/formatters';
import { CategoryTypeBadge } from '@/components/common/Badge';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { useUiStore } from '@/store/uiStore';

export const TransactionsPage: React.FC = () => {
  const { openQuickAdd } = useUiStore();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const loadData = async () => {
    try {
      setLoading(true);
      const [cats, result] = await Promise.all([
        repository.getCategories(),
        repository.getTransactions(
          {
            search: searchQuery.trim() || undefined,
            categoryIds: selectedCategory !== 'all' ? [selectedCategory] : undefined,
            paymentMethods:
              selectedPayment !== 'all' ? [selectedPayment as PaymentMethod] : undefined,
          },
          { page, pageSize, sortBy: 'date', sortDirection: 'desc' }
        ),
      ]);

      setCategories(cats);
      setTransactions(result.data);
      setTotalCount(result.total);
    } catch (e) {
      console.error('Failed to load transactions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('transactions-updated', handleUpdate);
    return () => window.removeEventListener('transactions-updated', handleUpdate);
  }, [searchQuery, selectedCategory, selectedPayment, page]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const handleDelete = async (id: string, merchant: string) => {
    if (window.confirm(`Delete transaction from "${merchant}"?`)) {
      await repository.deleteTransaction(id);
      loadData();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Controls & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-deep-blue-500/60 dark:text-cream-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by merchant, note, or tag..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 placeholder:text-deep-blue-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
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

          <select
            value={selectedPayment}
            onChange={(e) => {
              setSelectedPayment(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <option value="all">All Payments</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="net_banking">Net Banking</option>
            <option value="cash">Cash</option>
          </select>

          <button
            onClick={openQuickAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold shadow-sm transition-all flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Transactions Table & List */}
      <div className="p-4 sm:p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
        <div className="flex items-center justify-between pb-4 border-b border-cream-100 dark:border-dark-border">
          <div className="text-xs font-medium text-deep-blue-700/80 dark:text-cream-300">
            Showing <span className="font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">{transactions.length}</span> of{' '}
            <span className="font-bold tabular-nums text-deep-blue-900 dark:text-cream-100">{totalCount}</span> transactions
          </div>

          {/* Pagination controls */}
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cream-200 dark:border-dark-border disabled:opacity-40 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-deep-blue-700 dark:text-cream-300 font-mono">
              Page {page} of {Math.ceil(totalCount / pageSize) || 1}
            </span>
            <button
              disabled={page * pageSize >= totalCount}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-cream-200 dark:border-dark-border disabled:opacity-40 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
            >
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-6">
            <SkeletonLoader variant="table-row" count={8} />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No matching transactions"
            description="Try modifying your search or filter keywords, or add a new expense."
            actionLabel="Add Transaction"
            onAction={openQuickAdd}
          />
        ) : (
          <div className="divide-y divide-cream-100 dark:divide-dark-border">
            {transactions.map((tx) => {
              const cat = catMap.get(tx.categoryId);
              return (
                <div
                  key={tx.id}
                  className="py-3 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-cream-50/50 dark:hover:bg-dark-elevated/40 px-2 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"
                      style={{ backgroundColor: cat?.color || '#16587B' }}
                    >
                      {tx.merchant.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-deep-blue-900 dark:text-cream-100 truncate">
                          {tx.merchant}
                        </span>
                        {tx.source === 'quick_add' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 dark:bg-dark-elevated text-deep-blue-700 dark:text-cream-300">
                            Quick
                          </span>
                        )}
                        {tx.recurringId && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-deep-blue-50 dark:bg-deep-blue-950 text-deep-blue-700 dark:text-cream-300">
                            Recurring
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-deep-blue-600/70 dark:text-cream-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatRelativeDate(tx.date)}
                        </span>
                        <span>•</span>
                        <span className="uppercase font-mono text-[10px]">{tx.paymentMethod}</span>
                        {cat && (
                          <>
                            <span>•</span>
                            <span className="truncate">{cat.name}</span>
                          </>
                        )}
                        {tx.notes && (
                          <>
                            <span className="hidden md:inline">•</span>
                            <span className="hidden md:inline italic truncate max-w-xs">{tx.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-bold text-sm tabular-nums text-deep-blue-950 dark:text-cream-100">
                        {formatCurrency(tx.amount)}
                      </div>
                      {cat && <CategoryTypeBadge type={cat.type} />}
                    </div>

                    <button
                      onClick={() => handleDelete(tx.id, tx.merchant)}
                      title="Delete expense"
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-deep-blue-400 hover:text-status-danger hover:bg-status-danger/10 transition-all"
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
  );
};
