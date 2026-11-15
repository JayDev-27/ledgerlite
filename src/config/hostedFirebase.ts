/**
 * Public Firebase web config for the hosted LedgerLite site.
 *
 * Firebase web configs are not secrets — they ship in every Firebase site's
 * JavaScript. Access is enforced by Firestore security rules (owner-only
 * vaults) and Firebase Auth's authorised-domains list.
 *
 * Used only when the build runs on Vercel (`__LEDGERLITE_HOSTED__`), so local
 * clones stay in local-first mode unless VITE_FIREBASE_* variables are set.
 */
export const HOSTED_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDF9dqSfvjvIUhXOYcIvVPpv7bLMhnfXhc',
  authDomain: 'ai-nexus-6f96d.firebaseapp.com',
  projectId: 'ai-nexus-6f96d',
  appId: '1:770964279383:web:e274f360e51393aab79312',
  databaseId: 'ledgerlite',
} as const;
