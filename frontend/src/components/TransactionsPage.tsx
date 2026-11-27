import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Upload,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Filter
} from 'lucide-react';
import type { Account, Category, Transaction } from '../types';
import { formatDateLabel, formatMoney } from '../utils/format';
import { api } from '../api';

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  currency: string;
  month: string;
  allMonths: boolean;
  onToggleAllMonths: (all: boolean) => void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenImport: () => void;
}

export const TransactionsPage: React.FC<Props> = ({
  transactions,
  accounts,
  categories,
  currency,
  month,
  allMonths,
  onToggleAllMonths,
  onEditTransaction,
  onOpenImport
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (accountFilter !== 'all' && String(t.account_id) !== accountFilter && String(t.to_account_id) !== accountFilter)
        return false;
      if (categoryFilter !== 'all' && String(t.category_id) !== categoryFilter) return false;
      if (q) {
        const hay = `${t.description} ${t.notes} ${t.category_name || ''} ${t.account_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, search, typeFilter, accountFilter, categoryFilter]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.type === 'income') income += t.amount;
      if (t.type === 'expense') expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const list = map.get(t.date) || [];
      list.push(t);
      map.set(t.date, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2.5 justify-between">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search description, category, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleAllMonths(!allMonths)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                allMonths
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-700 dark:text-indigo-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {allMonths ? 'Showing: All Time' : 'Showing: Selected Month'}
            </button>
            <button
              onClick={onOpenImport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Upload className="w-3.5 h-3.5" /> Import CSV
            </button>
            <a
              href={api.getCsvExportUrl(allMonths ? undefined : month)}
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="all">All Types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
            <option value="transfer">Transfers</option>
          </select>

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="all">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filtered Summary Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5">
          <div className="text-[11px] uppercase text-slate-400">Income</div>
          <div className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
            +{formatMoney(totals.income, currency)}
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5">
          <div className="text-[11px] uppercase text-slate-400">Expenses</div>
          <div className="text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400">
            -{formatMoney(totals.expense, currency)}
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5">
          <div className="text-[11px] uppercase text-slate-400">Net ({filtered.length})</div>
          <div className={`text-sm sm:text-base font-bold ${totals.net >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
            {totals.net >= 0 ? '+' : ''}
            {formatMoney(totals.net, currency)}
          </div>
        </div>
      </div>

      {/* Grouped Transaction List */}
      {groupedByDate.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-10 text-center text-slate-400 text-sm">
          No matching transactions found.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([date, list]) => {
            const dayNet = list.reduce(
              (acc, t) => acc + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0),
              0
            );
            return (
              <div
                key={date}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm"
              >
                <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{formatDateLabel(date)}</span>
                  <span className={`font-medium ${dayNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {dayNet >= 0 ? '+' : ''}
                    {formatMoney(dayNet, currency)}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.map((tx) => (
                    <button
                      key={tx.id}
                      onClick={() => onEditTransaction(tx)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white"
                          style={{
                            backgroundColor:
                              tx.type === 'transfer'
                                ? '#4f46e5'
                                : tx.category_color || (tx.type === 'income' ? '#10b981' : '#f43f5e')
                          }}
                        >
                          {tx.type === 'income' ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : tx.type === 'transfer' ? (
                            <ArrowLeftRight className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {tx.description || tx.category_name || 'Untitled'}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                            {tx.type === 'transfer' ? (
                              <span>
                                {tx.account_name} → {tx.to_account_name}
                              </span>
                            ) : (
                              <>
                                <span>{tx.category_name || 'Uncategorized'}</span>
                                <span>·</span>
                                <span>{tx.account_name}</span>
                              </>
                            )}
                            {tx.notes && <span className="truncate">· {tx.notes}</span>}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`text-sm font-semibold shrink-0 ${
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'transfer'
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatMoney(tx.amount, tx.account_currency || currency)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
