import { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth, AuthSplash } from '@/components/auth/RequireAuth';
import { pageLoaders } from '@/pageLoaders';

// Route-level code splitting: the landing page never downloads the dashboard,
// charts, ExcelJS or Gemini SDK, and vice versa.
const LandingPage = lazy(() => import('@/features/landing/LandingPage'));
const SignInPage = lazy(() => import('@/features/auth/SignInPage'));
const Shell = lazy(() => import('@/components/layout/Shell').then((m) => ({ default: m.Shell })));
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
      { index: true, lazy: pageLoaders.dashboard },
      { path: 'transactions', lazy: pageLoaders.transactions },
      { path: 'budgets', lazy: pageLoaders.budgets },
      { path: 'reports', lazy: pageLoaders.reports },
      { path: 'assistant', lazy: pageLoaders.assistant },
      { path: 'settings', lazy: pageLoaders.settings },
      { path: '*', element: <Navigate to="/app" replace /> },
    ],
  },
  // Old bookmarks (/transactions, /budgets…) move under /app.
  ...APP_SECTIONS.map((s) => ({ path: `/${s}`, element: <Navigate to={`/app/${s}`} replace /> })),
  { path: '*', element: <Navigate to="/" replace /> },
]);
