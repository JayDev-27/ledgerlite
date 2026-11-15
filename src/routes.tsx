import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth, AuthSplash } from '@/components/auth/RequireAuth';

// Route-level code splitting: the landing page never downloads the dashboard,
// charts, ExcelJS or Gemini SDK, and vice versa.
const LandingPage = lazy(() => import('@/features/landing/LandingPage'));
const SignInPage = lazy(() => import('@/features/auth/SignInPage'));
const Shell = lazy(() => import('@/components/layout/Shell').then((m) => ({ default: m.Shell })));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TransactionsPage = lazy(() =>
  import('@/features/transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage }))
);
const BudgetsPage = lazy(() => import('@/features/budgets/BudgetsPage').then((m) => ({ default: m.BudgetsPage })));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const AssistantPage = lazy(() => import('@/features/assistant/AssistantPage').then((m) => ({ default: m.AssistantPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const PageFallback: React.FC = () => (
  <div className="min-h-[40vh] grid place-items-center" role="status" aria-label="Loading">
    <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-sky-400 animate-spin" />
  </div>
);

const page = (el: React.ReactNode) => <Suspense fallback={<PageFallback />}>{el}</Suspense>;

const APP_SECTIONS = ['transactions', 'budgets', 'reports', 'assistant', 'settings'] as const;

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<AuthSplash />}>
        <LandingPage />
      </Suspense>
    ),
  },
  {
    path: '/signin',
    element: (
      <Suspense fallback={<AuthSplash />}>
        <SignInPage />
      </Suspense>
    ),
  },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <Suspense fallback={<AuthSplash />}>
          <Shell />
        </Suspense>
      </RequireAuth>
    ),
    children: [
      { index: true, element: page(<DashboardPage />) },
      { path: 'transactions', element: page(<TransactionsPage />) },
      { path: 'budgets', element: page(<BudgetsPage />) },
      { path: 'reports', element: page(<ReportsPage />) },
      { path: 'assistant', element: page(<AssistantPage />) },
      { path: 'settings', element: page(<SettingsPage />) },
      { path: '*', element: <Navigate to="/app" replace /> },
    ],
  },
  // Old bookmarks (/transactions, /budgets…) move under /app.
  ...APP_SECTIONS.map((s) => ({ path: `/${s}`, element: <Navigate to={`/app/${s}`} replace /> })),
  { path: '*', element: <Navigate to="/" replace /> },
]);
