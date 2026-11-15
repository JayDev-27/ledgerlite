import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { HOSTED_FIREBASE_CONFIG } from '@/config/hostedFirebase';

/**
 * Firebase is optional. When the VITE_FIREBASE_* variables are present the app
 * uses Firebase Authentication (email/password + Google). Without them it falls
 * back to the on-device local account adapter so the app still works offline.
 */
interface FirebaseEnv {
  databaseId?: string;
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
}

function readEnv(): FirebaseEnv {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const hosted = typeof __LEDGERLITE_HOSTED__ !== 'undefined' && __LEDGERLITE_HOSTED__;
  if (!env.VITE_FIREBASE_API_KEY && hosted) {
    return { ...HOSTED_FIREBASE_CONFIG };
  }
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    databaseId: env.VITE_FIREBASE_DATABASE_ID,
  };
}

export function isFirebaseConfigured(): boolean {
  const env = readEnv();
  return Boolean(env.apiKey && env.authDomain && env.projectId && env.appId);
}

/** True on the hosted website: Firebase Auth + per-user Firestore vaults. */
export const CLOUD_MODE = isFirebaseConfigured();

let appPromise: Promise<FirebaseApp> | null = null;
let authPromise: Promise<Auth> | null = null;

export function getFirebaseApp(): Promise<FirebaseApp> {
  if (!isFirebaseConfigured()) return Promise.reject(new Error('Firebase is not configured'));
  if (!appPromise) {
    appPromise = import('firebase/app').then(({ initializeApp, getApps }) => {
      const env = readEnv();
      return (
        getApps()[0] ??
        initializeApp({ apiKey: env.apiKey, authDomain: env.authDomain, projectId: env.projectId, appId: env.appId })
      );
    });
  }
  return appPromise;
}

/** Lazily loads the Firebase SDK so the landing page never pays for it. */
export function getFirebaseAuth(): Promise<Auth> {
  if (!isFirebaseConfigured()) {
    return Promise.reject(new Error('Firebase is not configured'));
  }
  if (!authPromise) {
    authPromise = (async () => {
      const [app, authMod] = await Promise.all([getFirebaseApp(), import('firebase/auth')]);
      const auth = authMod.getAuth(app);
      await authMod.setPersistence(auth, authMod.browserLocalPersistence);
      return auth;
    })();
  }
  return authPromise;
}

/** Named Firestore database for the vault, if any. */
export function getFirestoreDatabaseId(): string | undefined {
  return readEnv().databaseId || undefined;
}
