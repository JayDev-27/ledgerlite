// In-app pages use the router's own `lazy`: the module loads *before* the
// navigation commits, so view transitions animate between two finished pages
// instead of flashing a spinner. Loaders are shared so prefetch hits the cache.
export const pageLoaders = {
  dashboard: () => import('@/features/dashboard/DashboardPage').then((m) => ({ Component: m.DashboardPage })),
  transactions: () => import('@/features/transactions/TransactionsPage').then((m) => ({ Component: m.TransactionsPage })),
  budgets: () => import('@/features/budgets/BudgetsPage').then((m) => ({ Component: m.BudgetsPage })),
  reports: () => import('@/features/reports/ReportsPage').then((m) => ({ Component: m.ReportsPage })),
  assistant: () => import('@/features/assistant/AssistantPage').then((m) => ({ Component: m.AssistantPage })),
  settings: () => import('@/features/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
};

/** Warm every in-app page chunk while the user reads the first one. */
export function prefetchAppPages(): void {
  Object.values(pageLoaders).forEach((load) => void load().catch(() => undefined));
}
