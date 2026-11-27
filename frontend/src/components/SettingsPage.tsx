import React, { useState } from 'react';
import { Server, CheckCircle2, AlertCircle, Upload, Download, Database, Moon, Sun, Monitor } from 'lucide-react';
import type { Account, CsvImportResult, Settings } from '../types';
import { api, getBackendUrl, isNativeApp, setBackendUrl } from '../api';

interface Props {
  settings: Settings;
  accounts: Account[];
  onSaveSettings: (payload: Partial<Settings>) => Promise<void>;
  onImported: () => void;
  onBackendChanged: () => void;
}

export const SettingsPage: React.FC<Props> = ({
  settings,
  accounts,
  onSaveSettings,
  onImported,
  onBackendChanged
}) => {
  const [serverUrl, setServerUrl] = useState(getBackendUrl());
  const [testState, setTestState] = useState<{ status: 'idle' | 'testing' | 'ok' | 'error'; msg?: string }>({
    status: 'idle'
  });

  const [csvText, setCsvText] = useState('');
  const [importAccountId, setImportAccountId] = useState<number>(accounts[0]?.id || 0);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleTestAndSaveUrl = async () => {
    setTestState({ status: 'testing', msg: 'Checking connection...' });
    try {
      const res = await api.health(serverUrl);
      setBackendUrl(serverUrl);
      setTestState({ status: 'ok', msg: `Connected (${res.latencyMs}ms · ${res.currency})` });
      onBackendChanged();
    } catch (err) {
      setTestState({
        status: 'error',
        msg: err instanceof Error ? err.message : 'Unable to reach backend server'
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result || ''));
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportError('');
    setImportResult(null);
    try {
      const res = await api.importCsv(csvText, importAccountId || accounts[0]?.id);
      setImportResult(res);
      if (res.imported > 0) onImported();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Shared Backend Connection */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <Server className="w-5 h-5 text-indigo-500" />
          <div>
            <h2 className="text-base font-semibold">Shared Backend Server</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isNativeApp()
                ? 'Point your Android app to your laptop/server LAN IP (e.g. http://192.168.1.50:3001) to stay synced with the web app.'
                : 'Leave blank to use the same origin (recommended on Web), or enter a remote server URL.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            placeholder={isNativeApp() ? 'http://192.168.1.50:3001' : 'Same origin (leave empty) or http://host:3001'}
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
          />
          <button
            onClick={handleTestAndSaveUrl}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shrink-0"
          >
            Test & Save
          </button>
        </div>

        {testState.status !== 'idle' && (
          <div
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${
              testState.status === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : testState.status === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {testState.status === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : testState.status === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : null}
            <span>{testState.msg}</span>
          </div>
        )}
      </div>

      {/* Preferences */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <h2 className="text-base font-semibold">Preferences</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Default Currency</label>
            <select
              value={settings.currency || 'EUR'}
              onChange={(e) => onSaveSettings({ currency: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              <option value="EUR">EUR (€) — Euro</option>
              <option value="USD">USD ($) — US Dollar</option>
              <option value="GBP">GBP (£) — British Pound</option>
              <option value="CHF">CHF — Swiss Franc</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Appearance</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              {[
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'system', label: 'Auto', icon: Monitor }
              ].map((t) => {
                const Icon = t.icon;
                const active = (settings.theme || 'system') === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSaveSettings({ theme: t.id })}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
                      active
                        ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* CSV Import / Export & Backup */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-base font-semibold">CSV Import, Export & Backup</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Supports comma (,) and European semicolon (;) CSVs, DD.MM.YYYY dates, and Euro decimals (42,50).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={api.getCsvExportUrl()}
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" /> Export All CSV
            </a>
            <a
              href={api.getJsonExportUrl()}
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" /> JSON Backup
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Upload CSV File</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 dark:file:bg-indigo-950/60 file:text-indigo-600 dark:file:text-indigo-300 hover:file:bg-indigo-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Default Account (if not in CSV)</label>
            <select
              value={importAccountId || accounts[0]?.id || ''}
              onChange={(e) => setImportAccountId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Or Paste CSV Data</label>
          <textarea
            rows={4}
            placeholder={'date,type,amount,category,account,description\n2026-11-25,expense,45.90,Groceries,Main Checking,Weekly groceries'}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
          />
        </div>

        <button
          onClick={handleImportCsv}
          disabled={importing || !csvText.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium"
        >
          <Upload className="w-4 h-4" />
          {importing ? 'Importing...' : 'Import Transactions'}
        </button>

        {importError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs">
            {importError}
          </div>
        )}

        {importResult && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs space-y-1">
            <div className="font-semibold">
              Imported {importResult.imported} transaction(s), skipped {importResult.skipped}.
            </div>
            {importResult.errors.length > 0 && (
              <ul className="list-disc pl-4 text-amber-600 dark:text-amber-300">
                {importResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
