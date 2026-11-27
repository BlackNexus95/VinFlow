import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ListOrdered,
  Target,
  Repeat,
  Wallet,
  Settings as SettingsIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api } from './api';
import type {
  Account,
  BudgetItem,
  Category,
  OverviewData,
  RecurringRule,
  Settings,
  Transaction,
  TransactionType
} from './types';
import { currentMonthISO, formatMonthLabel, shiftMonth } from './utils/format';
import { OverviewPage } from './components/OverviewPage';
import { TransactionsPage } from './components/TransactionsPage';
import { BudgetsPage } from './components/BudgetsPage';
import { RecurringPage } from './components/RecurringPage';
import { AccountsPage } from './components/AccountsPage';
import { SettingsPage } from './components/SettingsPage';
import { TransactionModal } from './components/TransactionModal';

type Tab = 'overview' | 'transactions' | 'budgets' | 'recurring' | 'accounts' | 'settings';

const NAV_ITEMS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Activity', icon: ListOrdered },
  { id: 'budgets', label: 'Budgets', icon: Target },
  { id: 'recurring', label: 'Recurring', icon: Repeat },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'settings', label: 'Settings', icon: SettingsIcon }
];

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [month, setMonth] = useState<string>(currentMonthISO());
  const [allMonthsTx, setAllMonthsTx] = useState(false);

  const [settings, setSettings] = useState<Settings>({ currency: 'EUR', locale: 'de-DE', theme: 'system' });
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [defaultTxType, setDefaultTxType] = useState<TransactionType>('expense');

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
    root.classList.toggle('dark', dark);
  }, [settings.theme]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, ov, accs, cats, txs, bgs, recs] = await Promise.all([
        api.getSettings(),
        api.getOverview(month),
        api.getAccounts(),
        api.getCategories(),
        api.getTransactions(allMonthsTx ? { limit: 1000 } : { month, limit: 1000 }),
        api.getBudgets(month),
        api.getRecurring()
      ]);
      setSettings(s);
      setOverview(ov);
      setAccounts(accs);
      setCategories(cats);
      setTransactions(txs);
      setBudgets(bgs);
      setRecurring(recs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach shared backend server.');
    } finally {
      setLoading(false);
    }
  }, [month, allMonthsTx]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const currency = settings.currency || 'EUR';

  const openAddModal = (type: TransactionType = 'expense') => {
    setEditingTx(null);
    setDefaultTxType(type);
    setTxModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setTxModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-6">
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
            €
          </div>
          <div>
            <div className="font-bold text-base tracking-tight">FinFlow</div>
            <div className="text-[11px] text-slate-400">Income & Expense Overview</div>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => openAddModal('expense')}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 transition"
        >
          <Plus className="w-4 h-4" /> Add Transaction
        </button>
      </aside>

      {/* Main Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-20 lg:pb-8">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold">
                €
              </div>
              <span className="font-bold text-sm">FinFlow</span>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMonth(currentMonthISO())}
                className="px-3 py-1 text-xs sm:text-sm font-semibold min-w-[130px] text-center"
                title="Jump to current month"
              >
                {formatMonthLabel(month)}
              </button>
              <button
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAll}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => openAddModal('expense')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5">
          {error && (
            <div className="mb-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex flex-wrap items-center justify-between gap-3 text-sm text-rose-700 dark:text-rose-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTab('settings')}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-xs font-medium"
                >
                  Configure Server URL
                </button>
                <button
                  onClick={loadAll}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {tab === 'overview' && overview && (
            <OverviewPage
              data={overview}
              currency={currency}
              onEditTransaction={openEditModal}
              onNavigate={(t) => setTab(t as Tab)}
              onQuickAdd={openAddModal}
            />
          )}

          {tab === 'transactions' && (
            <TransactionsPage
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              currency={currency}
              month={month}
              allMonths={allMonthsTx}
              onToggleAllMonths={setAllMonthsTx}
              onEditTransaction={openEditModal}
              onOpenImport={() => setTab('settings')}
            />
          )}

          {tab === 'budgets' && (
            <BudgetsPage
              budgets={budgets}
              categories={categories}
              month={month}
              currency={currency}
              onSaveBudget={async (payload) => {
                await api.saveBudget(payload);
                await loadAll();
              }}
              onDeleteBudget={async (id) => {
                await api.deleteBudget(id);
                await loadAll();
              }}
            />
          )}

          {tab === 'recurring' && (
            <RecurringPage
              rules={recurring}
              accounts={accounts}
              categories={categories}
              currency={currency}
              onCreate={async (payload) => {
                await api.createRecurring(payload);
                await loadAll();
              }}
              onUpdate={async (id, payload) => {
                await api.updateRecurring(id, payload);
                await loadAll();
              }}
              onTrigger={async (id) => {
                await api.triggerRecurring(id);
                await loadAll();
              }}
              onDelete={async (id) => {
                await api.deleteRecurring(id);
                await loadAll();
              }}
            />
          )}

          {tab === 'accounts' && (
            <AccountsPage
              accounts={accounts}
              categories={categories}
              currency={currency}
              onCreateAccount={async (p) => {
                await api.createAccount(p);
                await loadAll();
              }}
              onUpdateAccount={async (id, p) => {
                await api.updateAccount(id, p);
                await loadAll();
              }}
              onDeleteAccount={async (id) => {
                await api.deleteAccount(id);
                await loadAll();
              }}
              onCreateCategory={async (p) => {
                await api.createCategory(p);
                await loadAll();
              }}
              onDeleteCategory={async (id) => {
                await api.deleteCategory(id);
                await loadAll();
              }}
              onQuickTransfer={() => openAddModal('transfer')}
            />
          )}

          {tab === 'settings' && (
            <SettingsPage
              settings={settings}
              accounts={accounts}
              onSaveSettings={async (p) => {
                const updated = await api.updateSettings(p);
                setSettings(updated);
              }}
              onImported={loadAll}
              onBackendChanged={loadAll}
            />
          )}
        </main>
      </div>

      {/* Mobile Floating Action Button */}
      <button
        onClick={() => openAddModal('expense')}
        className="lg:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/30 flex items-center justify-center active:scale-95 transition"
        aria-label="Add transaction"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-6 px-1 py-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 rounded-lg text-[10px] font-medium transition ${
                active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Transaction Add / Edit Modal */}
      <TransactionModal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        onSaved={loadAll}
        accounts={accounts}
        categories={categories}
        currency={currency}
        initialTx={editingTx}
        defaultType={defaultTxType}
        onSubmit={async (payload, existingId) => {
          if (existingId) {
            await api.updateTransaction(existingId, payload);
          } else {
            await api.createTransaction(payload);
          }
        }}
        onDelete={async (id) => {
          await api.deleteTransaction(id);
        }}
      />
    </div>
  );
}
