/**
 * App-wide constants for LedgerLite
 * Single location to change app branding and regional defaults
 */

export const APP_NAME = 'LedgerLite';
export const APP_TAGLINE = 'Private Wealth & Expense Management';
export const APP_VERSION = '0.1.0';

// Regional & Fintech defaults (India-first defaults, user-configurable in settings)
export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_CURRENCY_SYMBOL = '₹';
export const DEFAULT_LOCALE = 'en-IN';

// 1 = Monday (date-fns day convention: 0 is Sunday, 1 is Monday)
export const DEFAULT_WEEK_STARTS_ON = 1 as const;

// 4 = April (Indian financial year: April 1 to March 31)
export const DEFAULT_FINANCIAL_YEAR_START_MONTH = 4 as const;

// Primary Design System Colors
export const BRAND_COLORS = {
  obsidian: '#0B0C0D',
  surface: '#141516',
  border: '#2A2B2E',
  iris: '#847DFF',
  primary: '#5B54E8',
  lime: '#9FE870',
  cyan: '#00B3DD',
  orchid: '#DD90D8',
  periwinkle: '#90B8F0',
  cloud: '#F5F5F7',
  ash: '#9F9FA0',
  statusSuccess: '#1B6B4C',
  statusWarning: '#B86A04',
  statusDanger: '#B92E2E',
} as const;

// Storage keys
export const STORAGE_KEYS = {
  THEME: 'ledgerlite_theme',
  SETTINGS: 'ledgerlite_settings',
  SIDEBAR_COLLAPSED: 'ledgerlite_sidebar_collapsed',
} as const;
