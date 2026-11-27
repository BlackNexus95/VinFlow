import React, { useState } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { BudgetItem, Category } from '../types';
import { formatMoney } from '../utils/format';

interface Props {
  budgets: BudgetItem[];
  categories: Category[];
  month: string;
  currency: string;
  onSaveBudget: (payload: { category_id: number; amount: number; month: string; alert_threshold: number }) => Promise<void>;
  onDeleteBudget: (id: number) => Promise<void>;
}

export const BudgetsPage: React.FC<Props> = ({
  budgets,
  categories,
  month,
  currency,
  onSaveBudget,
  onDeleteBudget
}) => {
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<number>(expenseCategories[0]?.id || 0);
  const [amount, setAmount] = useState('');
  const [scope, setScope] = useState<'ALL' | 'MONTH'>('ALL');
  const [threshold, setThreshold] = useState('80');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPct = totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0;

  const openNew = (existing?: BudgetItem) => {
    setError('');
    if (existing) {
      setCategoryId(existing.category_id);
      setAmount(String(existing.amount));
      setScope(existing.month === 'ALL' ? 'ALL' : 'MONTH');
      setThreshold(String(Math.round(existing.alert_threshold * 100)));
    } else {
      const usedIds = new Set(budgets.map((b) => b.category_id));
      const firstUnused = expenseCategories.find((c) => !usedIds.has(c.id)) || expenseCategories[0];
      setCategoryId(firstUnused?.id || 0);
      setAmount('');
      setScope('ALL');
      setThreshold('80');
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = Number(amount.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      setError('Enter a valid monthly limit greater than 0.');
      return;
    }
    setSaving(true);
    try {
      await onSaveBudget({
        category_id: categoryId,
        amount: num,
        month: scope === 'ALL' ? 'ALL' : month,
        alert_threshold: Math.min(Math.max(Number(threshold) / 100, 0.1), 1)
      });
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Overall Progress */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Monthly Budgets</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track spending limits per expense category with warning alerts
            </p>
          </div>
          <button
            onClick={() => openNew()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Set Budget
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">
              Total spent in budgeted categories: <strong>{formatMoney(totalSpent, currency)}</strong>
            </span>
            <span className="font-semibold">
              {formatMoney(totalBudgeted, currency)} limit
            </span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totalSpent > totalBudgeted ? 'bg-rose-500' : overallPct >= 80 ? 'bg-amber-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between">
            <span>{totalBudgeted > 0 ? `${((totalSpent / totalBudgeted) * 100).toFixed(1)}% utilized` : 'No limits set'}</span>
            <span>
              {totalBudgeted - totalSpent >= 0
                ? `${formatMoney(totalBudgeted - totalSpent, currency)} remaining`
                : `${formatMoney(Math.abs(totalBudgeted - totalSpent), currency)} over budget`}
            </span>
          </div>
        </div>
      </div>

      {/* Category Budget Cards */}
      {budgets.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-10 text-center text-slate-400 text-sm">
          No budgets set yet. Click <strong>Set Budget</strong> to add a monthly limit for Groceries, Dining, Shopping, etc.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const barColor =
              b.status === 'exceeded' ? 'bg-rose-500' : b.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
            return (
              <div
                key={b.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: b.category_color }} />
                    <div>
                      <h3 className="text-sm font-semibold">{b.category_name}</h3>
                      <span className="text-[11px] text-slate-400">
                        {b.is_override ? `Override for ${month}` : 'Repeats every month'} · Alert at {Math.round(b.alert_threshold * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openNew(b)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteBudget(b.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold">{formatMoney(b.spent, currency)}</span>
                  <span className="text-xs text-slate-500">of {formatMoney(b.amount, currency)}</span>
                </div>

                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(b.percent, 100)}%` }} />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      b.status === 'exceeded'
                        ? 'text-rose-600 dark:text-rose-400'
                        : b.status === 'warning'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {b.status === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {b.status === 'exceeded'
                      ? `Exceeded by ${formatMoney(Math.abs(b.remaining), currency)}`
                      : `${formatMoney(b.remaining, currency)} left`}
                  </span>
                  <span className="text-slate-400 font-medium">{b.percent}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-semibold">Set Category Budget</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Expense Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Monthly Limit ({currency})</label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="e.g. 400"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-base font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Applies To</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as 'ALL' | 'MONTH')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  >
                    <option value="ALL">Every month (default)</option>
                    <option value="MONTH">Only {month}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Alert Threshold (%)</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>
              {error && <div className="text-xs text-rose-500">{error}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {saving ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
