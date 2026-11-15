import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp, X } from 'lucide-react';
import { BudgetAlert } from '@/lib/budget';

interface BudgetAlertBannerProps {
  alerts: BudgetAlert[];
}

export const BudgetAlertBanner: React.FC<BudgetAlertBannerProps> = ({ alerts }) => {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!alerts.length || dismissed) return null;

  // Highest severity alert
  const hasDanger = alerts.some((a) => a.level === 'danger');
  const hasWarning = alerts.some((a) => a.level === 'warning');

  const mainLevel = hasDanger ? 'danger' : hasWarning ? 'warning' : 'info';

  const containerBg =
    mainLevel === 'danger'
      ? 'bg-status-danger-bg border-status-danger/30 text-deep-blue-900 dark:bg-status-danger/10 dark:border-status-danger/40 dark:text-cream-100'
      : mainLevel === 'warning'
      ? 'bg-status-warning-bg border-status-warning/30 text-deep-blue-900 dark:bg-status-warning/10 dark:border-status-warning/40 dark:text-cream-100'
      : 'bg-deep-blue-50 border-deep-blue-200 text-deep-blue-900 dark:bg-deep-blue-950/40 dark:border-deep-blue-800 dark:text-cream-100';

  const iconColor =
    mainLevel === 'danger'
      ? 'text-status-danger'
      : mainLevel === 'warning'
      ? 'text-status-warning'
      : 'text-deep-blue-600 dark:text-cream-100';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition-all ${containerBg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg bg-white/70 dark:bg-dark-surface/80 ${iconColor}`}>
            {mainLevel === 'danger' ? (
              <AlertCircle className="w-5 h-5" />
            ) : mainLevel === 'warning' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="font-bold text-sm text-deep-blue-900 dark:text-cream-100">
              {hasDanger
                ? `Budget Limit Exceeded (${alerts.filter((a) => a.level === 'danger').length} warning${alerts.filter((a) => a.level === 'danger').length > 1 ? 's' : ''})`
                : hasWarning
                ? `Budget Threshold Warning (${alerts.length} active notification${alerts.length > 1 ? 's' : ''})`
                : `Budget Milestone Checkpoint (${alerts.length} active notification${alerts.length > 1 ? 's' : ''})`}
            </div>
            <div className="text-xs text-deep-blue-700 dark:text-cream-200 mt-0.5">
              {alerts[0]?.message}
              {alerts.length > 1 && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="ml-2 font-semibold underline text-deep-blue-800 dark:text-cream-100 hover:text-deep-blue-900"
                >
                  +{alerts.length - 1} more alert{alerts.length > 2 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {alerts.length > 1 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-deep-blue-700 dark:text-cream-200 transition-colors"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-deep-blue-700 dark:text-cream-200 transition-colors"
            title="Dismiss alerts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && alerts.length > 1 && (
        <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 space-y-1.5">
          {alerts.map((alert) => (
            <div key={alert.id} className="text-xs flex items-center justify-between text-deep-blue-800 dark:text-cream-200">
              <span className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    alert.level === 'danger'
                      ? 'bg-status-danger'
                      : alert.level === 'warning'
                      ? 'bg-status-warning'
                      : 'bg-deep-blue-500'
                  }`}
                />
                {alert.message}
              </span>
              <span className="font-semibold tabular-nums text-deep-blue-900 dark:text-cream-100">
                {alert.percentUsed.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
