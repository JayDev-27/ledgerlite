import React, { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, PieChart, MessageSquareText, Plus, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useUiStore } from '@/store/uiStore';

const TABS: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/transactions', label: 'Ledger', icon: ArrowLeftRight },
  { to: '/app/budgets', label: 'Budgets', icon: PieChart },
  { to: '/app/assistant', label: 'Assistant', icon: MessageSquareText },
];

/** Floating liquid-glass tab bar (phones). The active capsule glides between tabs. */
export const MobileTabs: React.FC = () => {
  const { openQuickAdd } = useUiStore();
  const { pathname } = useLocation();
  const barRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  useLayoutEffect(() => {
    const measure = () => {
      const el = barRef.current?.querySelector<HTMLElement>('a[aria-current="page"]');
      setBox(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (barRef.current) ro.observe(barRef.current);
    return () => ro.disconnect();
  }, [pathname]);
  useLayoutEffect(() => {
    if (box && !animate) requestAnimationFrame(() => setAnimate(true));
  }, [box, animate]);

  const tab = ({ to, label, icon: Icon, end }: (typeof TABS)[number]) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      viewTransition
      className={({ isActive }) =>
        clsx(
          'relative flex-1 h-12 flex flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium transition-colors',
          isActive ? 'text-deep-blue-950 dark:text-white' : 'text-deep-blue-900/50 dark:text-white/45'
        )
      }
    >
      {() => (
        <>
          <Icon className="relative w-[18px] h-[18px]" strokeWidth={1.75} />
          <span className="relative">{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <nav
      aria-label="Main"
      className="mobile-tabs md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-md flex items-center gap-2">
        <div ref={barRef} className="liquid-glass flex-1 flex items-center p-1 rounded-full">
          <span
            aria-hidden="true"
            className={clsx(
              'absolute left-0 top-1 bottom-1 rounded-full bg-white shadow-sm dark:bg-transparent dark:liquid-glass-thin pointer-events-none',
              animate && 'transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none'
            )}
            style={{ width: box?.w ?? 0, transform: `translate3d(${box?.x ?? 0}px, 0, 0)`, opacity: box ? 1 : 0 }}
          />
          {TABS.map(tab)}
        </div>
        <button
          onClick={openQuickAdd}
          aria-label="Log expense"
          className="liquid-glass grid place-items-center w-14 h-14 rounded-full text-deep-blue-950 dark:text-white active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" strokeWidth={2} />
        </button>
      </div>
    </nav>
  );
};
