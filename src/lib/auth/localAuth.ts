/**
 * On-device account adapter, used when Firebase is not configured.
 * Passwords are never stored: only a PBKDF2-SHA256 (210k iterations) hash with a
 * random 16-byte salt. This protects the vault from casual access on a shared
 * browser; it is not a substitute for a server-side identity provider.
 */
import type { AuthUser } from './types';
import { AuthError } from './types';

const ACCOUNTS_KEY = 'ledgerlite_local_accounts';
const SESSION_KEY = 'ledgerlite_local_session';
const ITERATIONS = 210_000;

interface StoredAccount {
  uid: string;
  email: string;
  displayName: string | null;
  salt: string; // base64
  hash: string; // base64
  createdAt: string; // ISO 8601
}

const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256
  );
  return toB64(bits);
}

function readAccounts(): Record<string, StoredAccount> {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAccounts(accounts: Record<string, StoredAccount>) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function toUser(a: StoredAccount): AuthUser {
  return { uid: a.uid, email: a.email, displayName: a.displayName, photoURL: null, provider: 'local' };
}

/** Constant-time string comparison to avoid leaking hash prefix matches. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const localAuth = {
  currentUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const { uid } = JSON.parse(raw) as { uid: string };
      const acct = Object.values(readAccounts()).find((a) => a.uid === uid);
      return acct ? toUser(acct) : null;
    } catch {
      return null;
    }
  },

  async signUp(email: string, password: string, displayName?: string): Promise<AuthUser> {
    const key = email.trim().toLowerCase();
    const accounts = readAccounts();
    if (accounts[key]) throw new AuthError('auth/email-already-in-use');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const acct: StoredAccount = {
      uid: `local_${crypto.randomUUID()}`,
      email: key,
      displayName: displayName?.trim() || null,
      salt: toB64(salt),
      hash: await derive(password, salt),
      createdAt: new Date().toISOString(),
    };
    accounts[key] = acct;
    writeAccounts(accounts);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ uid: acct.uid }));
    return toUser(acct);
  },

  async signIn(email: string, password: string): Promise<AuthUser> {
    const acct = readAccounts()[email.trim().toLowerCase()];
    // Derive even for unknown accounts so timing does not reveal which emails exist.
    const hash = await derive(password, acct ? fromB64(acct.salt) : new Uint8Array(16));
    if (!acct || !safeEqual(hash, acct.hash)) throw new AuthError('auth/invalid-credential');
    localStorage.setItem(SESSION_KEY, JSON.stringify({ uid: acct.uid }));
    return toUser(acct);
  },

  signOut() {
    localStorage.removeItem(SESSION_KEY);
  },
};
