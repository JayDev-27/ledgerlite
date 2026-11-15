/**
 * Cloud vault (hosted website only).
 *
 * Firestore is the source of truth: users/{uid}/{table}/{docId}. A per-user
 * IndexedDB cache (LedgerLiteDB_<uid>) holds a working copy so the existing
 * repository logic and charts stay fast. On sign-in the cache is rebuilt from
 * Firestore; every local write is mirrored back through Dexie hooks; on
 * sign-out the cache is deleted, so nothing lingers on a shared computer.
 */
import Dexie, { type Table } from 'dexie';
import type { Firestore, WriteBatch } from 'firebase/firestore';
import { FinanceDatabase } from '@/data/db';
import { DexieRepository, setActiveRepository, localRepository } from '@/data/repository';
import { getFirebaseApp, getFirestoreDatabaseId } from '@/lib/auth/firebase';

const TABLES = ['transactions', 'categories', 'budgets', 'rules', 'recurring', 'memory', 'reports', 'aiUsage', 'settings'] as const;
type TableName = (typeof TABLES)[number];

export type SyncState = 'idle' | 'syncing' | 'error';
let syncState: SyncState = 'idle';
const listeners = new Set<(s: SyncState) => void>();
function setSyncState(s: SyncState) {
  if (s === syncState) return;
  syncState = s;
  listeners.forEach((fn) => fn(s));
}
export const getSyncState = () => syncState;
export function onSyncStateChange(fn: (s: SyncState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

type PendingOp = { kind: 'set'; data: Record<string, unknown> } | { kind: 'delete' };

/** Firestore rejects `undefined`; a JSON round-trip strips it and normalises Dates to ISO strings. */
const clean = (obj: unknown) => JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;

class CloudSyncedRepository extends DexieRepository {
  private pending = new Map<string, PendingOp>(); // key: `${table}/${docId}`
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private suppress = false;

  constructor(
    database: FinanceDatabase,
    private fs: Firestore,
    private fsMod: typeof import('firebase/firestore'),
    public readonly uid: string
  ) {
    super(database);
    this.installHooks();
    window.addEventListener('pagehide', this.flushNow);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get cache(): FinanceDatabase {
    return this.db;
  }

  private table(name: TableName): Table {
    return (this.db as unknown as Record<TableName, Table>)[name];
  }

  private col(name: TableName) {
    return this.fsMod.collection(this.fs, 'users', this.uid, name);
  }

  private installHooks() {
    for (const name of TABLES) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const repo = this;
      this.table(name).hook('creating', function (primKey, obj) {
        if (repo.suppress) return;
        this.onsuccess = (key: unknown) => {
          const id = key ?? primKey;
          const data = clean(obj);
          if (name === 'aiUsage') data.id = id; // auto-increment key isn't on the object
          repo.queue(name, String(id), { kind: 'set', data });
        };
      });
      this.table(name).hook('updating', function (_mods, primKey) {
        if (repo.suppress) return;
        this.onsuccess = (updated: unknown) => repo.queue(name, String(primKey), { kind: 'set', data: clean(updated) });
      });
      this.table(name).hook('deleting', function (primKey) {
        if (repo.suppress) return;
        this.onsuccess = () => repo.queue(name, String(primKey), { kind: 'delete' });
      });
    }
  }

  private queue(name: TableName, docId: string, op: PendingOp) {
    this.pending.set(`${name}/${docId}`, op);
    setSyncState('syncing');
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(), 400);
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') void this.flush();
  };

  flushNow = () => {
    void this.flush();
  };

  async flush(): Promise<void> {
    if (this.flushing) await this.flushing;
    if (!this.pending.size) return;
    const ops = [...this.pending.entries()];
    this.pending.clear();
    const { writeBatch, doc } = this.fsMod;
    this.flushing = (async () => {
      try {
        for (let i = 0; i < ops.length; i += 450) {
          const batch: WriteBatch = writeBatch(this.fs);
          for (const [path, op] of ops.slice(i, i + 450)) {
            const slash = path.indexOf('/');
            const ref = doc(this.col(path.slice(0, slash) as TableName), path.slice(slash + 1));
            if (op.kind === 'set') batch.set(ref, op.data);
            else batch.delete(ref);
          }
          await batch.commit();
        }
        if (!this.pending.size) setSyncState('idle');
      } catch (err) {
        console.error('[cloud] sync failed, retrying in 5s:', err);
        // Restore failed ops (newer queued ops for the same doc win)
        for (const [path, op] of ops) if (!this.pending.has(path)) this.pending.set(path, op);
        setSyncState('error');
        this.flushTimer = setTimeout(() => void this.flush(), 5000);
      } finally {
        this.flushing = null;
      }
    })();
    await this.flushing;
  }

  /** Rebuild the local cache from Firestore without echoing writes back. */
  async pull(): Promise<void> {
    const { getDocs } = this.fsMod;
    const snapshots = await Promise.all(TABLES.map((t) => getDocs(this.col(t))));
    this.suppress = true;
    try {
      await this.db.transaction('rw', TABLES.map((t) => this.table(t)), async () => {
        for (let i = 0; i < TABLES.length; i++) {
          const rows = snapshots[i]!.docs.map((d) => d.data());
          if (rows.length) await this.table(TABLES[i]!).bulkPut(rows);
        }
      });
    } finally {
      this.suppress = false;
    }
  }

  private async clearRemote(): Promise<void> {
    await this.flush();
    const { getDocs, writeBatch } = this.fsMod;
    for (const t of TABLES) {
      const snap = await getDocs(this.col(t));
      for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = writeBatch(this.fs);
        snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  }

  // Dexie's clear() bypasses hooks, so wipe/replace operations mirror explicitly.
  override async clearAll(): Promise<void> {
    await this.clearRemote();
    await super.clearAll();
  }

  override async importAll(data: Record<string, unknown>): Promise<void> {
    await this.clearRemote();
    await super.importAll(data); // re-adds fire 'creating' hooks → pushed to Firestore
    await this.flush();
  }

  async dispose(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    await this.flush();
    window.removeEventListener('pagehide', this.flushNow);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.db.close();
  }
}

let current: CloudSyncedRepository | null = null;
const cacheName = (uid: string) => `LedgerLiteDB_${uid}`;

/** Activate the signed-in user's vault: fresh cache from Firestore, then route all reads/writes to it. */
export async function activateCloudVault(uid: string): Promise<void> {
  if (current?.uid === uid) return;
  await deactivateCloudVault();

  const [app, fsMod] = await Promise.all([getFirebaseApp(), import('firebase/firestore')]);
  // Optional named database (keeps LedgerLite isolated inside a shared Firebase project)
  const dbId = getFirestoreDatabaseId();
  const fs = dbId ? fsMod.getFirestore(app, dbId) : fsMod.getFirestore(app);

  await Dexie.delete(cacheName(uid)); // never trust a stale cache — Firestore is the truth
  const repo = new CloudSyncedRepository(new FinanceDatabase(cacheName(uid)), fs, fsMod, uid);
  setSyncState('syncing');
  await repo.pull();
  setSyncState('idle');
  current = repo;
  setActiveRepository(repo, `cloud:${uid}`);
}

/** Flush pending writes, detach, and delete the local cache. */
export async function deactivateCloudVault(): Promise<void> {
  if (!current) return;
  const repo = current;
  const name = repo.cache.name;
  current = null;
  setActiveRepository(localRepository, 'local');
  await repo.dispose();
  await Dexie.delete(name);
}
