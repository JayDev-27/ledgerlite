import { create } from 'zustand';
import type { AppSettings } from '@/types';
import { repository } from '@/data/repository';
import {
  DEFAULT_CURRENCY,
  DEFAULT_CURRENCY_SYMBOL,
  DEFAULT_LOCALE,
  DEFAULT_WEEK_STARTS_ON,
  DEFAULT_FINANCIAL_YEAR_START_MONTH,
} from '@/constants/app';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  requestStoragePersistence: () => Promise<boolean>;
  recordBackup: () => Promise<void>;
  dismissBackupReminder: (days?: number) => Promise<void>;
}

const defaultAppSettings: AppSettings = {
  currency: DEFAULT_CURRENCY,
  currencySymbol: DEFAULT_CURRENCY_SYMBOL,
  locale: DEFAULT_LOCALE,
  weekStartsOn: DEFAULT_WEEK_STARTS_ON,
  financialYearStartMonth: DEFAULT_FINANCIAL_YEAR_START_MONTH,
  theme: 'light',
  privacyMode: true,
  geminiHeavyModel: 'gemini-3.8-flash',
  geminiLightModel: 'gemini-3.5-flash-lite',
  dailyAiBudget: 220,
  dailyAiBudgetHeavy: 20,
  dailyAiBudgetLight: 200,
  storagePersisted: false,
  hasCompletedSeed: false,
  lastBackupDate: undefined,
  dismissedBackupReminderUntil: undefined,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultAppSettings,
  isLoading: true,

  loadSettings: async () => {
    try {
      const stored = await repository.getAllSettings();
      let persisted = false;

      // Check if navigator storage is already persisted
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }

      const merged: AppSettings = {
        ...defaultAppSettings,
        ...stored,
        storagePersisted: persisted,
      };

      set({ settings: merged, isLoading: false });
    } catch (e) {
      console.error('Failed to load settings:', e);
      set({ isLoading: false });
    }
  },

  updateSettings: async (updates: Partial<AppSettings>) => {
    const current = get().settings;
    const next = { ...current, ...updates };
    set({ settings: next });

    for (const [key, val] of Object.entries(updates)) {
      await repository.setSetting(key, val);
    }
  },

  requestStoragePersistence: async () => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        get().updateSettings({ storagePersisted: isPersisted });
        return isPersisted;
      } catch (e) {
        console.warn('Storage persistence request failed:', e);
        return false;
      }
    }
    return false;
  },

  recordBackup: async () => {
    const now = new Date().toISOString();
    await get().updateSettings({ lastBackupDate: now });
  },

  dismissBackupReminder: async (days = 7) => {
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + days);
    await get().updateSettings({ dismissedBackupReminderUntil: snoozeDate.toISOString() });
  },
}));
