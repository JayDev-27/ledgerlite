import React from 'react';
import clsx from 'clsx';
import { CategoryType } from '@/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'need' | 'want' | 'savings' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className,
}) => {
  const variantStyles = {
    need: 'bg-deep-blue-50 text-deep-blue-700 border-deep-blue-200 dark:bg-deep-blue-950 dark:text-cream-200 dark:border-deep-blue-800',
    want: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
    savings: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
    success: 'bg-status-success-bg text-status-success border-status-success/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
    warning: 'bg-status-warning-bg text-status-warning border-status-warning/20 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
    danger: 'bg-status-danger-bg text-status-danger border-status-danger/20 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
    info: 'bg-sky-50 text-deep-blue-600 border-sky-200 dark:bg-sky-950/40 dark:text-cream-200 dark:border-sky-800/40',
    neutral: 'bg-cream-200/60 text-deep-blue-800 border-cream-300 dark:bg-dark-elevated dark:text-cream-300 dark:border-dark-border',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-medium rounded-full border tracking-wide uppercase',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

export const CategoryTypeBadge: React.FC<{ type: CategoryType; className?: string }> = ({
  type,
  className,
}) => {
  const labels: Record<CategoryType, string> = {
    need: 'Need (50%)',
    want: 'Want (30%)',
    savings: 'Savings (20%)',
  };

  return (
    <Badge variant={type} size="sm" className={className}>
      {labels[type]}
    </Badge>
  );
};
