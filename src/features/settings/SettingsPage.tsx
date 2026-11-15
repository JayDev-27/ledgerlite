import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Key,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  Shield,
  Sliders,
  Cpu,
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useSettingsStore } from '@/store/settingsStore';
import { repository } from '@/data/repository';
import { secretsAdapter } from '@/lib/secrets';
import { seedDatabase } from '@/data/seed';
import { downloadBackupJson, restoreBackupPayload } from '@/lib/backup';
import { requestQueue, type TodayUsageStats } from '@/lib/gemini/requestQueue';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '@/constants/app';

const DEFAULT_HEAVY_MODELS = [
  'gemini-3.8-flash',
  'gemini-2.5-pro',
  'gemini-1.5-pro',
];

const DEFAULT_LIGHT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
];

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, requestStoragePersistence } = useSettingsStore();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Dynamic models discovery state
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Usage stats state
  const [usageStats, setUsageStats] = useState<TodayUsageStats | null>(null);

  const loadUsage = async () => {
    try {
      const stats = await requestQueue.getTodayUsage();
      setUsageStats(stats);
    } catch (e) {
      console.warn('Failed to load usage stats:', e);
    }
  };

  // Load API key securely and sync queue config on mount
  useEffect(() => {
    requestQueue.updateBudgets(settings.dailyAiBudgetHeavy ?? 20, settings.dailyAiBudgetLight ?? 200);
    requestQueue.setConfiguredModels(settings.geminiHeavyModel, settings.geminiLightModel);
    const loadKey = async () => {
      const key = await secretsAdapter.getApiKey();
      if (key) {
        setApiKeyInput(key);
        fetchModels(key);
      }
    };
    loadKey();
    loadUsage();
  }, [settings.dailyAiBudgetHeavy, settings.dailyAiBudgetLight, settings.geminiHeavyModel, settings.geminiLightModel]);

  const fetchModels = async (key: string) => {
    if (!key || !key.trim()) return;
    setIsLoadingModels(true);
    try {
      const ai = new GoogleGenAI({ apiKey: key.trim() });
      const pager = await ai.models.list();
      const modelNames: string[] = [];

      for await (const m of pager) {
        if (m.name) {
          // Strip 'models/' prefix if present
          const cleanName = m.name.replace(/^models\//, '');
          if (cleanName.includes('gemini') && !cleanName.includes('embedding') && !cleanName.includes('aqa')) {
            modelNames.push(cleanName);
          }
        }
      }

      if (modelNames.length > 0) {
        setDiscoveredModels(modelNames);
      }
    } catch (err) {
      console.warn('Dynamic model discovery failed, using curated defaults:', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    await secretsAdapter.setApiKey(apiKeyInput.trim());
    await updateSettings({ geminiApiKey: apiKeyInput.trim() });
    setStatusMsg({ type: 'success', text: 'Gemini API key saved securely via SecretsAdapter.' });
    setTimeout(() => setStatusMsg(null), 4000);
    fetchModels(apiKeyInput.trim());
  };

  const handleTestConnection = async () => {
    setIsTestingKey(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const result = await secretsAdapter.testConnection(apiKeyInput.trim());
      const latencyMs = Math.round(performance.now() - start);
      setTestResult({
        ...result,
        latencyMs,
      });
      if (result.success) {
        fetchModels(apiKeyInput.trim());
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown connection error',
        latencyMs: Math.round(performance.now() - start),
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleTogglePrivacyMode = async () => {
    const updated = !settings.privacyMode;
    await updateSettings({ privacyMode: updated });
    setStatusMsg({
      type: 'success',
      text: `Privacy Mode is now ${updated ? 'Active (Data Sanitized)' : 'Disabled'}.`,
    });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleBudgetChange = async (tier: 'heavy' | 'light', val: number) => {
    if (isNaN(val) || val < 1) return;
    if (tier === 'heavy') {
      await updateSettings({ dailyAiBudgetHeavy: val });
      requestQueue.updateBudgets(val, settings.dailyAiBudgetLight ?? 200);
    } else {
      await updateSettings({ dailyAiBudgetLight: val });
      requestQueue.updateBudgets(settings.dailyAiBudgetHeavy ?? 20, val);
    }
    await loadUsage();
  };

  const handlePersistStorage = async () => {
    const success = await requestStoragePersistence();
    if (success) {
      setStatusMsg({ type: 'success', text: 'Browser storage persistence granted successfully!' });
    } else {
      setStatusMsg({
        type: 'error',
        text: 'Browser declined storage persistence (or already granted). Data remains safely in IndexedDB.',
      });
    }
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const handleExportJson = async () => {
    try {
      await downloadBackupJson();
      await updateSettings({ lastBackupDate: new Date().toISOString() });
      setStatusMsg({ type: 'success', text: 'Backup exported successfully (all 9 tables).' });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Failed to export backup.' });
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const result = await restoreBackupPayload(json);
        setStatusMsg({
          type: 'success',
          text: `Data restored successfully! Restored ${result.summary?.transactionsCount ?? 0} transactions. Reloading...`,
        });
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        console.error(err);
        const msg = err instanceof Error ? err.message : 'Invalid JSON backup file.';
        setStatusMsg({ type: 'error', text: msg });
      }
    };
    reader.readAsText(file);
  };

  const handleReseed = async () => {
    if (
      window.confirm(
        'This will regenerate the ~800 demo transactions from May to Nov 2026. Proceed?'
      )
    ) {
      setIsSeeding(true);
      try {
        const result = await seedDatabase(repository, true);
        setStatusMsg({
          type: 'success',
          text: `Seeded ${result.transactionsCount} transactions across 6 months!`,
        });
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        console.error(err);
        setStatusMsg({ type: 'error', text: 'Failed to seed database.' });
      } finally {
        setIsSeeding(false);
      }
    }
  };

  const handleClearAll = async () => {
    if (
      window.confirm(
        'DANGER: This will delete ALL transactions, budgets, categories, and memory. Are you sure?'
      )
    ) {
      await repository.clearAll();
      setStatusMsg({ type: 'success', text: 'Database completely cleared.' });
      setTimeout(() => window.location.reload(), 1200);
    }
  };

  // Merge discovered models with defaults
  const heavyOptions = Array.from(
    new Set([...DEFAULT_HEAVY_MODELS, ...discoveredModels.filter((m) => requestQueue.isHeavyModel(m))])
  );
  const lightOptions = Array.from(
    new Set([...DEFAULT_LIGHT_MODELS, ...discoveredModels.filter((m) => !requestQueue.isHeavyModel(m))])
  );

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-deep-blue-950 dark:text-cream-100">
          Preferences & Data Vault
        </h2>
        <p className="text-xs text-deep-blue-700/70 dark:text-cream-300">
          Regional conventions, Gemini dynamic models, quota controls, and offline data safety
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold ${
            statusMsg.type === 'success'
              ? 'bg-status-success-bg text-status-success border border-status-success/20'
              : 'bg-status-danger-bg text-status-danger border border-status-danger/20'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* App Defaults */}
      <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-cream-100 dark:border-dark-border">
          <div>
            <h3 className="font-semibold text-sm text-deep-blue-950 dark:text-cream-100">
              {APP_NAME} — {APP_TAGLINE}
            </h3>
            <p className="text-xs text-deep-blue-700/70 dark:text-cream-400">
              Configured for Indian Financial Year & Lakh/Crore grouping
            </p>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-cream-100 dark:bg-dark-elevated text-deep-blue-800 dark:text-cream-300">
            v{APP_VERSION}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-medium text-deep-blue-800 dark:text-cream-200 mb-1">
              Currency & Symbol
            </label>
            <input
              type="text"
              disabled
              value={`${settings.currency} (${settings.currencySymbol})`}
              className="w-full px-3 py-2 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100"
            />
          </div>

          <div>
            <label className="block font-medium text-deep-blue-800 dark:text-cream-200 mb-1">
              Locale & Digit Grouping
            </label>
            <input
              type="text"
              disabled
              value={settings.locale}
              className="w-full px-3 py-2 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100"
            />
          </div>

          <div>
            <label className="block font-medium text-deep-blue-800 dark:text-cream-200 mb-1">
              Week Starts On
            </label>
            <input
              type="text"
              disabled
              value="Monday (1)"
              className="w-full px-3 py-2 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100"
            />
          </div>

          <div>
            <label className="block font-medium text-deep-blue-800 dark:text-cream-200 mb-1">
              Financial Year Start
            </label>
            <input
              type="text"
              disabled
              value="April (1st April - 31st March)"
              className="w-full px-3 py-2 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100"
            />
          </div>
        </div>
      </div>

      {/* Gemini Settings & Dynamic Model Discovery */}
      <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-deep-blue-600 dark:text-cream-300" />
            <h3 className="font-semibold text-sm text-deep-blue-950 dark:text-cream-100">
              Gemini API & Dynamic Model Discovery
            </h3>
          </div>
          {isLoadingModels && (
            <span className="flex items-center gap-1.5 text-xs text-deep-blue-600 dark:text-cream-300">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Discovering models...</span>
            </span>
          )}
        </div>

        {/* Privacy Mode Disclosure Box */}
        <div className="p-4 rounded-xl bg-deep-blue-50/70 dark:bg-dark-elevated border border-deep-blue-200/60 dark:border-dark-border text-xs space-y-3 text-deep-blue-900 dark:text-cream-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-deep-blue-950 dark:text-cream-100">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Privacy Mode (Free-Tier Protection)</span>
            </div>

            <button
              type="button"
              onClick={handleTogglePrivacyMode}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                settings.privacyMode
                  ? 'bg-emerald-600 text-cream-100'
                  : 'bg-cream-200 dark:bg-dark-surface text-deep-blue-800 dark:text-cream-300'
              }`}
            >
              {settings.privacyMode ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-deep-blue-800/80 dark:text-cream-300">
            <strong>Mandatory Free-Tier Disclosure:</strong> Prompts sent over Google's free-tier Gemini API may be processed and reviewed by Google for product improvement. When <strong>Privacy Mode is enabled</strong> (default), {APP_NAME} strips all personal notes, exact receipt details, timestamps, and account identifiers locally in your browser before sending, transmitting only pseudonymized and aggregated quantitative data.
          </p>
        </div>

        {/* API Key Form */}
        <form onSubmit={handleSaveApiKey} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-deep-blue-800 dark:text-cream-200 mb-1">
              Google AI Studio Secret API Key
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-deep-blue-400 font-mono"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold transition-colors flex-shrink-0"
                >
                  Save Key
                </button>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingKey || !apiKeyInput.trim()}
                  className="px-3.5 py-2 rounded-lg border border-deep-blue-300 dark:border-dark-border hover:bg-cream-100 dark:hover:bg-dark-elevated text-deep-blue-900 dark:text-cream-100 text-xs font-semibold disabled:opacity-50 transition-colors flex-shrink-0 flex items-center gap-1.5"
                >
                  {isTestingKey ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <span>Test Connection</span>
                  )}
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`mt-2 p-2.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                  testResult.success
                    ? 'bg-status-success-bg text-status-success border border-status-success/30'
                    : 'bg-status-danger-bg text-status-danger border border-status-danger/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
                {testResult.latencyMs !== undefined && (
                  <span className="font-mono text-[11px] font-bold">
                    Latency: {testResult.latencyMs}ms
                  </span>
                )}
              </div>
            )}
            <p className="text-[11px] text-deep-blue-600/70 dark:text-cream-400 mt-1">
              Encrypted and stored locally via SecretsAdapter in browser IndexedDB. Never transmitted to third-party servers.
            </p>
          </div>
        </form>

        {/* Dynamic Model Dropdowns */}
        <div className="pt-2 border-t border-cream-100 dark:border-dark-border grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-deep-blue-900 dark:text-cream-100 mb-1 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
              <span>Heavy Model (Comprehensive Reports & Budgets)</span>
            </label>
            <select
              value={settings.geminiHeavyModel}
              onChange={(e) => {
                const val = e.target.value;
                updateSettings({ geminiHeavyModel: val });
                requestQueue.setConfiguredModels(val, settings.geminiLightModel);
              }}
              className="w-full px-3 py-2 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-deep-blue-400"
            >
              {heavyOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} {opt === 'gemini-3.8-flash' ? '(Recommended Default)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-deep-blue-600/70 dark:text-cream-400 mt-1">
              Used for executive financial reports, 50/30/20 recommendations, and deep pattern analysis.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-deep-blue-900 dark:text-cream-100 mb-1 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-deep-blue-600 dark:text-cream-300" />
              <span>Light Model (Quick-Add, Categorisation & Chat)</span>
            </label>
            <select
              value={settings.geminiLightModel}
              onChange={(e) => {
                const val = e.target.value;
                updateSettings({ geminiLightModel: val });
                requestQueue.setConfiguredModels(settings.geminiHeavyModel, val);
              }}
              className="w-full px-3 py-2 rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-deep-blue-400"
            >
              {lightOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} {opt === 'gemini-3.5-flash-lite' ? '(Recommended Default)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-deep-blue-600/70 dark:text-cream-400 mt-1">
              Low-latency model for instant natural language expense parsing and conversational turns.
            </p>
          </div>
        </div>

        {/* User-Configurable Daily AI Budget Limit & Live Meters */}
        <div className="pt-2 border-t border-cream-100 dark:border-dark-border space-y-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-deep-blue-600 dark:text-cream-300" />
            <h4 className="font-semibold text-xs text-deep-blue-950 dark:text-cream-100">
              Daily AI Request Quota Limits & Real-Time Meters
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Heavy Model Meter */}
            <div className="p-3 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border space-y-2">
              <div className="flex items-center justify-between font-semibold text-deep-blue-900 dark:text-cream-100">
                <span>Heavy Model Quota</span>
                <span className="font-mono text-[11px]">
                  {usageStats?.heavyCount ?? 0} / {settings.dailyAiBudgetHeavy ?? 20} today
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-cream-200 dark:bg-dark-surface overflow-hidden">
                <div
                  className="h-full bg-deep-blue-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((usageStats?.heavyCount ?? 0) / (settings.dailyAiBudgetHeavy ?? 20)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-deep-blue-700/70 dark:text-cream-400">Daily limit:</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={settings.dailyAiBudgetHeavy ?? 20}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) handleBudgetChange('heavy', v);
                  }}
                  className="w-20 px-2 py-1 text-xs rounded bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border font-mono text-right"
                />
              </div>
            </div>

            {/* Light Model Meter */}
            <div className="p-3 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border space-y-2">
              <div className="flex items-center justify-between font-semibold text-deep-blue-900 dark:text-cream-100">
                <span>Light Model Quota</span>
                <span className="font-mono text-[11px]">
                  {usageStats?.lightCount ?? 0} / {settings.dailyAiBudgetLight ?? 200} today
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-cream-200 dark:bg-dark-surface overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((usageStats?.lightCount ?? 0) / (settings.dailyAiBudgetLight ?? 200)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-deep-blue-700/70 dark:text-cream-400">Daily limit:</span>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={settings.dailyAiBudgetLight ?? 200}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) handleBudgetChange('light', v);
                  }}
                  className="w-20 px-2 py-1 text-xs rounded bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border font-mono text-right"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Safety & Storage Persistence */}
      <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-deep-blue-600 dark:text-cream-300" />
          <h3 className="font-semibold text-sm text-deep-blue-950 dark:text-cream-100">
            Storage Persistence & Eviction Shield
          </h3>
        </div>

        <p className="text-xs text-deep-blue-700/80 dark:text-cream-300 leading-relaxed">
          Modern browsers may evict IndexedDB storage if your hard drive runs low on space. Requesting persistent storage protects your financial data from automated browser cleanup.
        </p>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border">
          <div className="text-xs">
            <span className="font-semibold text-deep-blue-900 dark:text-cream-100">
              Persistence Status:{' '}
            </span>
            <span
              className={
                settings.storagePersisted
                  ? 'text-status-success font-semibold'
                  : 'text-status-warning font-semibold'
              }
            >
              {settings.storagePersisted ? 'Active (Protected)' : 'Standard (Unprotected)'}
            </span>
          </div>

          {!settings.storagePersisted && (
            <button
              onClick={handlePersistStorage}
              className="px-3 py-1.5 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 text-xs font-semibold transition-colors"
            >
              Request Persistence
            </button>
          )}
        </div>
      </div>

      {/* Backup, Restore & Reset */}
      <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
        <h3 className="font-semibold text-sm text-deep-blue-950 dark:text-cream-100">
          Database Management & Backup
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleExportJson}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-cream-300 dark:border-dark-border hover:bg-cream-50 dark:hover:bg-dark-elevated text-deep-blue-900 dark:text-cream-100 text-xs font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-deep-blue-600 dark:text-cream-300" />
            <span>Export JSON Backup</span>
          </button>

          <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-cream-300 dark:border-dark-border hover:bg-cream-50 dark:hover:bg-dark-elevated text-deep-blue-900 dark:text-cream-100 text-xs font-semibold cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-deep-blue-600 dark:text-cream-300" />
            <span>Restore JSON Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>

          <button
            onClick={handleReseed}
            disabled={isSeeding}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-deep-blue-200 dark:border-dark-border hover:bg-cream-100 dark:hover:bg-dark-elevated text-deep-blue-900 dark:text-cream-100 text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-deep-blue-600 dark:text-cream-300 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>Re-seed Demo Data (~800 Txs)</span>
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-status-danger/30 hover:bg-status-danger-bg text-status-danger text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Wipe Local Database</span>
          </button>
        </div>
      </div>
    </div>
  );
};
