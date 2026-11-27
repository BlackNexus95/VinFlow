import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  AlertTriangle,
  CalendarClock,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import type { OverviewData, Transaction } from '../types';
import { formatMoney, formatShortMoney, formatShortMonth } from '../utils/format';

interface Props {
  data: OverviewData;
  currency: string;
  onEditTransaction: (tx: Transaction) => void;
  onNavigate: (tab: string) => void;
  onQuickAdd: (type: 'income' | 'expense' | 'transfer') => void;
}

export const OverviewPage: React.FC<Props> = ({
  data,
  currency,
  onEditTransaction,
  onNavigate,
  onQuickAdd
}) => {
  const { summary, accounts, expenseByCategory, monthlyTrend, budgets, budgetSummary, upcomingRecurring, recentTransactions } = data;

  const trendChartData = monthlyTrend.map((m) => ({
    ...m,
    label: formatShortMonth(m.month)
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Balance */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-5 shadow-lg shadow-indigo-600/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-indigo-100">Total Net Balance</span>
            <Wallet className="w-5 h-5 text-indigo-200" />
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight">
            {formatMoney(summary.totalBalance, currency)}
          </div>
          <div className="mt-2 text-xs text-indigo-100/90 flex items-center justify-between">
            <span>Across {accounts.length} active account{accounts.length === 1 ? '' : 's'}</span>
            <button onClick={() => onNavigate('accounts')} className="underline hover:text-white">
              Manage
            </button>
          </div>
        </div>

        {/* Income */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Income
            </span>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            +{formatMoney(summary.income, currency)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {summary.incomeDeltaPct !== null ? (
              <>
                {summary.incomeDeltaPct >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                )}
                <span>
                  {summary.incomeDeltaPct >= 0 ? '+' : ''}
                  {summary.incomeDeltaPct}% vs last month
                </span>
              </>
            ) : (
              <span>No income recorded last month</span>
            )}
          </div>
        </div>

        {/* Expenses */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Expenses
            </span>
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold text-rose-600 dark:text-rose-400">
            -{formatMoney(summary.expenses, currency)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {summary.expenseDeltaPct !== null ? (
              <>
                {summary.expenseDeltaPct <= 0 ? (
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                )}
                <span>
                  {summary.expenseDeltaPct >= 0 ? '+' : ''}
                  {summary.expenseDeltaPct}% vs last month
                </span>
              </>
            ) : (
              <span>No expenses recorded last month</span>
            )}
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Net Cash Flow
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <PiggyBank className="w-4 h-4" />
            </span>
          </div>
          <div
            className={`mt-3 text-2xl font-bold ${
              summary.net >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {summary.net >= 0 ? '+' : ''}
            {formatMoney(summary.net, currency)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Savings rate: <strong className="text-slate-700 dark:text-slate-200">{summary.savingsRate}%</strong></span>
            <span>{summary.count} entries</span>
          </div>
        </div>
      </div>

      {/* Quick Actions on Mobile */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <button
          onClick={() => onQuickAdd('expense')}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold shadow-sm"
        >
          <ArrowUpRight className="w-4 h-4" /> Expense
        </button>
        <button
          onClick={() => onQuickAdd('income')}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-sm"
        >
          <ArrowDownLeft className="w-4 h-4" /> Income
        </button>
        <button
          onClick={() => onQuickAdd('transfer')}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-sm"
        >
          <ArrowLeftRight className="w-4 h-4" /> Transfer
        </button>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 6-Month Income vs Expenses */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">Income vs. Expenses (6 Months)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Monthly cash-flow comparison in {currency}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Income
              </span>
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Expenses
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendChartData} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => formatShortMoney(Number(v), currency)}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatMoney(Number(value), currency),
                    name === 'income' ? 'Income' : 'Expenses'
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.2)',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    fontSize: 12
                  }}
                />
                <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Breakdown Donut */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col">
          <div className="mb-3">
            <h3 className="text-base font-semibold">Spending by Category</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Where your money went this month</p>
          </div>

          {expenseByCategory.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-slate-400 text-sm">
              <p>No expenses recorded for this month yet.</p>
              <button
                onClick={() => onQuickAdd('expense')}
                className="mt-3 px-3.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-xs font-medium"
              >
                + Log an expense
              </button>
            </div>
          ) : (
            <>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByCategory}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={74}
                      paddingAngle={2}
                    >
                      {expenseByCategory.map((entry) => (
                        <Cell key={entry.category_id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => formatMoney(Number(val), currency)}
                      contentStyle={{
                        borderRadius: 12,
                        border: 'none',
                        backgroundColor: '#0f172a',
                        color: '#f8fafc',
                        fontSize: 12
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1">
                {expenseByCategory.slice(0, 6).map((cat) => (
                  <div key={cat.category_id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400">{cat.percent}%</span>
                      <span className="font-semibold">{formatMoney(cat.total, currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Middle Row: Budgets + Accounts & Upcoming Recurring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Budgets snapshot */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">Monthly Budgets</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {budgets.length > 0
                  ? `${formatMoney(budgetSummary.totalSpent, currency)} of ${formatMoney(budgetSummary.totalBudgeted, currency)} used`
                  : 'Set spending limits per category'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('budgets')}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {budgets.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              No budgets configured yet.
            </div>
          ) : (
            <div className="space-y-3.5">
              {budgets.slice(0, 4).map((b) => {
                const barColor =
                  b.status === 'exceeded'
                    ? 'bg-rose-500'
                    : b.status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.category_color }} />
                        <span>{b.category_name}</span>
                        {b.status !== 'ok' && (
                          <AlertTriangle
                            className={`w-3.5 h-3.5 ${b.status === 'exceeded' ? 'text-rose-500' : 'text-amber-500'}`}
                          />
                        )}
                      </div>
                      <span className="text-slate-600 dark:text-slate-300">
                        <strong>{formatMoney(b.spent, currency)}</strong> / {formatMoney(b.amount, currency)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.min(b.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Accounts & Upcoming */}
        <div className="space-y-5">
          {/* Accounts Strip */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Accounts & Wallets</h3>
              <button
                onClick={() => onNavigate('accounts')}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                All accounts <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {accounts.slice(0, 4).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-3 h-8 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-[11px] uppercase text-slate-400">{a.type}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold shrink-0 ${a.balance < 0 ? 'text-rose-500' : ''}`}>
                    {formatMoney(a.balance, a.currency || currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Recurring */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-indigo-500" />
                <h3 className="text-base font-semibold">Upcoming Recurring</h3>
              </div>
              <button
                onClick={() => onNavigate('recurring')}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Manage <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {upcomingRecurring.length === 0 ? (
              <p className="text-xs text-slate-400">No active recurring rules scheduled.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcomingRecurring.slice(0, 3).map((r) => (
                  <div key={r.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-100">{r.name}</div>
                      <div className="text-slate-400">
                        Due {r.next_due_date} · {r.frequency}
                      </div>
                    </div>
                    <span
                      className={`font-semibold ${
                        r.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {r.type === 'income' ? '+' : '-'}
                      {formatMoney(r.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Recent Transactions</h3>
          <button
            onClick={() => onNavigate('transactions')}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No transactions this month yet. Click <strong>+ Add</strong> to get started.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentTransactions.map((tx) => (
              <button
                key={tx.id}
                onClick={() => onEditTransaction(tx)}
                className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 -mx-2 px-2 rounded-xl transition"
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
                      {tx.description || tx.category_name || (tx.type === 'transfer' ? 'Account Transfer' : 'Transaction')}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {tx.date} ·{' '}
                      {tx.type === 'transfer'
                        ? `${tx.account_name} → ${tx.to_account_name}`
                        : `${tx.category_name || 'Uncategorized'} · ${tx.account_name}`}
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
        )}
      </div>
    </div>
  );
};
