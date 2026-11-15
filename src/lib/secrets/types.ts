export interface SecretsAdapter {
  getApiKey(): Promise<string | undefined>;
  setApiKey(key: string): Promise<void>;
  clearApiKey(): Promise<void>;
  testConnection(key?: string): Promise<{ success: boolean; message: string }>;
}
