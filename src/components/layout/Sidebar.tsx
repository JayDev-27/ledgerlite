import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  FileBarChart,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { APP_NAME, APP_TAGLINE } from '@/constants/app';
import { useUiStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: PieChart },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/assistant', label: 'AI Assistant', icon: Bot, badge: 'Gemini' },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { isSidebarCollapsed, toggleSidebar, openQuickAdd } = useUiStore();
  const { settings } = useSettingsStore();

  return (
    <aside
      className={clsx(
        'hidden md:flex flex-col bg-cream-50 dark:bg-dark-surface border-r border-cream-200 dark:border-dark-border h-screen sticky top-0 transition-all duration-300 z-30 select-none',
        isSidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-cream-200 dark:border-dark-border">
        <div
          className={clsx(
            'flex items-center gap-3 overflow-hidden transition-all',
            isSidebarCollapsed ? 'justify-center w-full' : ''
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-deep-blue-500 text-cream-100 flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
            {APP_NAME.charAt(0)}
          </div>

          {!isSidebarCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-deep-blue-900 dark:text-cream-100 tracking-tight text-base truncate">
                {APP_NAME}
              </span>
              <span className="text-[10px] tracking-wider uppercase text-deep-blue-600/70 dark:text-cream-300 truncate">
                {APP_TAGLINE}
              </span>
            </div>
          )}
        </div>

        {!isSidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            title="Collapse Sidebar"
            className="p-1.5 rounded-lg text-deep-blue-700 hover:text-deep-blue-950 dark:text-cream-300 hover:bg-cream-200/60 dark:hover:bg-dark-elevated transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Add Action Button */}
      <div className="p-3">
        <button
          onClick={openQuickAdd}
          className={clsx(
            'w-full flex items-center justify-center gap-2 rounded-xl bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 py-2.5 font-medium shadow-sm transition-all text-sm group',
            isSidebarCollapsed ? 'px-0' : 'px-4'
          )}
          title="Quick Add Expense (Press N)"
        >
          <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between flex-1">
              <span>Log Expense</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] uppercase font-mono rounded bg-deep-blue-700 text-cream-200">
                N
              </kbd>
            </div>
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all',
                  isActive
                    ? 'bg-deep-blue-500 text-cream-100 shadow-sm'
                    : 'text-deep-blue-800/80 hover:text-deep-blue-950 hover:bg-cream-200/60 dark:text-cream-200 dark:hover:bg-dark-elevated',
                  isSidebarCollapsed && 'justify-center px-0'
                )
              }
              title={isSidebarCollapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={clsx(
                      'w-5 h-5 flex-shrink-0',
                      isActive ? 'text-cream-100' : 'text-deep-blue-600 dark:text-cream-300'
                    )}
                  />
                  {!isSidebarCollapsed && (
                    <div className="flex items-center justify-between flex-1 truncate">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={clsx(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1',
                            isActive
                              ? 'bg-deep-blue-700 text-cream-100'
                              : 'bg-sky-100 text-deep-blue-700 dark:bg-dark-elevated dark:text-cream-300'
                          )}
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info & Storage Status */}
      <div className="p-3 border-t border-cream-200 dark:border-dark-border space-y-2">
        {!isSidebarCollapsed ? (
          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-xs space-y-1">
            <div className="flex items-center justify-between text-deep-blue-900 dark:text-cream-100 font-medium">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Local-First Storage
              </span>
              <span className="text-[10px] px-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono">
                {settings.storagePersisted ? 'Persisted' : 'IndexedDB'}
              </span>
            </div>
            <p className="text-[11px] text-deep-blue-600/70 dark:text-cream-400 leading-tight">
              100% private. Stored on device.
            </p>
          </div>
        ) : (
          <button
            onClick={toggleSidebar}
            title="Expand Sidebar"
            className="w-full flex justify-center p-2 rounded-xl text-deep-blue-700 hover:text-deep-blue-950 dark:text-cream-300 hover:bg-cream-200/60 dark:hover:bg-dark-elevated transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </aside>
  );
};
