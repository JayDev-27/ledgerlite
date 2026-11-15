import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  GitMerge,
  Tag,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { Category, CategoryType } from '@/types';
import { repository } from '@/data/repository';

interface CategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onUpdated: () => void;
}

export const CategoriesModal: React.FC<CategoriesModalProps> = ({
  isOpen,
  onClose,
  categories,
  onUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | CategoryType>('all');
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  // Add / Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<CategoryType>('need');
  const [formColor, setFormColor] = useState('#16587B');
  const [formParentId, setFormParentId] = useState<string | null>(null);

  // Merge State
  const [isMerging, setIsMerging] = useState(false);
  const [sourceMergeId, setSourceMergeId] = useState('');
  const [targetMergeId, setTargetMergeId] = useState('');

  if (!isOpen) return null;

  const parentCategories = categories.filter((c) => !c.parentId);
  const filteredParents =
    activeTab === 'all'
      ? parentCategories
      : parentCategories.filter((c) => c.type === activeTab);

  const toggleExpand = (id: string) => {
    setExpandedParents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartAdd = (parentId: string | null = null) => {
    setIsEditing(true);
    setEditingCatId(null);
    setFormParentId(parentId);
    setFormName('');
    if (parentId) {
      const parent = categories.find((c) => c.id === parentId);
      setFormType(parent?.type || 'need');
      setFormColor(parent?.color || '#16587B');
    } else {
      setFormType('need');
      setFormColor('#16587B');
    }
  };

  const handleStartEdit = (cat: Category) => {
    setIsEditing(true);
    setEditingCatId(cat.id);
    setFormParentId(cat.parentId || null);
    setFormName(cat.name);
    setFormType(cat.type);
    setFormColor(cat.color);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingCatId) {
      // Update
      await repository.updateCategory(editingCatId, {
        name: formName.trim(),
        type: formType,
        color: formColor,
      });
    } else {
      // Create
      const newCat: Category = {
        id: `cat_${Date.now()}`,
        name: formName.trim(),
        parentId: formParentId,
        type: formType,
        color: formColor,
        icon: formParentId ? 'Tag' : 'Folder',
        order: categories.length + 1,
      };
      await repository.createCategory(newCat);
    }

    setIsEditing(false);
    onUpdated();
  };

  const handleDeleteCategory = async (cat: Category) => {
    const isParent = !cat.parentId;
    const promptMsg = isParent
      ? `Delete category "${cat.name}"? All subcategories will be deleted and transactions reassigned to Miscellaneous.`
      : `Delete subcategory "${cat.name}"?`;

    if (window.confirm(promptMsg)) {
      await repository.deleteCategory(cat.id, 'cat_misc');
      onUpdated();
    }
  };

  const handleExecuteMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceMergeId || !targetMergeId || sourceMergeId === targetMergeId) {
      alert('Please select two distinct categories to merge.');
      return;
    }

    const source = categories.find((c) => c.id === sourceMergeId);
    const target = categories.find((c) => c.id === targetMergeId);

    if (
      window.confirm(
        `Merge "${source?.name}" into "${target?.name}"? All transactions and subcategories will be moved to "${target?.name}".`
      )
    ) {
      await repository.mergeCategories(sourceMergeId, targetMergeId);
      setIsMerging(false);
      setSourceMergeId('');
      setTargetMergeId('');
      onUpdated();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="categories-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-blue-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-dark-surface rounded-modal border border-cream-200 dark:border-dark-border shadow-modal overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 dark:border-dark-border">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-deep-blue-600 dark:text-cream-300" />
            <div>
              <h3 id="categories-modal-title" className="font-bold text-base text-deep-blue-950 dark:text-cream-100">
                Categories & 50/30/20 Taxonomy
              </h3>
              <p className="text-xs text-deep-blue-700/70 dark:text-cream-400">
                Manage 2-level categories, Need/Want/Savings tags, and mergers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-cream-100 dark:border-dark-border bg-cream-50/50 dark:bg-dark-elevated/40">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'need', label: 'Needs (50%)' },
                { id: 'want', label: 'Wants (30%)' },
                { id: 'savings', label: 'Savings (20%)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-deep-blue-500 text-cream-100'
                    : 'text-deep-blue-700 dark:text-cream-300 hover:bg-cream-100 dark:hover:bg-dark-elevated'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMerging(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-cream-300 dark:border-dark-border text-deep-blue-800 dark:text-cream-200 text-xs font-semibold hover:bg-cream-100 dark:hover:bg-dark-elevated transition-colors"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Merge</span>
            </button>
            <button
              onClick={() => handleStartAdd(null)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Category</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Merge Form Panel */}
          {isMerging && (
            <form
              onSubmit={handleExecuteMerge}
              className="p-4 rounded-xl bg-sky-50 dark:bg-dark-elevated border border-sky-200 dark:border-dark-border space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-deep-blue-900 dark:text-cream-100">
                  Merge Two Categories:
                </span>
                <button
                  type="button"
                  onClick={() => setIsMerging(false)}
                  className="text-deep-blue-600 hover:text-deep-blue-900 dark:text-cream-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Source (Will be deleted):</label>
                  <select
                    value={sourceMergeId}
                    onChange={(e) => setSourceMergeId(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border"
                  >
                    <option value="">-- Choose Category --</option>
                    {parentCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Target (Will keep all transactions):</label>
                  <select
                    value={targetMergeId}
                    onChange={(e) => setTargetMergeId(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border"
                  >
                    <option value="">-- Choose Category --</option>
                    {parentCategories
                      .filter((c) => c.id !== sourceMergeId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsMerging(false)}
                  className="px-3 py-1 text-xs rounded-lg hover:bg-cream-200/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-white text-xs font-bold"
                >
                  Confirm Merge
                </button>
              </div>
            </form>
          )}

          {/* Add / Edit Form Panel */}
          {isEditing && (
            <form
              onSubmit={handleSaveCategory}
              className="p-4 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-deep-blue-900 dark:text-cream-100">
                  {editingCatId ? 'Edit Category' : formParentId ? 'Add Subcategory' : 'Add Category'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-deep-blue-600 hover:text-deep-blue-900 dark:text-cream-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Subscriptions, Groceries"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border text-deep-blue-900 dark:text-cream-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <span className="font-mono text-[11px]">{formColor}</span>
                  </div>
                </div>

                {!formParentId && (
                  <div>
                    <label className="block font-semibold mb-1">Taxonomy Type *</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as CategoryType)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-surface border border-cream-300 dark:border-dark-border uppercase"
                    >
                      <option value="need">Need (50%)</option>
                      <option value="want">Want (30%)</option>
                      <option value="savings">Savings (20%)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-xs rounded-lg hover:bg-cream-200/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-white text-xs font-bold"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* Categories List */}
          <div className="divide-y divide-cream-100 dark:divide-dark-border">
            {filteredParents.map((parent) => {
              const subcats = categories.filter((c) => c.parentId === parent.id);
              const isExpanded = !!expandedParents[parent.id];

              return (
                <div key={parent.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-cream-50/80 dark:hover:bg-dark-elevated/40 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={() => toggleExpand(parent.id)}
                        className="p-0.5 text-deep-blue-600 dark:text-cream-400 hover:text-deep-blue-900"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <div
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: parent.color }}
                      />

                      <span className="font-semibold text-xs text-deep-blue-900 dark:text-cream-100 truncate">
                        {parent.name}
                      </span>

                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          parent.type === 'need'
                            ? 'bg-sky-100 text-deep-blue-700 dark:bg-sky-950 dark:text-sky-300'
                            : parent.type === 'want'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {parent.type}
                      </span>

                      <span className="text-[11px] text-deep-blue-400 font-mono">
                        ({subcats.length} sub)
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartAdd(parent.id)}
                        title="Add subcategory"
                        className="p-1 rounded text-deep-blue-600 hover:bg-cream-200 dark:hover:bg-dark-border"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleStartEdit(parent)}
                        title="Edit category"
                        className="p-1 rounded text-deep-blue-600 hover:bg-cream-200 dark:hover:bg-dark-border"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(parent)}
                        title="Delete category"
                        className="p-1 rounded text-status-danger hover:bg-status-danger-bg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Subcategories */}
                  {isExpanded && (
                    <div className="pl-9 pr-2 space-y-1 py-1">
                      {subcats.length === 0 ? (
                        <div className="text-[11px] italic text-deep-blue-400 py-1">
                          No subcategories yet.
                        </div>
                      ) : (
                        subcats.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-cream-50 dark:hover:bg-dark-elevated text-xs transition-colors"
                          >
                            <span className="text-deep-blue-800 dark:text-cream-200 truncate">
                              {sub.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(sub)}
                                title="Edit subcategory"
                                className="p-1 rounded text-deep-blue-500 hover:bg-cream-200 dark:hover:bg-dark-border"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(sub)}
                                title="Delete subcategory"
                                className="p-1 rounded text-status-danger hover:bg-status-danger-bg"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
