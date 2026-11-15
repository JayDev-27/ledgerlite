import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AuthProvider } from './lib/auth/AuthProvider';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
