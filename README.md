# LedgerLite

> **Private Wealth & Expense Manager**  
> *100% Local-First Architecture • Sovereign Offline Storage • Agentic Gemini Intelligence*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6_Strict-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg)](https://vitejs.dev/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-16587B.svg)](https://web.dev/progressive-web-apps/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-173_Passing-emerald.svg)](https://vitest.dev/)

---

## 1. Overview & Design Philosophy

**LedgerLite** is an artisanal, private wealth and personal finance management application engineered for discerning individuals who prioritize financial privacy, quantitative precision, and instant responsiveness.

Unlike conventional cloud-tethered personal finance software that ingests, mines, and stores personal banking data on remote multi-tenant servers, **LedgerLite operates entirely client-side**. All transactions, rules, categories, budgets, and analytical snapshots reside securely in your browser's persistent IndexedDB vault.

### The Private Banking Aesthetic
LedgerLite rejects abrasive, dopamine-seeking neon palettes in favor of a timeless, tactile **Swiss/Nordic private wealth management aesthetic**:
- **Cream (`#F5EEDD`)**: Warm, low-fatigue archival parchment background reminiscent of bespoke bond certificates and high-grade ledger stationery.
- **Deep Blue (`#16587B`)**: Confident, regal primary ink evoking classic fountain pen script, established merchant banks, and quantitative gravitas.
- **Sky (`#84B3CE`)**: Soft architectural accent for subtle borders, hover states, and trendline glow without eye strain.
- **Dark Vault Mode (`#081722` / `#0F2536`)**: A rich, distraction-free nocturnal palette featuring high-contrast cream typography (>10:1 contrast ratio) compliant with **WCAG AAA standards**.

---

## 2. Core Capabilities

### ⚡ Natural Language Quick-Add
- Press <kbd>N</kbd> from anywhere in the app to invoke the rapid entry modal.
- Parse freeform statements such as:
  - `"450 zomato yesterday upi"`
  - `"15k rent neft"`
  - `"₹1,200 shell petrol card"`
- Instant deterministic local regex parser generates a draft in <2ms, with optional debounced Gemini AI refinement in the background.

### 📊 Financial Year & Flexible Period Engine
- Full support for standard Calendar and **April Financial Year** (India FY: April 1 – March 31).
- Automatic period boundary calculation across **Week** (custom Monday/Sunday start), **Month**, **Quarter** (`Q1`–`Q4`), **Half-Year** (`H1`/`H2`), and **Full FY**.
- Period-over-period percentage comparisons with directionality-aware color coding (expense reductions are highlighted green; spikes are alerted in amber/red).

### 🏷️ 3-Tier Categorisation Pipeline
1. **Tier 1 (Learned Rules)**: Exact or substring merchant match rules stored locally in Dexie.
2. **Tier 2 (Built-in Dictionary)**: Curated index of 100+ Indian fintech, dining, grocery, utility, and retail merchants.
3. **Tier 3 (Gemini Few-Shot AI)**: Fallback model classification utilizing category descriptions and 50/30/20 taxonomy tags.

### 🎯 50/30/20 Budgeting & Pacing Engine
- Real-time monthly spend pacing against linear burn rate:
  - Calculates `safeToSpendPerDay = remainingBudget / daysLeftInMonth`.
  - Color-coded threshold alerts at **80%**, **100%**, and **120%** of allocated budget.
  - Multi-category unallocated budget carryover and rollover toggle.
- **AI-Powered Budget Suggestions**: Automatically synthesizes 3-month trailing expense habits into actionable category recommendations.

### 📈 Recharts Visual Analytics
- **Category Donut**: Outer ring breakdown with centered aggregate totals and interactive hover tooltips.
- **Stacked Category Bar Chart**: Period-over-period category spend evolution.
- **Cumulative Pace Chart**: Daily burn rate curve contrasted against ideal linear burn trajectory.
- **Day-of-Week Heatmap & Payment Breakdown**: Identifies peak spending days and UPI/Card/Net Banking distributions.
- **Full WCAG AA Accessibility**: All charts provide hidden accessible `<table>` mirrors for screen readers.

### 📑 Comprehensive Multi-Sheet Excel Exports (ExcelJS)
Generates native `.xlsx` workbooks containing:
- **Sheet 1: Summary KPI Dashboard**: Formatted currency cells, percentage calculations, Need/Want/Savings splits.
- **Sheet 2: Itemized Ledger**: Every transaction tagged with merchant, category, date, and payment method with auto-filter headers.
- **Sheet 3: Category Breakdown**: Dynamic Excel `SUMIF` formulas computing subtotals per category.
- **Sheet 4: Budget vs Actual**: Variances and remaining allocations with conditional color fills.

### 🤖 Autonomous Gemini AI Assistant
- Powered by the `@google/genai` official SDK.
- **Agent Tool Execution Loop**: The assistant autonomously calls structured local database tools (`query_transactions`, `get_budget_status`, `get_category_summary`, `calculate_metrics`, `create_transaction`) to inspect your real data before formulating advice.
- **Long-Term Memory**: Autonomous memory management storing persistent facts (e.g., household rent amount, primary credit cards, financial goals) in IndexedDB.
- **Privacy Sanitizer**: Redacts account numbers, sensitive notes, and PII before dispatching prompts.
- **Free-Tier Aware Request Queue**: Sliding-window RPM rate limiter, exponential backoff with jitter on HTTP 429, daily call budgeting, and seamless fallback between models.

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Core UI** | React 18.3, TypeScript 5.6 (Strict) | Concurrent rendering, type safety with 0 `any` annotations |
| **Build & Dev** | Vite 6.0, `vite-plugin-pwa` 0.21 | Sub-second HMR, Workbox precaching, PWA web manifest |
| **Styling** | Tailwind CSS 3.4 | Utility-first, zero-runtime CSS, dark mode support |
| **Local Database** | Dexie.js 4.0 (IndexedDB) | Reactive observable hooks (`useLiveQuery`), ACID local storage |
| **Visualizations** | Recharts 2.13 | Declarative SVG charting with screen-reader data mirrors |
| **Date & Time** | date-fns 4.1 | Immutable functional date manipulation without timezone drift |
| **Schema Validation**| Zod 3.23 | Strict runtime type inference and CSV mapping verification |
| **Excel Engine** | ExcelJS 4.4 | Real native `.xlsx` generation with formulas and styling |
| **AI Integration** | `@google/genai` 1.0 | Official Gemini API SDK supporting agent loops and thinking models |
| **Testing** | Vitest 2.1, fake-indexeddb | Ultra-fast unit testing with in-memory IndexedDB emulation |

---

## 4. Architecture & Directory Structure

LedgerLite follows a modular, feature-oriented structure with complete separation of concerns:

```
src/
├── __tests__/                     # Comprehensive Vitest test suite (173 passing tests)
│   ├── a11yAndKeyboard.test.ts    # Focus trap, shortcut suppression, contrast ratios
│   ├── agentLoop.test.ts          # Autonomous tool invocation loop
│   ├── budgetMath.test.ts         # Pacing, daily safe-to-spend, rollover calculations
│   ├── categorizer.test.ts        # 3-tier merchant classification pipeline
│   ├── excelExport.test.ts        # Multi-sheet ExcelJS workbook generation
│   ├── periodEngine.test.ts       # Indian FY (April), quarters, weeks, leap years
│   ├── pwa.test.ts                # Offline hook, install prompt, lifecycle events
│   └── requestQueue.test.ts       # Sliding window RPM, backoff, and model fallback
├── components/                    # Global presentation and layout components
│   ├── common/                    # Badges, EmptyState, SkeletonLoader, ErrorBoundary
│   ├── layout/                    # Shell, Header, Sidebar, MobileTabs, QuickAddModal
│   └── pwa/                       # OfflineIndicator banner, PwaInstallBanner
├── constants/
│   └── app.ts                     # Single-constant branding & regional configuration
├── data/                          # Storage layer
│   ├── repository/                # Abstract Repository Interface & DexieRepository implementation
│   ├── categories.ts              # 50/30/20 default categories & subcategories
│   ├── db.ts                      # Dexie database schema (9 tables)
│   ├── seed.ts                    # 6-month realistic demo seed generator
│   └── seed-runner.ts             # CLI seeding script
├── features/                      # Domain features
│   ├── assistant/                 # Gemini chat page, long-term memory editor
│   ├── budgets/                   # Monthly budget manager, pace chart, AI suggestions
│   ├── categories/                # 2-level taxonomy manager & merger dialog
│   ├── dashboard/                 # Financial KPI cards, donut, spend trend, heatmap
│   ├── recurring/                 # Recurring templates & auto-generation service
│   ├── reports/                   # Period analytics pack, Excel/CSV export, visual report
│   ├── rules/                     # Tier 1 merchant rule manager
│   ├── settings/                  # Vault backup/restore, API key manager, model selection
│   └── transactions/              # Ledger table, filter bar, CSV import modal
├── lib/                           # Core algorithmic libraries
│   ├── a11y/                      # WCAG AA focus trap and modal accessibility hooks
│   ├── backup/                    # Full 9-table JSON backup & restore service
│   ├── budget/                    # Budget mathematics, cumulative pace, AI suggestion
│   ├── categorizer/               # Normalizer, merchant dictionary, pipeline
│   ├── csv/                       # Column detector, parser, duplicate matcher
│   ├── export/                    # CSV exporter, ExcelJS workbook builder
│   ├── formatters.ts              # Currency, compact notation, relative dates
│   ├── gemini/                    # Request queue, agent loop, privacy sanitizer, tools
│   ├── periods/                   # Period range engine, FY calculator, comparisons
│   ├── pwa/                       # Offline detection and PWA installation hook
│   └── secrets/                   # IndexedDB encrypted/private API key adapter
├── store/                         # Lightweight UI and preferences state
│   ├── settingsStore.ts           # App settings, currency, AI budgets, persistence
│   ├── themeStore.ts              # Light / Dark / System theme management
│   └── uiStore.ts                 # Modal toggles, sidebar collapse state
├── styles/
│   └── index.css                  # Tailwind styles and custom scrollbars
├── App.tsx                        # Root application component with ErrorBoundary
├── main.tsx                       # React DOM entry point
├── routes.tsx                     # React Router 6 configuration
└── vite-env.d.ts                  # Vite client & PWA type declarations
```

---

## 5. Local-First Repository Pattern & Tauri Portability

LedgerLite is designed from the ground up for desktop portability. The data access layer is entirely decoupled behind the abstract `Repository` interface (`src/data/repository/types.ts`).

### Zero Node-Only APIs
- The application contains **zero imports of Node.js built-ins** (`fs`, `child_process`, `os`, `path`, `crypto`).
- All cryptographic key storage, backups, and file exports rely strictly on standard Web APIs (`SubtleCrypto`, `IndexedDB`, `Blob`, `URL.createObjectURL`).

### Swapping IndexedDB for SQLite (Tauri)
To run LedgerLite as a native macOS/Windows/Linux binary with **Tauri**:
1. Implement the `Repository` interface using `@tauri-apps/plugin-sql`:
   ```ts
   export class TauriSqliteRepository implements Repository {
     // Implement the exact same methods (getAllTransactions, createBudget, etc.)
     // mapping SQL queries to SQLite tables.
   }
   ```
2. Replace the instance export in `src/data/repository/index.ts`:
   ```ts
   export const repository: Repository = isTauri()
     ? new TauriSqliteRepository()
     : new DexieRepository();
   ```
No UI components, hooks, or business logic need to change.

---

## 6. Gemini AI Assistant: Architecture & Resilience

LedgerLite incorporates Google's latest Gemini models via `@google/genai` while respecting strict local-first privacy and free-tier operational boundaries.

```
User Prompt
    │
    ▼
[Privacy Sanitizer] ───► Redacts account numbers, credit card sequences, and sensitive PII
    │
    ▼
[Request Queue]     ───► Sliding-window RPM throttle (Gemini free tier: 2–15 RPM)
    │               ───► Daily budget tracker (persisted in IndexedDB)
    │               ───► Automatic retry with exponential backoff on HTTP 429
    ▼
[Agent Tool Loop]   ───► Models autonomously invoke local repository tools:
    │                      • query_transactions
    │                      • get_budget_status
    │                      • get_category_summary
    │                      • calculate_metrics
    ▼
[Long-Term Memory]  ───► Retrieves and stores persistent user context & preferences
    │
    ▼
Structured Advisory Response
```

### Free-Tier Quota Awareness
- **Heavy Model (`gemini-3.8-flash` / `gemini-2.5-pro`)**: Rate-throttled to safe request slots, with daily call budget caps (default 20 calls/day).
- **Light Model (`gemini-3.5-flash-lite` / `gemini-2.5-flash`)**: Used for background quick-add refinement and categorisation (default 200 calls/day).
- **Automatic Fallback**: If heavy model quota is exhausted, requests automatically degrade to the light model.
- **Deterministic Offline Fallback**: If offline or if quota is exhausted, report generation and budget suggestions gracefully fall back to local rule-based mathematical heuristics.

---

## 7. Setup & Development Guide

### Prerequisites
- macOS Sonoma / Sequoia (or modern Linux / Windows)
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher

### Getting a Gemini API Key
1. Navigate to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **"Get API key"** and create a key in a new or existing Google Cloud project.
4. Copy the API key string.

### Terminal Commands

#### 1. Clone & Install
```bash
git clone https://github.com/your-username/FinanceManager.git
cd FinanceManager
npm install
```

#### 2. Configure Environment (Optional)
Create a `.env` file in the project root:
```bash
cp .env.example .env
```
Edit `.env`:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```
> *Note:* You can also configure or update your Gemini API key directly inside the app at **Settings → Gemini API Key Vault**. It is saved privately in IndexedDB.

#### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

#### 4. Run Test Suite
```bash
# Run all 173 tests
npm test

# Run Vitest interactive UI
npm run test:ui
```

#### 5. Build for Production (with PWA & Service Worker)
```bash
npm run build
```
The compiled output is located in `dist/`, complete with service worker precache manifests and icons.

#### 6. Preview Production Build
```bash
npm run preview
```

---

## 8. Single-Constant Rebranding Guide

To rebrand the entire application (e.g. for an enterprise deployment or customized personal fork), modify only `src/constants/app.ts`:

```ts
// src/constants/app.ts

// 1. Change the application name and tagline
export const APP_NAME = 'LedgerLite';
export const APP_TAGLINE = 'Private Wealth & Expense Management';

// 2. Adjust default regional settings
export const DEFAULT_CURRENCY = 'INR';             // 'USD', 'EUR', 'GBP', etc.
export const DEFAULT_CURRENCY_SYMBOL = '₹';        // '$', '€', '£', etc.
export const DEFAULT_LOCALE = 'en-IN';             // 'en-US', 'de-DE', etc.
export const DEFAULT_WEEK_STARTS_ON = 1;           // 0 = Sunday, 1 = Monday
export const DEFAULT_FINANCIAL_YEAR_START_MONTH = 4; // 1 = January, 4 = April

// 3. Customize theme brand colors
export const BRAND_COLORS = {
  cream: '#F5EEDD',
  sky: '#84B3CE',
  deepBlue: '#16587B',
  // ...
};
```
All UI headers, sidebar logos, PWA install prompts, notifications, and export headers automatically inherit these constants.

---

## 9. Known Limitations & Technical Details

1. **ExcelJS Offscreen Canvas Charts**:
   ExcelJS generates rich native spreadsheets with formatting, data validations, and dynamic formulas (`SUMIF`). While data tables and formulas are native, embedded rasterized chart graphics in `.xlsx` files require browser offscreen canvas rendering, which may be omitted in headless CLI environments. The generated Excel workbook relies primarily on clean, portable formulas.
2. **Gemini Free-Tier Rate Limits**:
   Google AI Studio's free tier imposes strict limits (typically 2 to 15 Requests Per Minute depending on model tier). LedgerLite's sliding-window queue spaces out requests automatically. When pasting large CSV files, batch categorisation utilizes Tier 1 and Tier 2 rules first to preserve AI quota.
3. **Browser Storage Eviction**:
   While IndexedDB is durable, browsers under severe disk pressure may theoretically purge cache. LedgerLite incorporates an automatic **Weekly Backup Reminder** toast and includes an explicit **"Persist Vault"** button (`navigator.storage.persist()`) in Settings to ensure storage permanence.

---

## 10. License

MIT License. Designed and crafted for private personal finance sovereignty.
