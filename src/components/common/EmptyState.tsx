import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  className?: string;
  children?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  className,
  children,
}) => {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-card bg-white/60 dark:bg-dark-surface/60 border border-dashed border-cream-300 dark:border-dark-border',
        className
      )}
    >
      <div className="w-14 h-14 rounded-full bg-sky-100 dark:bg-dark-elevated text-deep-blue-600 dark:text-cream-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7" />
      </div>

      <h3 className="text-lg font-semibold text-deep-blue-900 dark:text-cream-100 mb-1.5">
        {title}
      </h3>

      <p className="text-sm text-deep-blue-700/70 dark:text-cream-300 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 font-medium text-sm transition-colors shadow-sm dark:bg-white dark:text-black dark:hover:bg-cream-200"
        >
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          {actionLabel}
        </button>
      )}

      {children}
    </div>
  );
};
