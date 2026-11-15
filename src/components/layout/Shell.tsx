import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileTabs } from './MobileTabs';
import { QuickAddModal } from './QuickAddModal';
import { useUiStore } from '@/store/uiStore';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { repository } from '@/data/repository';
import { seedDatabase } from '@/data/seed';
import { generateDueRecurringTransactions } from '@/features/recurring/recurringService';
import { downloadBackupJson } from '@/lib/backup';
import { APP_NAME } from '@/constants/app';
import { Sparkles, AlertTriangle, Download } from 'lucide-react';

export const Shell: React.FC = () => {
  const { isQuickAddOpen, openQuickAdd, closeQuickAdd } = useUiStore();
  const { initTheme } = useThemeStore();
  const { settings, loadSettings, requestStoragePersistence, recordBackup, dismissBackupReminder } = useSettingsStore();
  const [seedNotice, setSeedNotice] = useState<string | null>(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);

  // Initialize theme & settings on mount
  useEffect(() => {
    initTheme();
    loadSettings();

    // Check and auto-seed if first run
    const initStorage = async () => {
      try {
        const isEmpty = await repository.isDatabaseEmpty();
        if (isEmpty) {
          const res = await seedDatabase(repository, false);
          setSeedNotice(
            `Welcome to ${APP_NAME}! Loaded ${res.transactionsCount} demo transactions across 6 months.`
          );
          setTimeout(() => setSeedNotice(null), 8000);
        }
        // Auto-request persistence safely on first load
        await requestStoragePersistence();

        // Auto-check and generate due recurring transactions (rent, subscriptions, EMIs)
        const recurringRes = await generateDueRecurringTransactions(repository);
        if (recurringRes.generatedCount > 0) {
          window.dispatchEvent(new CustomEvent('transactions-updated'));
        }
      } catch (err) {
        console.error('Database initialization error:', err);
      }
    };

    initStorage();
  }, [initTheme, loadSettings, requestStoragePersistence]);

  // Check if weekly backup reminder is due (every 7 days)
  useEffect(() => {
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

      // Check if user is typing in an input/textarea/select/contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // 'n' or 'N' opens Quick Add
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        openQuickAdd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickAddOpen, openQuickAdd, closeQuickAdd]);

  return (
    <div className="min-h-screen flex bg-cream-100 dark:bg-dark-bg text-deep-blue-950 dark:text-cream-100 antialiased selection:bg-cream-300 selection:text-deep-blue-900 transition-colors">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header />

        {/* First-run seed notification toast */}
        {seedNotice && (
          <div className="print:hidden mx-4 sm:mx-6 mt-4 p-3.5 rounded-xl bg-deep-blue-500 text-cream-100 text-sm flex items-center justify-between shadow-card animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-cream-200 flex-shrink-0" />
              <span>{seedNotice}</span>
            </div>
            <button
              onClick={() => setSeedNotice(null)}
              className="text-xs text-cream-200 hover:text-white px-2 py-1 rounded bg-deep-blue-600 ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Weekly Backup Reminder Banner */}
        {showBackupReminder && (
          <div className="print:hidden mx-4 sm:mx-6 mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-dark-elevated border border-amber-200 dark:border-amber-900/50 text-amber-950 dark:text-cream-100 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fadeIn">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-semibold">Weekly Backup Reminder: </span>
                <span>
                  Your financial data is stored locally in your browser and can be cleared if cache is reset. Download a JSON backup to protect your records.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
              <button
                onClick={handleBackupNow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 font-semibold text-xs transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Backup Now</span>
              </button>
              <button
                onClick={() => {
                  dismissBackupReminder(7);
                  setShowBackupReminder(false);
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs text-deep-blue-700 dark:text-cream-300 hover:bg-cream-200/60 dark:hover:bg-dark-border transition-colors"
              >
                Remind in 7 days
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <MobileTabs />

      {/* Global Quick Add Modal */}
      <QuickAddModal />
    </div>
  );
};
