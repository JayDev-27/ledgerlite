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
  cream: '#F5EEDD',
  sky: '#84B3CE',
  deepBlue: '#16587B',
  darkBg: '#081722',
  darkSurface: '#0F2536',
  darkBorder: '#1F4766',
  textLight: '#0B2433',
  textDark: '#F5EEDD',
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
