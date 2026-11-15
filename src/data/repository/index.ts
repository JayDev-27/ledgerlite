import type { Repository } from './types';
import { localRepository } from './DexieRepository';

export * from './types';
export { DexieRepository, localRepository } from './DexieRepository';

/**
 * The app imports one `repository` everywhere. It forwards to whichever vault
 * is active: the shared on-device vault (local mode / signed out) or a signed-in
 * user's cloud-synced vault on the hosted site. Swapping happens at sign-in,
 * before any page renders, so callers never hold a stale instance.
 */
let active: Repository = localRepository;
let activeVaultId = 'local';

export function setActiveRepository(next: Repository, vaultId: string): void {
  active = next;
  activeVaultId = vaultId;
}

export function getActiveVaultId(): string {
  return activeVaultId;
}

export const repository: Repository = new Proxy({} as Repository, {
  get(_target, prop) {
    const value = (active as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(active) : value;
  },
});
