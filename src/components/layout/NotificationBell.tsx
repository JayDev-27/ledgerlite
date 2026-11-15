import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import clsx from 'clsx';
import { useNotifications } from '@/store/notificationStore';

const DOT: Record<string, string> = {
  info: 'bg-deep-blue-400',
  action: 'bg-sky-400',
  warning: 'bg-amber-400',
};

export const NotificationBell: React.FC = () => {
  const { items, remove } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={items.length ? `Notifications, ${items.length} new` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative grid place-items-center w-9 h-9 rounded-xl text-deep-blue-900/50 hover:text-deep-blue-950 hover:bg-deep-blue-50/60 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.05] transition-colors"
      >
        <Bell className="w-4 h-4" strokeWidth={1.75} />
        {items.length > 0 && (
          <span
            className="absolute top-2 right-2 w-2 h-2 rounded-full bg-sky-400 ring-2 ring-cream-100 dark:ring-dark-bg"
            aria-hidden="true"
          />
        )}
      </button>

      <div
        role="dialog"
        aria-label="Notifications"
        className={clsx(
          'liquid-glass absolute right-0 top-11 w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-2 origin-top-right !bg-white/95 dark:!bg-[#141516]/[0.95]',
          'transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none invisible'
        )}
      >
        <p className="px-3 pt-2 pb-1 label-mono !text-[10px] text-deep-blue-900/40 dark:text-white/35">Notifications</p>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-deep-blue-900/50 dark:text-white/40">You’re all caught up.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((n) => (
              <li key={n.id} className="rounded-xl p-3 hover:bg-white/[0.04] transition-colors">
                <div className="flex items-start gap-3">
                  <span className={clsx('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', DOT[n.tone])} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-deep-blue-950 dark:text-white">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 text-[12px] leading-relaxed text-deep-blue-900/55 dark:text-white/50">{n.body}</p>
                    )}
                    {(n.primary || n.secondary) && (
                      <div className="mt-2.5 flex items-center gap-1.5">
                        {n.primary &&
                          (n.primary.to ? (
                            <Link
                              to={n.primary.to}
                              viewTransition
                              onClick={() => setOpen(false)}
                              className="h-7 px-3 inline-flex items-center rounded-lg text-[12px] font-medium bg-deep-blue-950 text-white dark:bg-white dark:text-black"
                            >
                              {n.primary.label}
                            </Link>
                          ) : (
                            <button
                              onClick={() => {
                                n.primary?.onClick?.();
                                setOpen(false);
                              }}
                              className="h-7 px-3 rounded-lg text-[12px] font-medium bg-deep-blue-950 text-white dark:bg-white dark:text-black"
                            >
                              {n.primary.label}
                            </button>
                          ))}
                        {n.secondary && (
                          <button
                            onClick={n.secondary.onClick}
                            className="h-7 px-3 rounded-lg text-[12px] text-deep-blue-900/55 hover:text-deep-blue-950 dark:text-white/50 dark:hover:text-white"
                          >
                            {n.secondary.label}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {n.dismissible && (
                    <button
                      onClick={() => remove(n.id)}
                      aria-label={`Dismiss ${n.title}`}
                      className="p-1 rounded-md text-deep-blue-900/35 hover:text-deep-blue-950 dark:text-white/30 dark:hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
