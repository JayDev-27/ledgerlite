export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: 'password' | 'google' | 'local';
}

export type AuthMode = 'firebase' | 'local';

export class AuthError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'AuthError';
  }
}

/** Human, non-enumerating error copy for Firebase and local auth codes. */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'That email and password don’t match. Try again or reset your password.';
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Sign in instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Use at least 8 characters for your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network unavailable. Check your connection and retry.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was closed before finishing.';
    case 'auth/unauthorized-domain':
      return 'This domain isn’t authorised for Google sign-in in Firebase yet.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is disabled in the Firebase console.';
    case 'auth/google-unavailable':
      return 'Google sign-in needs Firebase configuration. Add your VITE_FIREBASE_* keys to .env.';
    case 'auth/reset-unavailable':
      return 'Password reset needs Firebase. On-device accounts can’t recover a forgotten password.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
