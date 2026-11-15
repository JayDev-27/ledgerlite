import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * In-memory stand-in for the slice of firebase/firestore the cloud vault uses.
 * Paths are "users/{uid}/{table}/{docId}" so isolation between users is visible.
 */
const store = new Map<string, Record<string, unknown>>();

vi.mock('firebase/firestore', () => {
  const collection = (_fs: unknown, ...segments: string[]) => ({ path: segments.join('/') });
  const doc = (col: { path: string }, id: string) => ({ path: `${col.path}/${id}` });
  const getDocs = async (col: { path: string }) => ({
    docs: [...store.entries()]
      .filter(([k]) => k.startsWith(col.path + '/') && !k.slice(col.path.length + 1).includes('/'))
      .map(([k, v]) => ({ ref: { path: k }, data: () => structuredClone(v) })),
  });
  const writeBatch = () => {
    const ops: Array<() => void> = [];
    return {
      set: (ref: { path: string }, data: Record<string, unknown>) => ops.push(() => store.set(ref.path, structuredClone(data))),
      delete: (ref: { path: string }) => ops.push(() => store.delete(ref.path)),
      commit: async () => ops.forEach((op) => op()),
    };
  };
  return { getFirestore: () => ({}), collection, doc, getDocs, writeBatch };
});

vi.mock('@/lib/auth/firebase', () => ({
  getFirebaseApp: async () => ({}),
  getFirestoreDatabaseId: () => 'ledgerlite',
  CLOUD_MODE: true,
}));

import { activateCloudVault, deactivateCloudVault } from '@/data/cloud/cloudVault';
import { repository, getActiveVaultId } from '@/data/repository';

const tx = (id: string, amount: number) => ({
  id,
  date: '2026-11-10',
  amount,
  merchant: 'Swiggy',
  categoryId: 'cat_food',
  paymentMethod: 'upi' as const,
  source: 'manual' as const,
  tags: [],
});

// Writes are debounced (400 ms) before being batched to Firestore.
const settle = () => new Promise((r) => setTimeout(r, 500));

describe('Cloud vault — Firestore-backed per-user storage', () => {
  beforeEach(async () => {
    await deactivateCloudVault();
    store.clear();
  });

  it('routes the shared repository to the signed-in user and back to local on sign-out', async () => {
    await activateCloudVault('alice');
    expect(getActiveVaultId()).toBe('cloud:alice');
    await deactivateCloudVault();
    expect(getActiveVaultId()).toBe('local');
  });

  it('mirrors creates, updates and deletes to users/{uid}/…', async () => {
    await activateCloudVault('alice');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await repository.createTransaction(tx('t1', 420) as any);
    await settle();
    expect(store.get('users/alice/transactions/t1')).toMatchObject({ amount: 420, merchant: 'Swiggy' });

    await repository.updateTransaction('t1', { amount: 500 });
    await settle();
    expect(store.get('users/alice/transactions/t1')).toMatchObject({ amount: 500 });

    await repository.deleteTransaction('t1');
    await settle();
    expect(store.has('users/alice/transactions/t1')).toBe(false);
  });

  it('rebuilds the vault from Firestore on sign-in without echoing writes back', async () => {
    store.set('users/bob/transactions/b1', {
      ...tx('b1', 999),
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-10T00:00:00.000Z',
    });
    await activateCloudVault('bob');
    const all = await repository.getAllTransactions();
    expect(all.map((t) => t.id)).toEqual(['b1']);
    await settle();
    expect([...store.keys()].filter((k) => k.startsWith('users/bob/'))).toEqual(['users/bob/transactions/b1']);
  });

  it('keeps users isolated from each other', async () => {
    await activateCloudVault('alice');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await repository.createTransaction(tx('a1', 100) as any);
    await deactivateCloudVault(); // flushes pending writes
    await activateCloudVault('bob');
    expect(await repository.getAllTransactions()).toEqual([]);
    expect(store.has('users/alice/transactions/a1')).toBe(true);
    expect([...store.keys()].some((k) => k.startsWith('users/bob/'))).toBe(false);
  });

  it('flushes pending writes on sign-out and wipes remote data on clearAll', async () => {
    await activateCloudVault('carol');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await repository.createTransaction(tx('c1', 10) as any);
    await repository.setSetting('geminiApiKey', 'user-supplied-key');
    await deactivateCloudVault();
    expect(store.has('users/carol/transactions/c1')).toBe(true);
    expect(store.get('users/carol/settings/geminiApiKey')).toMatchObject({ value: 'user-supplied-key' });

    await activateCloudVault('carol');
    await repository.clearAll();
    expect([...store.keys()].some((k) => k.startsWith('users/carol/'))).toBe(false);
  });
});
