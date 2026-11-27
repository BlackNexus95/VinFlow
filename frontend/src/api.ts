import { Capacitor } from '@capacitor/core';
import type {
  Account,
  BudgetItem,
  Category,
  CsvImportResult,
  OverviewData,
  RecurringRule,
  Settings,
  Transaction
} from './types';

const STORAGE_KEY = 'finflow_backend_url';

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getDefaultBackendUrl(): string {
  // On Android emulator, 10.0.2.2 routes to host localhost:3001.
  // On a physical phone, set http://<your-pc-lan-ip>:3001 in Settings.
  return isNativeApp() ? 'http://10.0.2.2:3001' : '';
}

export function getBackendUrl(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) return saved.replace(/\/+$/, '');
  return getDefaultBackendUrl();
}

export function setBackendUrl(url: string): void {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed && !isNativeApp()) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, trimmed);
  }
}

function buildUrl(path: string, params?: Record<string, string | number | undefined | null>): string {
  const base = getBackendUrl();
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        qs.set(k, String(v));
      }
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return `${base}${path}${suffix}`;
}

async function request<T>(path: string, options?: RequestInit, params?: Record<string, string | number | undefined | null>): Promise<T> {
  const url = buildUrl(path, params);
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error) msg = errBody.error;
    } catch {
      // ignore non-json
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: async (customBase?: string) => {
    const base = customBase !== undefined ? customBase.trim().replace(/\/+$/, '') : getBackendUrl();
    const start = performance.now();
    const res = await fetch(`${base}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ...data, latencyMs: Math.round(performance.now() - start) };
  },

  getSettings: () => request<Settings>('/api/settings'),
  updateSettings: (payload: Partial<Settings>) =>
    request<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  getOverview: (month: string) => request<OverviewData>('/api/overview', undefined, { month }),

  getAccounts: (includeArchived = false) =>
    request<Account[]>('/api/accounts', undefined, includeArchived ? { includeArchived: 'true' } : undefined),
  createAccount: (payload: Partial<Account>) =>
    request<Account>('/api/accounts', { method: 'POST', body: JSON.stringify(payload) }),
  updateAccount: (id: number, payload: Partial<Account>) =>
    request<Account>(`/api/accounts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAccount: (id: number) =>
    request<{ deleted?: boolean; archived?: boolean; id: number }>(`/api/accounts/${id}`, { method: 'DELETE' }),

  getCategories: (type?: 'income' | 'expense') =>
    request<Category[]>('/api/categories', undefined, type ? { type } : undefined),
  createCategory: (payload: Partial<Category>) =>
    request<Category>('/api/categories', { method: 'POST', body: JSON.stringify(payload) }),
  updateCategory: (id: number, payload: Partial<Category>) =>
    request<Category>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCategory: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/categories/${id}`, { method: 'DELETE' }),

  getTransactions: (filters?: {
    month?: string;
    type?: string;
    accountId?: string | number;
    categoryId?: string | number;
    search?: string;
    limit?: number;
  }) => request<Transaction[]>('/api/transactions', undefined, filters),
  createTransaction: (payload: Partial<Transaction>) =>
    request<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(payload) }),
  updateTransaction: (id: number, payload: Partial<Transaction>) =>
    request<Transaction>(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTransaction: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/transactions/${id}`, { method: 'DELETE' }),

  getBudgets: (month: string) => request<BudgetItem[]>('/api/budgets', undefined, { month }),
  saveBudget: (payload: { category_id: number; amount: number; month: string; alert_threshold?: number }) =>
    request<BudgetItem>('/api/budgets', { method: 'POST', body: JSON.stringify(payload) }),
  deleteBudget: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/budgets/${id}`, { method: 'DELETE' }),

  getRecurring: () => request<RecurringRule[]>('/api/recurring'),
  createRecurring: (payload: Partial<RecurringRule>) =>
    request<RecurringRule>('/api/recurring', { method: 'POST', body: JSON.stringify(payload) }),
  updateRecurring: (id: number, payload: Partial<RecurringRule>) =>
    request<RecurringRule>(`/api/recurring/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  triggerRecurring: (id: number, date?: string) =>
    request<{ transactionId: number; nextDueDate: string }>(`/api/recurring/${id}/trigger`, {
      method: 'POST',
      body: JSON.stringify({ date })
    }),
  processRecurring: () => request<{ created: number }>('/api/recurring/process', { method: 'POST' }),
  deleteRecurring: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/recurring/${id}`, { method: 'DELETE' }),

  importCsv: (csvText: string, defaultAccountId?: number) =>
    request<CsvImportResult>('/api/import/csv', {
      method: 'POST',
      body: JSON.stringify({ csvText, defaultAccountId })
    }),

  getCsvExportUrl: (month?: string) => buildUrl('/api/export/csv', month ? { month } : undefined),
  getJsonExportUrl: () => buildUrl('/api/export/json')
};
