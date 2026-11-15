import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Plus,
  Check,
  X,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { repository } from '@/data/repository';
import type { MemoryItem, MemoryKind } from '@/types';

interface MemoryManagerProps {
  onMemoryChanged?: () => void;
}

const MEMORY_KINDS: Array<{ value: MemoryKind; label: string; description: string }> = [
  { value: 'goal', label: 'Financial Goal', description: 'e.g. Saving ₹80,000 for MacBook by Diwali' },
  { value: 'preference', label: 'Preference', description: 'e.g. Always keep 6 months emergency fund in liquid assets' },
  { value: 'income', label: 'Income & Inflow', description: 'e.g. Monthly take-home salary is ₹1,65,000 on the 1st' },
  { value: 'recurring_fact', label: 'Recurring Fact', description: 'e.g. Apartment maintenance of ₹4,200 due quarterly' },
  { value: 'note', label: 'General Note', description: 'e.g. Planning to reduce dining out during weekdays' },
];

export const MemoryManager: React.FC<MemoryManagerProps> = ({ onMemoryChanged }) => {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [newKind, setNewKind] = useState<MemoryKind>('goal');
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const loadMemories = async () => {
    try {
      const all = await repository.getMemoryItems(false);
      setItems(all);
    } catch (e) {
      console.error('Failed to load memory items:', e);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    await repository.createMemoryItem({
      kind: newKind,
      text: newText.trim(),
      approvedAt: new Date().toISOString(), // User-created is auto-approved
    });

    setNewText('');
    setIsAdding(false);
    await loadMemories();
    onMemoryChanged?.();
  };

  const handleApprove = async (id: string) => {
    await repository.approveMemoryItem(id);
    await loadMemories();
    onMemoryChanged?.();
  };

  const handleRejectOrDelete = async (id: string) => {
    await repository.deleteMemoryItem(id);
    await loadMemories();
    onMemoryChanged?.();
  };

  const handleStartEdit = (item: MemoryItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) return;
    await repository.updateMemoryItem(id, { text: editText.trim() });
    setEditingId(null);
    await loadMemories();
    onMemoryChanged?.();
  };

  const pendingCount = items.filter((i) => !i.approvedAt).length;

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !item.approvedAt;
    return item.kind === filter;
  });

  return (
    <div className="space-y-4">
      {/* Header bar with filter tabs & Add CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-deep-blue-500 text-cream-100 flex items-center justify-center">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-deep-blue-950 dark:text-cream-100">
              Long-Term Financial Memory Vault
            </h3>
            <p className="text-xs text-deep-blue-700/70 dark:text-cream-400">
              {items.length} total facts • {pendingCount} pending confirmation
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isAdding ? 'Cancel' : 'Add Memory Fact'}</span>
        </button>
      </div>

      {/* Add Memory Form */}
      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border space-y-3 animate-fadeIn"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-deep-blue-900 dark:text-cream-100">
            <Sparkles className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
            <span>Store Permanent Financial Context</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-deep-blue-800 dark:text-cream-200 mb-1">
                Context Category
              </label>
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as MemoryKind)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-deep-blue-400"
              >
                {MEMORY_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-deep-blue-800 dark:text-cream-200 mb-1">
                Statement / Memory Text
              </label>
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder={MEMORY_KINDS.find((k) => k.value === newKind)?.description}
                className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-deep-blue-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-lg border border-cream-300 dark:border-dark-border text-xs text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newText.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 disabled:opacity-40 text-cream-100 text-xs font-semibold"
            >
              Save Memory
            </button>
          </div>
        </form>
      )}

      {/* Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full font-medium transition-colors ${
            filter === 'all'
              ? 'bg-deep-blue-500 text-cream-100'
              : 'bg-cream-100 dark:bg-dark-elevated text-deep-blue-800 dark:text-cream-300 hover:bg-cream-200'
          }`}
        >
          All ({items.length})
        </button>

        {pendingCount > 0 && (
          <button
            onClick={() => setFilter('pending')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-amber-600 text-cream-100'
                : 'bg-amber-50 dark:bg-dark-elevated text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-dark-border hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Pending Review ({pendingCount})</span>
          </button>
        )}

        {MEMORY_KINDS.map((k) => {
          const count = items.filter((i) => i.kind === k.value).length;
          return (
            <button
              key={k.value}
              onClick={() => setFilter(k.value)}
              className={`px-3 py-1 rounded-full font-medium transition-colors flex-shrink-0 ${
                filter === k.value
                  ? 'bg-deep-blue-500 text-cream-100'
                  : 'bg-cream-100 dark:bg-dark-elevated text-deep-blue-800 dark:text-cream-300 hover:bg-cream-200'
              }`}
            >
              {k.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Memories List */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border text-xs text-deep-blue-600 dark:text-cream-400">
            No memories found matching this category.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isPending = !item.approvedAt;
            const isEditing = editingId === item.id;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all text-xs ${
                  isPending
                    ? 'bg-amber-50/60 dark:bg-dark-elevated border-amber-300/60 dark:border-amber-500/30'
                    : 'bg-white dark:bg-dark-surface border-cream-200 dark:border-dark-border'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono uppercase text-[10px] tracking-wider px-2 py-0.5 rounded font-bold bg-cream-100 dark:bg-dark-elevated text-deep-blue-800 dark:text-cream-300">
                      {item.kind.replace('_', ' ')}
                    </span>

                    {isPending ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                        <Clock className="w-3 h-3" />
                        <span>Proposed by Assistant (Needs Approval)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Approved</span>
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => (isEditing ? handleSaveEdit(item.id) : handleStartEdit(item))}
                          className="p-1 rounded text-deep-blue-500 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated"
                          title={isEditing ? 'Save text' : 'Edit proposal text'}
                        >
                          {isEditing ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Edit2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleApprove(item.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-cream-100 text-[11px] font-semibold transition-colors"
                          title="Approve memory"
                        >
                          <Check className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleRejectOrDelete(item.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-status-danger hover:bg-red-700 text-cream-100 text-[11px] font-semibold transition-colors"
                          title="Reject proposal"
                        >
                          <X className="w-3 h-3" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => (isEditing ? handleSaveEdit(item.id) : handleStartEdit(item))}
                          className="p-1 rounded text-deep-blue-500 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated"
                          title={isEditing ? 'Save' : 'Edit'}
                        >
                          {isEditing ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Edit2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleRejectOrDelete(item.id)}
                          className="p-1 rounded text-deep-blue-400 hover:text-status-danger hover:bg-status-danger-bg"
                          title="Delete memory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Content */}
                {isEditing ? (
                  <div className="space-y-2 mt-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded bg-cream-50 dark:bg-dark-elevated border border-deep-blue-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-0.5 rounded text-[11px] text-deep-blue-600 hover:bg-cream-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        className="px-2.5 py-0.5 rounded text-[11px] bg-deep-blue-500 text-cream-100 font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-deep-blue-900 dark:text-cream-100 text-xs sm:text-sm leading-relaxed">
                    {item.text}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
