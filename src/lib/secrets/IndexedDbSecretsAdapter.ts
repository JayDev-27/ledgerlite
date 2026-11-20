import { repository } from '@/data/repository';
import { GoogleGenAI } from '@google/genai';
import type { SecretsAdapter } from './types';
import { CLOUD_MODE } from '@/lib/auth/firebase';

export class IndexedDbSecretsAdapter implements SecretsAdapter {
  async getApiKey(): Promise<string | undefined> {
    const stored = await repository.getSetting<string>('geminiApiKey');
    if (stored && typeof stored === 'string' && stored.trim().length > 0) {
      return stored.trim();
    }
    // Hosted website: every user brings their own key (stored in their private vault).
    // The .env fallback is a convenience for local development only.
    if (CLOUD_MODE || !import.meta.env.DEV) return undefined;
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
      return envKey.trim();
    }
    return undefined;
  }

  async setApiKey(key: string): Promise<void> {
    const trimmed = key.trim();
    await repository.setSetting('geminiApiKey', trimmed);
  }

  async clearApiKey(): Promise<void> {
    await repository.setSetting('geminiApiKey', '');
  }

  async testConnection(key?: string): Promise<{ success: boolean; message: string }> {
    const keyToTest = key !== undefined ? key.trim() : (await this.getApiKey());
    if (!keyToTest) {
      return { success: false, message: 'No API key provided or configured.' };
    }

    try {
      const ai = new GoogleGenAI({ apiKey: keyToTest });
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: 'ping',
      });
      if (response && response.text) {
        return { success: true, message: 'Successfully connected to Gemini API.' };
      }
      return { success: true, message: 'Connected to Gemini API.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Connection test failed: ${msg}` };
    }
  }
}

export const secretsAdapter = new IndexedDbSecretsAdapter();
