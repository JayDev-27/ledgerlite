import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileTabs } from './MobileTabs';
import { QuickAddModal } from './QuickAddModal';
import { useUiStore } from '@/store/uiStore';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { repository, getActiveVaultId } from '@/data/repository';
import { seedDatabase, seedCategoriesOnly, purgeDemoData } from '@/data/seed';
import { generateDueRecurringTransactions } from '@/features/recurring/recurringService';
import { downloadBackupJson } from '@/lib/backup';
import { CLOUD_MODE } from '@/lib/auth/firebase';
import { secretsAdapter } from '@/lib/secrets';
import { Link, useLocation } from 'react-router-dom';
import { prefetchAppPages } from '@/pageLoaders';
import { APP_NAME } from '@/constants/app';
import { Info, Download } from 'lucide-react';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';

export function isQuickAddShortcutAllowed(
  e: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    target: EventTarget | { tagName?: string; isContentEditable?: boolean } | null;
  },
  isQuickAddOpen: boolean,
  hasActiveDialog: boolean
): boolean {
  if (isQuickAddOpen || hasActiveDialog) return false;

  const target = e.target as { tagName?: string; isContentEditable?: boolean } | null;
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  ) {
    return false;
  }

  if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    return true;
  }

  return false;
}

// One seed per vault (per signed-in user on the hosted site); shared promise also
// absorbs StrictMode's double mount, where two concurrent seeds would collide.
const firstRunOnce = new Map<string, Promise<boolean>>();
const seedOnce = new Map<string, Promise<Awaited<ReturnType<typeof seedDatabase>> | null>>();

