import React from 'react';
import { useLocation } from 'react-router-dom';
import { Sun, Moon, WifiOff } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { usePwa } from '@/lib/pwa';
import { BrandGlyph } from '@/components/brand/BrandMark';

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/app': { title: 'Overview', subtitle: 'Your month at a glance' },
  '/app/transactions': { title: 'Transactions', subtitle: 'Every rupee, searchable' },
  '/app/budgets': { title: 'Budgets', subtitle: 'Envelopes, pace and rollovers' },
  '/app/reports': { title: 'Reports', subtitle: 'Period packs and exports' },
  '/app/assistant': { title: 'Assistant', subtitle: 'Ask anything about your money' },
  '/app/settings': { title: 'Settings', subtitle: 'Preferences, AI and backups' },
};

export const Header: React.FC = () => {
  const location = useLocation();
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const { isOnline } = usePwa();

  const current = ROUTE_TITLES[location.pathname] ?? { title: 'LedgerLite', subtitle: '' };
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <header className="liquid-bar sticky top-0 z-20 border-b border-cream-200 dark:border-white/[0.07]">
      <div className="flex items-center justify-between gap-4 px-5 sm:px-8 h-16">
        <div className="flex items-center gap-3 min-w-0">
          <span className="md:hidden text-deep-blue-950 dark:text-white">
            <BrandGlyph size={22} />
          </span>
          <div className="vt-title flex items-baseline gap-3 min-w-0">
            <h1 className="!text-[26px] leading-none font-normal text-deep-blue-950 dark:text-white truncate">{current.title}</h1>
            {current.subtitle && (
              <p className="hidden sm:block text-[13px] text-deep-blue-900/45 dark:text-white/35 truncate">{current.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isOnline && (
            <span
              role="status"
              title="You're offline. Everything keeps working locally."
              className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-amber-800 dark:text-amber-200/90 bg-amber-100 dark:bg-amber-400/10"
            >
              <WifiOff className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}

          <button
            onClick={toggleTheme}
            title={`Switch to ${nextTheme} mode`}
            aria-label={`Switch to ${nextTheme} mode`}
            className="grid place-items-center w-9 h-9 rounded-xl text-deep-blue-900/50 hover:text-deep-blue-950 hover:bg-deep-blue-50/60 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.05] transition-colors"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" strokeWidth={1.75} /> : <Moon className="w-4 h-4" strokeWidth={1.75} />}
          </button>

        </div>
      </div>
    </header>
  );
};
