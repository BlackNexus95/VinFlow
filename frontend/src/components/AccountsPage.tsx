import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeftRight, Wallet, Tag, X } from 'lucide-react';
import type { Account, AccountType, Category } from '../types';
import { formatMoney } from '../utils/format';

interface Props {
  accounts: Account[];
  categories: Category[];
  currency: string;
  onCreateAccount: (payload: Partial<Account>) => Promise<void>;
  onUpdateAccount: (id: number, payload: Partial<Account>) => Promise<void>;
  onDeleteAccount: (id: number) => Promise<void>;
  onCreateCategory: (payload: Partial<Category>) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
  onQuickTransfer: () => void;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b'];

export const AccountsPage: React.FC<Props> = ({
  accounts,
  categories,
  currency,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onCreateCategory,
  onDeleteCategory,
  onQuickTransfer
}) => {
  const [accModal, setAccModal] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('checking');
  const [accInit, setAccInit] = useState('0');
  const [accColor, setAccColor] = useState('#2563eb');

  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catColor, setCatColor] = useState('#6366f1');

  const totalNetWorth = accounts.reduce((s, a) => s + a.balance, 0);

  const openAccModal = (acc?: Account) => {
    if (acc) {
      setEditingAcc(acc);
      setAccName(acc.name);
      setAccType(acc.type);
      setAccInit(String(acc.initial_balance));
      setAccColor(acc.color);
    } else {
      setEditingAcc(null);
      setAccName('');
      setAccType('checking');
      setAccInit('0');
      setAccColor('#2563eb');
    }
    setAccModal(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    const payload = {
      name: accName.trim(),
      type: accType,
      currency,
      initial_balance: Number(accInit.replace(',', '.')) || 0,
      color: accColor
    };
    if (editingAcc) {
      await onUpdateAccount(editingAcc.id, payload);
    } else {
      await onCreateAccount(payload);
    }
    setAccModal(false);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await onCreateCategory({ name: catName.trim(), type: catType, color: catColor, icon: 'tag' });
    setCatName('');
  };

  return (
    <div className="space-y-6">
      {/* Net Worth Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-indigo-200">Total Combined Balance</div>
          <div className="text-3xl font-bold mt-1">{formatMoney(totalNetWorth, currency)}</div>
          <div className="text-xs text-slate-300 mt-1">{accounts.length} active accounts & wallets</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onQuickTransfer}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition"
          >
            <ArrowLeftRight className="w-4 h-4" /> Transfer
          </button>
          <button
            onClick={() => openAccModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-sm font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((a) => (
          <div
            key={a.id}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between gap-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: a.color }}
                >
                  <Wallet className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-sm">{a.name}</h3>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400">{a.type}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openAccModal(a)}
                  className="px-2 py-1 rounded-lg text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDeleteAccount(a.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <div className={`text-2xl font-bold ${a.balance < 0 ? 'text-rose-600' : ''}`}>
                {formatMoney(a.balance, a.currency || currency)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div>
                  In: <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{formatMoney(a.total_income + a.transfers_in, a.currency || currency)}</span>
                </div>
                <div>
                  Out: <span className="text-rose-600 dark:text-rose-400 font-medium">-{formatMoney(a.total_expense + a.transfers_out, a.currency || currency)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Categories Management */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-indigo-500" />
          <h3 className="text-base font-semibold">Categories</h3>
        </div>

        <form onSubmit={handleAddCategory} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="New category name..."
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            className="flex-1 min-w-[160px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
          />
          <select
            value={catType}
            onChange={(e) => setCatType(e.target.value as 'expense' | 'income')}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <input
            type="color"
            value={catColor}
            onChange={(e) => setCatColor(e.target.value)}
            className="w-10 h-9 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
          >
            Add
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {(['expense', 'income'] as const).map((t) => (
            <div key={t}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                {t} Categories
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {categories
                  .filter((c) => c.type === t)
                  .map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <span>{c.name}</span>
                      <button
                        onClick={() => onDeleteCategory(c.id)}
                        className="p-0.5 rounded-full text-slate-400 hover:text-rose-500"
                        title="Delete category"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Account Modal */}
      {accModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-semibold">{editingAcc ? 'Edit Account' : 'New Account'}</h3>
              <button onClick={() => setAccModal(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAccount} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. N26 Checking, Trade Republic"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Account Type</label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value as AccountType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="cash">Cash Wallet</option>
                    <option value="credit">Credit Card</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Initial Balance ({currency})</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={accInit}
                    onChange={(e) => setAccInit(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Color</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccColor(c)}
                      className={`w-7 h-7 rounded-full transition ${accColor === c ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAccModal(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
