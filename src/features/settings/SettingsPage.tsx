import React, { useState } from 'react';
import {
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Key,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { repository } from '@/data/repository';
import { secretsAdapter } from '@/lib/secrets';
import { seedDatabase } from '@/data/seed';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '@/constants/app';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, requestStoragePersistence } = useSettingsStore();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Load API key securely on mount
  React.useEffect(() => {
    const loadKey = async () => {
      const key = await secretsAdapter.getApiKey();
      if (key) {
        setApiKeyInput(key);
      }
    };
    loadKey();
  }, []);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    await secretsAdapter.setApiKey(apiKeyInput.trim());
    await updateSettings({ geminiApiKey: apiKeyInput.trim() });
    setStatusMsg({ type: 'success', text: 'Gemini API key saved securely via SecretsAdapter.' });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleTestConnection = async () => {
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const result = await secretsAdapter.testConnection(apiKeyInput.trim());
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown connection error',
      });
    } finally {
      setIsTestingKey(false);
    }
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
      const data = await repository.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${APP_NAME.toLowerCase()}_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await updateSettings({ lastBackupDate: new Date().toISOString() });
      setStatusMsg({ type: 'success', text: 'Backup exported to JSON file.' });
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
        await repository.importAll(json);
        setStatusMsg({ type: 'success', text: 'Data restored successfully! Reloading...' });
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        console.error(err);
        setStatusMsg({ type: 'error', text: 'Invalid JSON backup file.' });
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

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-deep-blue-950 dark:text-cream-100">
          Preferences & Data Vault
        </h2>
        <p className="text-xs text-deep-blue-700/70 dark:text-cream-300">
          Regional conventions, Gemini configuration, and offline data safety
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

      {/* App Branding & Defaults */}
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

      {/* AI Privacy & Gemini Settings */}
      <div className="p-6 rounded-card bg-white dark:bg-dark-surface border border-cream-200 dark:border-dark-border shadow-subtle space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-deep-blue-600 dark:text-cream-300" />
          <h3 className="font-semibold text-sm text-deep-blue-950 dark:text-cream-100">
            Gemini API Key & Privacy Mode
          </h3>
        </div>

        <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-dark-elevated border border-sky-200 dark:border-dark-border text-xs space-y-1.5 text-deep-blue-800 dark:text-cream-200">
          <div className="flex items-center gap-1.5 font-semibold">
            <Info className="w-4 h-4 text-deep-blue-600 dark:text-cream-300" />
            <span>Google Free-Tier Privacy Notice</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            On the free tier, prompts may be reviewed by human reviewers to train models. {APP_NAME} enables <strong>Privacy Mode by default</strong>: all receipts, raw notes, exact timestamps, and account numbers are stripped locally before sending.
          </p>
        </div>

        <form onSubmit={handleSaveApiKey} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-deep-blue-800 dark:text-cream-200 mb-1">
              Google AI Studio API Key
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-cream-50 dark:bg-dark-elevated border border-cream-200 dark:border-dark-border text-deep-blue-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-sky-400 font-mono"
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
                className={`mt-2 p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-status-success-bg text-status-success border border-status-success/30'
                    : 'bg-status-danger-bg text-status-danger border border-status-danger/30'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <p className="text-[11px] text-deep-blue-600/70 dark:text-cream-400 mt-1.5">
              Protected by SecretsAdapter. Stored locally in browser settings (IndexedDB / keychain ready).
            </p>
          </div>
        </form>
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
            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-sky-300 dark:border-dark-border hover:bg-sky-50 dark:hover:bg-dark-elevated text-deep-blue-900 dark:text-cream-100 text-xs font-semibold transition-colors"
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
