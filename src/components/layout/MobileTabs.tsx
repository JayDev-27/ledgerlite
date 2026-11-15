import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Bot,
  Plus,
} from 'lucide-react';
import clsx from 'clsx';
import { useUiStore } from '@/store/uiStore';

export const MobileTabs: React.FC = () => {
  const { openQuickAdd } = useUiStore();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-cream-50/95 dark:bg-dark-surface/95 backdrop-blur-md border-t border-cream-200 dark:border-dark-border px-2 py-1.5 safe-bottom">
      <div className="flex items-center justify-around">
        {/* Dashboard */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            clsx(
              'flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors',
              isActive
                ? 'text-deep-blue-500 dark:text-cream-100 font-semibold'
                : 'text-deep-blue-700/60 dark:text-cream-400'
            )
          }
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Dashboard</span>
        </NavLink>

        {/* Transactions */}
        <NavLink
          to="/transactions"
          className={({ isActive }) =>
            clsx(
              'flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors',
              isActive
                ? 'text-deep-blue-500 dark:text-cream-100 font-semibold'
                : 'text-deep-blue-700/60 dark:text-cream-400'
            )
          }
        >
          <ArrowLeftRight className="w-5 h-5 mb-0.5" />
          <span>Ledger</span>
        </NavLink>

        {/* Center Quick Add Floating Button */}
        <button
          onClick={openQuickAdd}
          aria-label="Quick Add Expense"
          className="flex flex-col items-center justify-center -mt-5"
        >
          <div className="w-12 h-12 rounded-full bg-deep-blue-500 text-cream-100 flex items-center justify-center shadow-lg active:scale-95 transition-transform border-2 border-cream-100 dark:border-dark-bg">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-semibold text-deep-blue-900 dark:text-cream-100 mt-0.5">
            Add
          </span>
        </button>

        {/* Budgets */}
        <NavLink
          to="/budgets"
          className={({ isActive }) =>
            clsx(
              'flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors',
              isActive
                ? 'text-deep-blue-500 dark:text-cream-100 font-semibold'
                : 'text-deep-blue-700/60 dark:text-cream-400'
            )
          }
        >
          <PieChart className="w-5 h-5 mb-0.5" />
          <span>Budgets</span>
        </NavLink>

        {/* Assistant */}
        <NavLink
          to="/assistant"
          className={({ isActive }) =>
            clsx(
              'flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors',
              isActive
                ? 'text-deep-blue-500 dark:text-cream-100 font-semibold'
                : 'text-deep-blue-700/60 dark:text-cream-400'
            )
          }
        >
          <Bot className="w-5 h-5 mb-0.5" />
          <span>Assistant</span>
        </NavLink>
      </div>
    </nav>
  );
};
