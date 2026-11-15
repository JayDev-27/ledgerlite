import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './firebase';
import { localAuth } from './localAuth';
import { AuthError, type AuthMode, type AuthUser } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  mode: AuthMode;
  googleAvailable: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function fromFirebase(u: User): AuthUser {
  const isGoogle = u.providerData.some((p) => p.providerId === 'google.com');
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
    provider: isGoogle ? 'google' : 'password',
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mode: AuthMode = isFirebaseConfigured() ? 'firebase' : 'local';
  const [user, setUser] = useState<AuthUser | null>(() => (mode === 'local' ? localAuth.currentUser() : null));
  const [loading, setLoading] = useState(mode === 'firebase');

  useEffect(() => {
    if (mode !== 'firebase') return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const auth = await getFirebaseAuth();
        const { onAuthStateChanged, getRedirectResult } = await import('firebase/auth');
        // Completes a Google redirect flow if the popup was blocked earlier.
        getRedirectResult(auth).catch(() => undefined);
        if (cancelled) return;
        unsub = onAuthStateChanged(auth, (u) => {
          setUser(u ? fromFirebase(u) : null);
          setLoading(false);
        });
      } catch (err) {
        console.error('Auth initialisation failed:', err);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [mode]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (mode === 'local') {
        setUser(await localAuth.signIn(email, password));
        return;
      }
      const auth = await getFirebaseAuth();
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      setUser(fromFirebase(cred.user));
    },
    [mode]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name?: string) => {
      if (password.length < 8) throw new AuthError('auth/weak-password');
      if (mode === 'local') {
        setUser(await localAuth.signUp(email, password, name));
        return;
      }
      const auth = await getFirebaseAuth();
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name?.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      setUser(fromFirebase(cred.user));
    },
    [mode]
  );

  const signInWithGoogle = useCallback(async () => {
    if (mode === 'local') throw new AuthError('auth/google-unavailable');
    const auth = await getFirebaseAuth();
    const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const cred = await signInWithPopup(auth, provider);
      setUser(fromFirebase(cred.user));
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
  }, [mode]);

  const resetPassword = useCallback(
    async (email: string) => {
      if (mode === 'local') throw new AuthError('auth/reset-unavailable');
      const auth = await getFirebaseAuth();
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, email.trim());
    },
    [mode]
  );

  const signOut = useCallback(async () => {
    if (mode === 'local') {
      localAuth.signOut();
    } else {
      // Flush pending writes while still authenticated, then drop the local cache.
      const { deactivateCloudVault } = await import('@/data/cloud/cloudVault');
      await deactivateCloudVault();
      const auth = await getFirebaseAuth();
      const { signOut: fbSignOut } = await import('firebase/auth');
      await fbSignOut(auth);
    }
    setUser(null);
  }, [mode]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      mode,
      googleAvailable: mode === 'firebase',
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      resetPassword,
      signOut,
    }),
    [user, loading, mode, signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
