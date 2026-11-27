export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'investment';
export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface Settings {
  currency: string;
  locale: string;
  theme: 'light' | 'dark' | 'system' | string;
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: number;
  color: string;
  icon: string;
  archived: number;
  balance: number;
  total_income: number;
  total_expense: number;
  transfers_in: number;
  transfers_out: number;
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  is_default: number;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  date: string;
  account_id: number;
  to_account_id: number | null;
  category_id: number | null;
  description: string;
  notes: string;
  recurring_id: number | null;
  account_name?: string;
  account_color?: string;
  account_currency?: string;
  to_account_name?: string | null;
  to_account_color?: string | null;
  category_name?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
}

export interface BudgetItem {
  id: number;
  category_id: number;
  month: string;
  amount: number;
  alert_threshold: number;
  category_name: string;
  category_color: string;
  category_icon: string;
  spent: number;
  remaining: number;
  percent: number;
  status: 'ok' | 'warning' | 'exceeded';
  is_override: boolean;
}

export interface RecurringRule {
  id: number;
  name: string;
  type: TransactionType;
  amount: number;
  account_id: number;
  to_account_id: number | null;
  category_id: number | null;
  description: string;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  next_due_date: string;
  active: number;
  auto_create: number;
  account_name?: string;
  to_account_name?: string | null;
  category_name?: string | null;
  category_color?: string | null;
}

export interface CategoryBreakdownItem {
  category_id: number;
  name: string;
  color: string;
  icon: string;
  total: number;
  count: number;
  percent: number;
}

export interface MonthlyTrendPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface DailyCashFlowPoint {
  day: string;
  date: string;
  income: number;
  expenses: number;
}

export interface OverviewData {
  month: string;
  currency: string;
  summary: {
    income: number;
    expenses: number;
    net: number;
    savingsRate: number;
    count: number;
    totalBalance: number;
    incomeDeltaPct: number | null;
    expenseDeltaPct: number | null;
    netDelta: number;
  };
  accounts: Account[];
  expenseByCategory: CategoryBreakdownItem[];
  incomeByCategory: CategoryBreakdownItem[];
  monthlyTrend: MonthlyTrendPoint[];
  dailyCashFlow: DailyCashFlowPoint[];
  budgets: BudgetItem[];
  budgetSummary: {
    totalBudgeted: number;
    totalSpent: number;
    exceededCount: number;
    warningCount: number;
  };
  upcomingRecurring: RecurringRule[];
  recentTransactions: Transaction[];
}

export interface CsvImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}
