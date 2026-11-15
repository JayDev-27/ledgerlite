import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthProvider';
import { CLOUD_MODE } from '@/lib/auth/firebase';

export const AuthSplash: React.FC<{ label?: string }> = ({ label = 'Unlocking vault' }) => (
  <div className="min-h-screen grid place-items-center bg-dark-bg" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-sky-400 animate-spin" />
      <span className="label-mono text-gallery-ash">{label}</span>
    </div>
  </div>
);

/**
 * Guards /app. On the hosted site it also opens the signed-in user's cloud
 * vault (Firestore → local working cache) before any page reads data.
 */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [vaultReady, setVaultReady] = useState(!CLOUD_MODE);
  const [vaultError, setVaultError] = useState<string | null>(null);

  useEffect(() => {
    if (!CLOUD_MODE || !user) return;
    let cancelled = false;
    setVaultReady(false);
    setVaultError(null);
    import('@/data/cloud/cloudVault')
      .then(({ activateCloudVault }) => activateCloudVault(user.uid))
      .then(() => !cancelled && setVaultReady(true))
      .catch((err) => {
        console.error('Could not open cloud vault:', err);
        if (!cancelled) setVaultError('We couldn’t reach your vault. Check your connection and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <AuthSplash />;
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  if (vaultError) {
    return (
      <div className="min-h-screen grid place-items-center bg-dark-bg px-6 text-center" role="alert">
        <div className="max-w-sm">
          <p className="text-white text-[17px]">{vaultError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 h-10 px-5 rounded-xl bg-white text-black text-[14px] font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!vaultReady) return <AuthSplash label="Syncing your vault" />;
  return <>{children}</>;
};
