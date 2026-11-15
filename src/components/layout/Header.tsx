import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sun,
  Moon,
  Plus,
  Shield,
} from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { useUiStore } from '@/store/uiStore';
import { APP_NAME } from '@/constants/app';

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Financial Dashboard', subtitle: 'Overview & Key Performance Indicators' },
  '/transactions': { title: 'Transactions Ledger', subtitle: 'Search, filter, and categorise expenses' },
  '/budgets': { title: 'Monthly Budgets', subtitle: '50/30/20 allocation & burn rate pacing' },
  '/reports': { title: 'Period Reports', subtitle: 'Analytics, Excel exports, and visual breakdown' },
  '/assistant': { title: 'Gemini Assistant', subtitle: 'Agentic reasoning with long-term memory' },
  '/settings': { title: 'Preferences & Storage', subtitle: 'Currency, AI models, and local backup' },
};

export const Header: React.FC = () => {
  const location = useLocation();
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const { openQuickAdd } = useUiStore();

  const currentRoute = ROUTE_TITLES[location.pathname] || {
    title: APP_NAME,
    subtitle: 'Private Wealth Management',
  };

  return (
    <header className="sticky top-0 z-20 backdrop-blur-md bg-cream-100/90 dark:bg-dark-bg/90 border-b border-cream-200 dark:border-dark-border transition-colors">
      <div className="flex items-center justify-between px-4 sm:px-6 h-16">
        {/* Title & Subtitle */}
        <div className="flex flex-col justify-center">
          <h1 className="text-lg sm:text-xl font-bold text-deep-blue-900 dark:text-cream-100 tracking-tight leading-tight">
            {currentRoute.title}
          </h1>
          <p className="hidden sm:block text-xs text-deep-blue-700/70 dark:text-cream-300">
            {currentRoute.subtitle}
          </p>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Storage Persisted Pill */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border text-deep-blue-700 dark:text-cream-300"
            title="Data is stored privately in browser IndexedDB"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Local Vault</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-deep-blue-700 dark:text-cream-200 hover:bg-cream-200/70 dark:hover:bg-dark-elevated transition-colors border border-transparent hover:border-cream-300 dark:hover:border-dark-border"
            title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-deep-blue-600" />
            )}
          </button>

          {/* Quick Add CTA Button */}
          <button
            onClick={openQuickAdd}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 active:bg-deep-blue-700 text-cream-100 text-sm font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Quick Add</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-deep-blue-700 text-cream-200">
              N
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
};
