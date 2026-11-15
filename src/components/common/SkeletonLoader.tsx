import React from 'react';
import clsx from 'clsx';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'card' | 'text' | 'circle' | 'table-row' | 'kpi';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className,
  variant = 'card',
  count = 1,
}) => {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'circle') {
    return (
      <div
        className={clsx(
          'w-10 h-10 rounded-full bg-cream-200 dark:bg-dark-elevated animate-pulse',
          className
        )}
      />
    );
  }

  if (variant === 'text') {
    return (
      <div className="space-y-2 w-full">
        {items.map((i) => (
          <div
            key={i}
            className={clsx(
              'h-4 rounded bg-cream-200 dark:bg-dark-elevated animate-pulse',
              i === items.length - 1 && items.length > 1 ? 'w-2/3' : 'w-full',
              className
            )}
          />
        ))}
      </div>
    );
  }

  if (variant === 'kpi') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((i) => (
          <div
            key={i}
            className="p-5 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border animate-pulse"
          >
            <div className="h-3 w-24 bg-cream-200 dark:bg-dark-elevated rounded mb-3" />
            <div className="h-7 w-36 bg-cream-300 dark:bg-dark-elevated rounded mb-2" />
            <div className="h-3 w-20 bg-cream-200 dark:bg-dark-elevated rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <div className="space-y-3 w-full">
        {items.map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cream-200 dark:bg-dark-elevated" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-cream-200 dark:bg-dark-elevated rounded" />
                <div className="h-3 w-20 bg-cream-100 dark:bg-dark-border rounded" />
              </div>
            </div>
            <div className="h-5 w-24 bg-cream-200 dark:bg-dark-elevated rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border animate-pulse',
        className
      )}
    >
      <div className="h-4 w-1/3 bg-cream-200 dark:bg-dark-elevated rounded mb-4" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-cream-100 dark:bg-dark-border rounded" />
        <div className="h-3 w-4/5 bg-cream-100 dark:bg-dark-border rounded" />
      </div>
    </div>
  );
};
