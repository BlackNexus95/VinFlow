import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CATEGORIES = [
  // Income
  { name: 'Salary', type: 'income', color: '#10b981', icon: 'briefcase' },
  { name: 'Freelance', type: 'income', color: '#06b6d4', icon: 'laptop' },
  { name: 'Investments', type: 'income', color: '#3b82f6', icon: 'trending-up' },
  { name: 'Refunds', type: 'income', color: '#8b5cf6', icon: 'rotate-ccw' },
  { name: 'Gifts', type: 'income', color: '#ec4899', icon: 'gift' },
  { name: 'Other Income', type: 'income', color: '#14b8a6', icon: 'plus-circle' },
  // Expense
  { name: 'Housing & Rent', type: 'expense', color: '#6366f1', icon: 'home' },
  { name: 'Groceries', type: 'expense', color: '#22c55e', icon: 'shopping-cart' },
  { name: 'Dining & Cafes', type: 'expense', color: '#f97316', icon: 'utensils' },
  { name: 'Utilities', type: 'expense', color: '#eab308', icon: 'zap' },
  { name: 'Transport', type: 'expense', color: '#0ea5e9', icon: 'car' },
  { name: 'Subscriptions', type: 'expense', color: '#a855f7', icon: 'repeat' },
  { name: 'Shopping', type: 'expense', color: '#ec4899', icon: 'shopping-bag' },
  { name: 'Health & Fitness', type: 'expense', color: '#ef4444', icon: 'heart-pulse' },
  { name: 'Entertainment', type: 'expense', color: '#f59e0b', icon: 'film' },
  { name: 'Travel', type: 'expense', color: '#06b6d4', icon: 'plane' },
  { name: 'Education', type: 'expense', color: '#3b82f6', icon: 'book-open' },
  { name: 'Other Expense', type: 'expense', color: '#64748b', icon: 'tag' }
];

const DEFAULT_ACCOUNTS = [
  { name: 'Main Checking', type: 'checking', currency: 'EUR', initial_balance: 0, color: '#2563eb', icon: 'landmark' },
  { name: 'Savings', type: 'savings', currency: 'EUR', initial_balance: 0, color: '#10b981', icon: 'piggy-bank' },
  { name: 'Cash Wallet', type: 'cash', currency: 'EUR', initial_balance: 0, color: '#f59e0b', icon: 'wallet' }
];

export function initDatabase(dbPath) {
  const resolvedPath = dbPath || process.env.FINANCE_DB_PATH || path.join(__dirname, '..', 'data', 'finance.db');
  if (resolvedPath !== ':memory:') {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'cash', 'credit', 'investment')),
      currency TEXT NOT NULL DEFAULT 'EUR',
      initial_balance REAL NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#2563eb',
      icon TEXT NOT NULL DEFAULT 'wallet',
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      color TEXT NOT NULL DEFAULT '#64748b',
      icon TEXT NOT NULL DEFAULT 'tag',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(name, type)
    );

    CREATE TABLE IF NOT EXISTS recurring_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
      amount REAL NOT NULL CHECK (amount > 0),
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      to_account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT NOT NULL DEFAULT '',
      frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
      start_date TEXT NOT NULL,
      end_date TEXT,
      next_due_date TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      auto_create INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
      amount REAL NOT NULL CHECK (amount > 0),
      date TEXT NOT NULL,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      to_account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      recurring_id INTEGER REFERENCES recurring_rules(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      month TEXT NOT NULL DEFAULT 'ALL',
      amount REAL NOT NULL CHECK (amount > 0),
      alert_threshold REAL NOT NULL DEFAULT 0.8,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(category_id, month)
    );

    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_to_account ON transactions(to_account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
  `);

  const upsertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  upsertSetting.run('currency', 'EUR');
  upsertSetting.run('locale', 'de-DE');
  upsertSetting.run('theme', 'system');

  const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM categories').get().count;
  if (categoryCount === 0) {
    const insertCat = db.prepare(
      'INSERT INTO categories (name, type, color, icon, is_default) VALUES (@name, @type, @color, @icon, 1)'
    );
    const seedCats = db.transaction((items) => {
      for (const item of items) insertCat.run(item);
    });
    seedCats(DEFAULT_CATEGORIES);
  }

  const accountCount = db.prepare('SELECT COUNT(*) AS count FROM accounts').get().count;
  if (accountCount === 0) {
    const insertAcc = db.prepare(
      'INSERT INTO accounts (name, type, currency, initial_balance, color, icon) VALUES (@name, @type, @currency, @initial_balance, @color, @icon)'
    );
    const seedAccs = db.transaction((items) => {
      for (const item of items) insertAcc.run(item);
    });
    seedAccs(DEFAULT_ACCOUNTS);
  }

  return db;
}
