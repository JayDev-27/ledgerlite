import React, { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  SlidersHorizontal,
} from 'lucide-react';
import { PeriodType, PeriodRange } from '@/lib/periods';

interface DashboardPeriodToolbarProps {
  currentPeriod: PeriodRange;
  periodType: PeriodType;
  onPeriodTypeChange: (type: PeriodType) => void;
  onPrevious: () => void;
  onNext: () => void;
  compareWithPrior: boolean;
  onToggleCompare: (enabled: boolean) => void;
  onCustomRangeSubmit: (startDate: string, endDate: string) => void;
}

const PERIOD_TYPES: Array<{ type: PeriodType; label: string }> = [
  { type: 'day', label: 'Day' },
  { type: 'week', label: 'Week' },
  { type: 'month', label: 'Month' },
  { type: 'quarter', label: 'Quarter' },
  { type: 'half-year', label: 'Half-year' },
  { type: 'year', label: 'Year' },
  { type: 'custom', label: 'Custom' },
];

export const DashboardPeriodToolbar: React.FC<DashboardPeriodToolbarProps> = ({
  currentPeriod,
  periodType,
  onPeriodTypeChange,
  onPrevious,
  onNext,
  compareWithPrior,
  onToggleCompare,
  onCustomRangeSubmit,
}) => {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(currentPeriod.startDate);
  const [customEnd, setCustomEnd] = useState(currentPeriod.endDate);

  const handleCustomApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      onCustomRangeSubmit(customStart, customEnd);
      setShowCustomModal(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-surface p-4 rounded-3xl border border-cream-200 dark:border-dark-border shadow-sm space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Period Type Pills */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-cream-100 dark:bg-dark-elevated rounded-2xl">
          {PERIOD_TYPES.map(({ type, label }) => {
            const isActive = periodType === type;
            return (
              <button
                key={type}
                onClick={() => {
                  if (type === 'custom') {
                    setShowCustomModal(true);
                  }
                  onPeriodTypeChange(type);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-deep-blue-500 text-white shadow-sm'
                    : 'text-deep-blue-800 dark:text-cream-200 hover:text-deep-blue-900 dark:hover:text-cream-100 hover:bg-cream-200/60 dark:hover:bg-dark-border'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Date Stepper & Comparison Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Stepper with current label */}
          <div className="flex items-center bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border rounded-2xl p-1">
            <button
              onClick={onPrevious}
              className="p-1.5 rounded-xl text-deep-blue-700 dark:text-cream-200 hover:bg-cream-200/70 dark:hover:bg-dark-border transition-colors"
              title="Previous Period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-deep-blue-500 dark:text-cream-200" />
              <span className="text-xs font-bold text-deep-blue-900 dark:text-cream-100 whitespace-nowrap">
                {currentPeriod.label}
              </span>
            </div>

            <button
              onClick={onNext}
              className="p-1.5 rounded-xl text-deep-blue-700 dark:text-cream-200 hover:bg-cream-200/70 dark:hover:bg-dark-border transition-colors"
              title="Next Period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Prior period comparison toggle switch */}
          <button
            onClick={() => onToggleCompare(!compareWithPrior)}
            className={`px-3 py-1.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all ${
              compareWithPrior
                ? 'bg-deep-blue-50 border-deep-blue-300 text-deep-blue-700 dark:bg-dark-elevated dark:border-deep-blue-500 dark:text-cream-100'
                : 'bg-white dark:bg-dark-surface border-cream-200 dark:border-dark-border text-deep-blue-600 dark:text-cream-300 hover:bg-cream-50'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Prior Period</span>
            <span
              className={`w-2 h-2 rounded-full ${
                compareWithPrior ? 'bg-status-success' : 'bg-cream-400 dark:bg-dark-border'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Custom Date Range Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-surface rounded-3xl border border-cream-200 dark:border-dark-border w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-deep-blue-900 dark:text-cream-100 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-deep-blue-500 dark:text-cream-200" />
                Select Custom Date Range
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-xs text-deep-blue-600 dark:text-cream-300 hover:text-deep-blue-900"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCustomApply} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-deep-blue-800 dark:text-cream-200 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-cream-300 dark:border-dark-border bg-white dark:bg-dark-surface text-deep-blue-900 dark:text-cream-100 font-bold text-xs focus:ring-2 focus:ring-deep-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-deep-blue-800 dark:text-cream-200 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-cream-300 dark:border-dark-border bg-white dark:bg-dark-surface text-deep-blue-900 dark:text-cream-100 font-bold text-xs focus:ring-2 focus:ring-deep-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-deep-blue-700 dark:text-cream-200 hover:bg-cream-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-deep-blue-500 text-white hover:bg-deep-blue-600 shadow-sm"
                >
                  Apply Range
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
