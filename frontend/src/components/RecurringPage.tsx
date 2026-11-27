import React, { useMemo, useState } from 'react';
import { Plus, Play, Pause, Trash2, CalendarClock, Zap, X } from 'lucide-react';
import type { Account, Category, Frequency, RecurringRule, TransactionType } from '../types';
import { formatMoney, todayISO } from '../utils/format';

interface Props {
  rules: RecurringRule[];
  accounts: Account[];
  categories: Category[];
  currency: string;
  onCreate: (payload: Partial<RecurringRule>) => Promise<void>;
  onUpdate: (id: number, payload: Partial<RecurringRule>) => Promise<void>;
  onTrigger: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const MONTHLY_MULTIPLIER: Record<Frequency, number> = {
  daily: 30,
  weekly: 4.33,
  biweekly: 2.165,
  monthly: 1,
  yearly: 1 / 12
};

export const RecurringPage: React.FC<Props> = ({
  rules,
  accounts,
  categories,
  currency,
  onCreate,
  onUpdate,
  onTrigger,
  onDelete
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id || 0);
  const [toAccountId, setToAccountId] = useState<number>(accounts[1]?.id || accounts[0]?.id || 0);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [startDate, setStartDate] = useState(todayISO());
  const [autoCreate, setAutoCreate] = useState(true);
  const [saving, setSaving] = useState(false);

  const estMonthly = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of rules) {
      if (!r.active) continue;
      const m = r.amount * (MONTHLY_MULTIPLIER[r.frequency] || 1);
      if (r.type === 'income') income += m;
      if (r.type === 'expense') expense += m;
    }
    return { income, expense, net: income - expense };
  }, [rules]);

  const filteredCats = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));

  const openModal = () => {
    setName('');
    setType('expense');
    setAmount('');
    setAccountId(accounts[0]?.id || 0);
    setToAccountId(accounts[1]?.id || accounts[0]?.id || 0);
    const expCat = categories.find((c) => c.type === 'expense');
    setCategoryId(expCat?.id || '');
    setFrequency('monthly');
    setStartDate(todayISO());
    setAutoCreate(true);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(num) || num <= 0) return;
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        type,
        amount: num,
        account_id: accountId,
        to_account_id: type === 'transfer' ? toAccountId : null,
        category_id: type === 'transfer' ? null : categoryId ? Number(categoryId) : null,
        frequency,
        start_date: startDate,
        auto_create: autoCreate ? 1 : 0
      });
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Estimated Monthly Fixed Cashflow */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Recurring Transactions</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automate rent, salary, subscriptions, and regular savings transfers
            </p>
          </div>
          <button
            onClick={openModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Recurring Rule
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
            <div className="text-xs text-emerald-700 dark:text-emerald-300">Est. Monthly Fixed Income</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              +{formatMoney(estMonthly.income, currency)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
            <div className="text-xs text-rose-700 dark:text-rose-300">Est. Monthly Fixed Bills</div>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
              -{formatMoney(estMonthly.expense, currency)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700">
            <div className="text-xs text-slate-500 dark:text-slate-400">Fixed Monthly Net</div>
            <div className="text-lg font-bold">
              {estMonthly.net >= 0 ? '+' : ''}
              {formatMoney(estMonthly.net, currency)}
            </div>
          </div>
        </div>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-10 text-center text-slate-400 text-sm">
          No recurring rules yet. Add your salary, rent, or subscriptions so they track automatically.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <div
              key={r.id}
              className={`rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 ${
                !r.active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: r.category_color || (r.type === 'income' ? '#10b981' : '#6366f1') }}
                >
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{r.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                      {r.frequency}
                    </span>
                    {r.auto_create ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300">
                        Auto-post
                      </span>
                    ) : null}
                    {!r.active && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                        Paused
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Next due: <strong>{r.next_due_date}</strong> · {r.account_name}
                    {r.type === 'transfer' && r.to_account_name ? ` → ${r.to_account_name}` : ''}
                    {r.category_name ? ` · ${r.category_name}` : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-auto">
                <span
                  className={`text-base font-bold ${
                    r.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : r.type === 'transfer'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {r.type === 'income' ? '+' : r.type === 'expense' ? '-' : ''}
                  {formatMoney(r.amount, currency)}
                </span>

                <button
                  onClick={() => onTrigger(r.id)}
                  title="Post transaction now"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                >
                  <Zap className="w-3.5 h-3.5" /> Post Now
                </button>
                <button
                  onClick={() => onUpdate(r.id, { active: r.active ? 0 : 1 })}
                  title={r.active ? 'Pause rule' : 'Resume rule'}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {r.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => onDelete(r.id)}
                  title="Delete rule"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-semibold">New Recurring Rule</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Rent, Salary, Spotify"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const nextType = e.target.value as TransactionType;
                      setType(nextType);
                      if (nextType === 'transfer') setCategoryId('');
                      else setCategoryId(categories.find((c) => c.type === nextType)?.id || '');
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount ({currency})</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as Frequency)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 Weeks</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start / Next Due Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    {type === 'transfer' ? 'From Account' : 'Account'}
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                {type === 'transfer' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">To Account</label>
                    <select
                      value={toAccountId}
                      onChange={(e) => setToAccountId(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                    >
                      {filteredCats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={autoCreate}
                  onChange={(e) => setAutoCreate(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Automatically create transactions on due dates
              </label>

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
                  {saving ? 'Saving...' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
