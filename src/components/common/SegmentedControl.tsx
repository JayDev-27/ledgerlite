import React, { useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  wrap?: boolean;
  className?: string;
}

/**
 * Apple-style segmented control: a single glass thumb glides between options
 * on a spring curve (it is measured, so it also flows across wrapped rows).
 * Arrow keys move the selection, as in native controls.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  wrap = false,
  className,
}: SegmentedControlProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef(new Map<T, HTMLButtonElement>());
  const [thumb, setThumb] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const el = btnRefs.current.get(value);
      if (!el) return setThumb(null);
      setThumb({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, [value, options.length]);

  // Skip the very first placement so the thumb doesn't fly in from 0,0.
  useLayoutEffect(() => {
    if (thumb && !animate) requestAnimationFrame(() => setAnimate(true));
  }, [thumb, animate]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length]!;
    onChange(next.value);
    btnRefs.current.get(next.value)?.focus();
  };

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={clsx(
        'relative flex items-center gap-0.5 p-1 rounded-2xl bg-cream-200/60 dark:bg-black/30 ring-1 ring-inset ring-black/5 dark:ring-white/[0.06]',
        wrap ? 'flex-wrap' : 'overflow-x-auto',
        className
      )}
    >
      {thumb && (
        <span
          aria-hidden="true"
          className={clsx(
            'absolute left-0 top-0 rounded-xl bg-white shadow-sm dark:bg-transparent dark:liquid-glass-thin',
            animate && 'transition-[transform,width,height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none'
          )}
          style={{ width: thumb.w, height: thumb.h, transform: `translate3d(${thumb.x}px, ${thumb.y}px, 0)` }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              if (el) btnRefs.current.set(o.value, el);
              else btnRefs.current.delete(o.value);
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={clsx(
              'relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition-colors duration-300',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3.5 text-[13px]',
              active
                ? 'text-deep-blue-950 dark:text-white'
                : 'text-deep-blue-900/55 hover:text-deep-blue-950 dark:text-white/45 dark:hover:text-white/80'
            )}
          >
            {o.icon}
            {o.label}
            {o.badge}
          </button>
        );
      })}
    </div>
  );
}