export const Shell: React.FC = () => {
  const location = useLocation();
  const { isQuickAddOpen, openQuickAdd, closeQuickAdd } = useUiStore();
  const { initTheme } = useThemeStore();
  const { settings, loadSettings, requestStoragePersistence, recordBackup, dismissBackupReminder } = useSettingsStore();
  const [seedNotice, setSeedNotice] = useState<string | null>(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  // Pages read categories once on mount, so they must not render until the
  // first-run seed has finished (otherwise a fresh vault shows "Other" everywhere).
  const [storageReady, setStorageReady] = useState(false);
  // Warm the other pages so tab switches are instant (and transitions never wait on the network).
  useEffect(() => {
    if (!storageReady) return;
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (ric) ric(prefetchAppPages);
    else setTimeout(prefetchAppPages, 1200);
  }, [storageReady]);

  // Hosted site: each user must bring their own Gemini key before AI features work.
  const [needsAiKey, setNeedsAiKey] = useState(false);

  useEffect(() => {
    if (!CLOUD_MODE || !storageReady) return;
    const check = () => secretsAdapter.getApiKey().then((k) => setNeedsAiKey(!k)).catch(() => undefined);
    check();
    window.addEventListener('focus', check);
    window.addEventListener('gemini-key-updated', check);
    return () => {
      window.removeEventListener('focus', check);
      window.removeEventListener('gemini-key-updated', check);
    };
  }, [storageReady]);

  // Initialize theme & settings on mount
  useEffect(() => {
    initTheme();
    loadSettings();

    // Check and auto-seed if first run
    const initStorage = async () => {
      try {
        // Shared promise: StrictMode double-mounts in dev, and two concurrent
        // seeds would collide on primary keys.
        const vault = getActiveVaultId();
        if (CLOUD_MODE) {
          // Real accounts start empty: categories only, and any demo data from
          // earlier builds is removed once. Demo data stays opt-in in Settings.
          if (!firstRunOnce.has(vault)) {
            firstRunOnce.set(
              vault,
              (async () => {
                await purgeDemoData(repository);
                const fresh = await seedCategoriesOnly(repository);
                return fresh || (await repository.countTransactions()) === 0;
              })()
            );
          }
          if (await firstRunOnce.get(vault)) {
            setSeedNotice('Your vault is ready. Log your first expense, or import a bank statement from Transactions.');
          }
        } else {
          if (!seedOnce.has(vault)) {
            seedOnce.set(
              vault,
              repository.isDatabaseEmpty().then((isEmpty) => (isEmpty ? seedDatabase(repository, false) : null))
            );
          }
          const res = await seedOnce.get(vault);
          if (res) {
            setSeedNotice(
              `Welcome to ${APP_NAME}! Loaded ${res.transactionsCount} demo transactions across 6 months.`
            );
            setTimeout(() => setSeedNotice(null), 8000);
          }
        }
        setStorageReady(true);
        // Auto-request persistence safely on first load
        await requestStoragePersistence();

        // Auto-check and generate due recurring transactions (rent, subscriptions, EMIs)
        const recurringRes = await generateDueRecurringTransactions(repository);
        if (recurringRes.generatedCount > 0) {
          window.dispatchEvent(new CustomEvent('transactions-updated'));
        }
      } catch (err) {
        console.error('Database initialization error:', err);
      } finally {
        setStorageReady(true);
      }
    };

    initStorage();
  }, [initTheme, loadSettings, requestStoragePersistence]);

  // Check if weekly backup reminder is due (every 7 days)
  useEffect(() => {
    // The website keeps data in the cloud, so the "browser-only" backup nag doesn't apply.
    if (CLOUD_MODE) return;
    const now = new Date().getTime();
    const snoozeUntil = settings.dismissedBackupReminderUntil
      ? new Date(settings.dismissedBackupReminderUntil).getTime()
      : 0;

    if (now > snoozeUntil) {
      const lastBackupTime = settings.lastBackupDate
        ? new Date(settings.lastBackupDate).getTime()
        : 0;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (!lastBackupTime || now - lastBackupTime > sevenDaysMs) {
        setShowBackupReminder(true);
      }
    }
  }, [settings.lastBackupDate, settings.dismissedBackupReminderUntil]);

  const handleBackupNow = async () => {
    try {
      await downloadBackupJson();
      await recordBackup();
      setShowBackupReminder(false);
    } catch (err) {
      console.error('Backup failed:', err);
    }
  };

  // Global keyboard shortcuts (Press 'N' anywhere to open quick-add)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If modal is open, Escape closes it
      if (e.key === 'Escape' && isQuickAddOpen) {
        closeQuickAdd();
        return;
      }

      const hasActiveDialog = Boolean(
        typeof document !== 'undefined' && document.querySelector('[role="dialog"]')
      );

      if (isQuickAddShortcutAllowed(e, isQuickAddOpen, hasActiveDialog)) {
        e.preventDefault();
        openQuickAdd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickAddOpen, openQuickAdd, closeQuickAdd]);

  return (
    <div className="app-shell relative min-h-screen flex bg-cream-100 dark:bg-dark-bg text-deep-blue-950 dark:text-cream-100 antialiased transition-colors">
      <div className="app-ambient" aria-hidden="true" />
      {/* Skip to Main Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-deep-blue-500 focus:text-cream-100 focus:font-semibold focus:rounded-lg focus:shadow-modal focus:ring-2 focus:ring-deep-blue-400 focus:ring-offset-2"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 pb-24 md:pb-0">
        <Header />

        {/* PWA Offline & Install Banners */}
        <OfflineIndicator />
        <PwaInstallBanner />

        {/* First-run seed notification toast */}
        {(seedNotice || showBackupReminder || needsAiKey) && (
          <div className="print:hidden w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 space-y-2">
            {seedNotice && (
              <div role="status" className="flex items-center gap-3 h-11 pl-4 pr-1.5 rounded-xl liquid-glass text-[13px] animate-fadeIn">
                <Info className="w-4 h-4 shrink-0 text-deep-blue-500 dark:text-white/40" strokeWidth={1.75} />
                <span className="flex-1 truncate text-deep-blue-900/70 dark:text-white/60">{seedNotice}</span>
                <button
                  onClick={() => setSeedNotice(null)}
                  className="h-8 px-3 rounded-lg text-deep-blue-900/50 dark:text-white/45 hover:text-deep-blue-950 dark:hover:text-white hover:bg-deep-blue-50/60 dark:hover:bg-white/[0.05] transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}

            {needsAiKey && (
              <div role="status" className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 min-h-11 py-1.5 pl-4 pr-1.5 rounded-xl liquid-glass text-[13px] animate-fadeIn">
                <span className="w-1.5 h-1.5 rounded-full bg-deep-blue-500 dark:bg-sky-400 shrink-0" aria-hidden="true" />
                <p className="flex-1 min-w-0 text-deep-blue-900/70 dark:text-white/60">
                  <span className="text-deep-blue-950 dark:text-white">Connect your Gemini key.</span>{' '}
                  <span className="hidden md:inline">It powers the assistant, smart categorisation and written reports. Free from Google AI Studio.</span>
                </p>
                <Link
                  to="/app/settings"
                  className="ml-auto shrink-0 flex items-center h-8 px-3 rounded-lg font-medium bg-deep-blue-950 text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity"
                >
                  Add key
                </Link>
              </div>
            )}

            {showBackupReminder && (
              <div role="status" className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 min-h-11 py-1.5 pl-4 pr-1.5 rounded-xl liquid-glass text-[13px] animate-fadeIn">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-300 shrink-0" aria-hidden="true" />
                <p className="flex-1 min-w-0 text-deep-blue-900/70 dark:text-white/60">
                  <span className="text-deep-blue-950 dark:text-white">Back up your vault.</span>{' '}
                  <span className="hidden md:inline">Your ledger lives only in this browser — a backup keeps it safe if site data is cleared.</span>
                </p>
                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  <button
                    onClick={() => {
                      dismissBackupReminder(7);
                      setShowBackupReminder(false);
                    }}
                    className="h-8 px-3 rounded-lg text-deep-blue-900/50 dark:text-white/45 hover:text-deep-blue-950 dark:hover:text-white hover:bg-deep-blue-50/60 dark:hover:bg-white/[0.05] transition-colors"
                  >
                    Later
                  </button>
                  <button
                    onClick={handleBackupNow}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg font-medium bg-deep-blue-950 text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={2} />
                    Back up
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <main id="main-content" tabIndex={-1} className="relative flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto focus:outline-none">
          {storageReady ? (
            <div key={location.pathname} className="vt-page">
              <Outlet />
            </div>
          ) : (
            <div className="min-h-[40vh] grid place-items-center" role="status" aria-label="Preparing your vault">
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-sky-400 animate-spin" />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <MobileTabs />

      {/* Global Quick Add Modal */}
      <QuickAddModal />
    </div>
  );
};
