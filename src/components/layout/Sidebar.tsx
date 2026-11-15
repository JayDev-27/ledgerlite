import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  FileBarChart,
  MessageSquareText,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { useUiStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuth } from '@/lib/auth/AuthProvider';
import { BrandGlyph } from '@/components/brand/BrandMark';
import { CLOUD_MODE } from '@/lib/auth/firebase';

type SyncState = 'idle' | 'syncing' | 'error';

function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>('idle');
  useEffect(() => {
    if (!CLOUD_MODE) return;
    let unsub: (() => void) | undefined;
    let alive = true;
    import('@/data/cloud/cloudVault').then((m) => {
      if (!alive) return;
      setState(m.getSyncState());
      unsub = m.onSyncStateChange(setState);
    });
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);
  return state;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard },
  { to: '/app/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/app/budgets', label: 'Budgets', icon: PieChart },
  { to: '/app/reports', label: 'Reports', icon: FileBarChart },
  { to: '/app/assistant', label: 'Assistant', icon: MessageSquareText },
];

const navClass =
  (collapsed: boolean) =>
  ({ isActive }: { isActive: boolean }) =>
    clsx(
      'group relative flex items-center gap-3 h-10 rounded-xl text-[14px] transition-colors',
      collapsed ? 'justify-center px-0' : 'px-3',
      isActive
        ? 'text-deep-blue-950 dark:text-white font-medium'
        : 'text-deep-blue-900/60 hover:text-deep-blue-950 hover:bg-deep-blue-50/60 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/[0.03]'
    );

export const Sidebar: React.FC = () => {
  const { isSidebarCollapsed: collapsed, toggleSidebar, openQuickAdd } = useUiStore();
  const { settings } = useSettingsStore();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'You';
  const initials = displayName.slice(0, 2).toUpperCase();
  const sync = useSyncState();
  const statusLabel = CLOUD_MODE
    ? sync === 'syncing'
      ? 'Syncing…'
      : sync === 'error'
        ? 'Sync paused — retrying'
        : 'Synced to cloud'
    : settings.storagePersisted
      ? 'Vault persisted on device'
      : 'Stored on this device';

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const renderItem = (item: NavItem, end = false) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={end}
        viewTransition
        className={navClass(collapsed)}
        title={collapsed ? item.label : undefined}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              // One shared glass capsule: the view transition glides it between items
              <span
                aria-hidden="true"
                className="vt-nav-active absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-transparent dark:liquid-glass-thin"
              />
            )}
            <Icon className="relative w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            {!collapsed && <span className="relative truncate">{item.label}</span>}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={clsx(
        'hidden md:flex flex-col h-screen sticky top-0 z-30 select-none transition-[width] duration-300',
        'liquid-bar border-r border-cream-200 dark:border-white/[0.07]',
        collapsed ? 'w-[76px]' : 'w-[248px]'
      )}
    >
      {/* Brand */}
      <div className={clsx('h-16 flex items-center', collapsed ? 'justify-center' : 'justify-between pl-5 pr-3')}>
        <NavLink
          to="/app"
          viewTransition
          className="flex items-center gap-2.5 rounded-lg text-deep-blue-950 dark:text-white"
          aria-label="LedgerLite overview"
        >
          <BrandGlyph size={24} />
          {!collapsed && <span className="font-semibold tracking-[-0.02em] text-[15px]">LedgerLite</span>}
        </NavLink>
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="p-2 rounded-lg text-deep-blue-900/40 hover:text-deep-blue-950 dark:text-white/30 dark:hover:text-white hover:bg-deep-blue-50/60 dark:hover:bg-white/[0.04] transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Primary action */}
      <div className="px-4 pt-2 pb-5">
        <button
          onClick={openQuickAdd}
          aria-label="Log expense (shortcut N)"
          title="Log expense (N)"
          className={clsx(
            'group w-full h-10 flex items-center gap-2 rounded-xl text-[14px] font-medium transition-colors',
            'bg-deep-blue-950 text-white hover:bg-deep-blue-900 dark:bg-white dark:text-black dark:hover:bg-cream-200',
            collapsed ? 'justify-center' : 'pl-3 pr-2'
          )}
        >
          <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Log expense</span>
              <kbd className="grid place-items-center w-6 h-6 rounded-md text-[11px] font-mono bg-white/10 dark:bg-black/[0.07] text-white/60 dark:text-black/50">
                N
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Main" className="flex-1 px-3 overflow-y-auto">
        {!collapsed && <p className="px-3 pb-2 label-mono !text-[10px] text-deep-blue-900/35 dark:text-white/25">Workspace</p>}
        <div className="space-y-0.5">{NAV_ITEMS.map((item) => renderItem(item, item.to === '/app'))}</div>
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 space-y-0.5">
        {renderItem({ to: '/app/settings', label: 'Settings', icon: Settings })}
        {collapsed && (
          <button
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="w-full h-10 grid place-items-center rounded-xl text-deep-blue-900/50 dark:text-white/40 hover:text-deep-blue-950 dark:hover:text-white hover:bg-deep-blue-50/60 dark:hover:bg-white/[0.03] transition-colors"
          >
            <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </button>
        )}

        {user && (
          <div
            className={clsx(
              'mt-3 pt-3 border-t border-cream-200 dark:border-white/[0.06] flex items-center gap-3',
              collapsed ? 'flex-col' : 'px-2'
            )}
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <span
                aria-hidden="true"
                className="w-8 h-8 rounded-full grid place-items-center shrink-0 text-[11px] font-semibold bg-deep-blue-100 text-deep-blue-900 dark:bg-white/[0.08] dark:text-white/80 ring-1 ring-inset ring-black/5 dark:ring-white/10"
              >
                {initials}
              </span>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-deep-blue-950 dark:text-white truncate">{displayName}</p>
                <p className="text-[11px] text-deep-blue-900/45 dark:text-white/35 truncate flex items-center gap-1.5">
                  <span
                    className={clsx(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      sync === 'error' ? 'bg-amber-400' : sync === 'syncing' ? 'bg-white/50 animate-pulse' : 'bg-emerald-500 dark:bg-sky-400'
                    )}
                    aria-hidden="true"
                  />
                  <span aria-live="polite">{statusLabel}</span>
                </p>
              </div>
            )}
            <button
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="p-2 rounded-lg text-deep-blue-900/40 dark:text-white/35 hover:text-deep-blue-950 dark:hover:text-white hover:bg-deep-blue-50/60 dark:hover:bg-white/[0.04] transition-colors"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
