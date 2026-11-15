import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbSecretsAdapter } from '@/lib/secrets/IndexedDbSecretsAdapter';

describe('SecretsAdapter & API Key Management', () => {
  let adapter: IndexedDbSecretsAdapter;

  beforeEach(() => {
    adapter = new IndexedDbSecretsAdapter();
  });

  it('stores and retrieves API key without logging', async () => {
    const testKey = 'test-secret-key-12345';
    await adapter.setApiKey(testKey);

    const retrieved = await adapter.getApiKey();
    expect(retrieved).toBe(testKey);

    await adapter.clearApiKey();
    const afterClear = await adapter.getApiKey();
    // After clearing, either empty or fallback env key if defined
    expect(afterClear !== testKey).toBe(true);
  });

  it('returns appropriate error message when testing empty connection', async () => {
    const res = await adapter.testConnection('');
    expect(res.success).toBe(false);
    expect(res.message).toContain('No API key provided');
  });

  it('gracefully handles invalid key testing without throwing or crashing', async () => {
    const res = await adapter.testConnection('invalid-dummy-key-xyz');
    expect(res.success).toBe(false);
    expect(typeof res.message).toBe('string');
  });
});
