import React, { useEffect, useState } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Trash2 } from 'lucide-react';
import type { Account, Category, Transaction, TransactionType } from '../types';
import { todayISO } from '../utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  accounts: Account[];
  categories: Category[];
  currency: string;
  initialTx?: Transaction | null;
  defaultType?: TransactionType;
  onSubmit: (payload: Partial<Transaction>, existingId?: number) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

export const TransactionModal: React.FC<Props> = ({
  open,
  onClose,
  onSaved,
  accounts,
  categories,
  currency,
  initialTx,
  defaultType = 'expense',
  onSubmit,
  onDelete
}) => {
  const [type, setType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id || 0);
  const [toAccountId, setToAccountId] = useState<number>(accounts[1]?.id || accounts[0]?.id || 0);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filteredCats = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));

  useEffect(() => {
    if (!open) return;
    setError('');
    if (initialTx) {
      setType(initialTx.type);
      setAmount(String(initialTx.amount));
      setDate(initialTx.date);
      setAccountId(initialTx.account_id);
      setToAccountId(initialTx.to_account_id || accounts.find((a) => a.id !== initialTx.account_id)?.id || 0);
      setCategoryId(initialTx.category_id ?? '');
      setDescription(initialTx.description || '');
      setNotes(initialTx.notes || '');
    } else {
      setType(defaultType);
      setAmount('');
      setDate(todayISO());
      const firstAcc = accounts[0]?.id || 0;
      const secondAcc = accounts.find((a) => a.id !== firstAcc)?.id || firstAcc;
      setAccountId(firstAcc);
      setToAccountId(secondAcc);
      const matchingCats = categories.filter((c) => c.type === (defaultType === 'income' ? 'income' : 'expense'));
      setCategoryId(defaultType === 'transfer' ? '' : matchingCats[0]?.id || '');
      setDescription('');
      setNotes('');
    }
  }, [open, initialTx, defaultType, accounts, categories]);

  useEffect(() => {
    if (!open || initialTx) return;
    if (type === 'transfer') {
      setCategoryId('');
      if (toAccountId === accountId) {
        const other = accounts.find((a) => a.id !== accountId);
        if (other) setToAccountId(other.id);
      }
    } else {
      const valid = filteredCats.some((c) => c.id === categoryId);
      if (!valid) {
        setCategoryId(filteredCats[0]?.id || '');
      }
    }
  }, [type]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = Number(amount.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      setError('Please enter an amount greater than 0.');
      return;
    }
    if (!accountId) {
      setError('Please select an account.');
      return;
    }
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setError('Please choose a different destination account for a transfer.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit(
        {
          type,
          amount: num,
          date,
          account_id: accountId,
          to_account_id: type === 'transfer' ? toAccountId : null,
          category_id: type === 'transfer' ? null : categoryId ? Number(categoryId) : null,
          description,
          notes
        },
        initialTx?.id
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialTx || !onDelete) return;
    setSaving(true);
    try {
      await onDelete(initialTx.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-semibold">
            {initialTx ? 'Edit Transaction' : 'New Transaction'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Segmented type picker */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {[
              { id: 'expense' as const, label: 'Expense', icon: ArrowUpRight, active: 'bg-rose-600 text-white shadow-sm' },
              { id: 'income' as const, label: 'Income', icon: ArrowDownLeft, active: 'bg-emerald-600 text-white shadow-sm' },
              { id: 'transfer' as const, label: 'Transfer', icon: ArrowLeftRight, active: 'bg-indigo-600 text-white shadow-sm' }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = type === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition ${
                    isActive ? item.active : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Amount ({currency})
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">
                  {currency === 'EUR' ? '€' : currency}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Accounts */}
          <div className={`grid gap-3 ${type === 'transfer' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {type === 'transfer' ? 'From Account' : 'Account'}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>
            {type === 'transfer' && (
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  To Account
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Category */}
          {type !== 'transfer' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Category
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                {filteredCats.map((cat) => {
                  const selected = Number(categoryId) === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryId(cat.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description & Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Description
            </label>
            <input
              type="text"
              placeholder={type === 'income' ? 'e.g. Monthly Salary' : type === 'transfer' ? 'e.g. Monthly Savings' : 'e.g. Groceries at REWE'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Optional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 gap-3">
            {initialTx && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition"
              >
                {saving ? 'Saving...' : initialTx ? 'Save Changes' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
