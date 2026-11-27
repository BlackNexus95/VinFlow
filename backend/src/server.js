import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './db.js';
import { processDueRecurring, triggerRecurringOnce, todayISO } from './recurring.js';
import { serializeTransactionsCsv, parseCsv, parseAmount, normalizeDate } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function currentMonthISO() {
  return todayISO().slice(0, 7);
}

function getPreviousMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 2, 1));
  return dt.toISOString().slice(0, 7);
}

function getRecentMonths(endYm, count = 6) {
  const [y, m] = endYm.split('-').map(Number);
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    months.push(dt.toISOString().slice(0, 7));
  }
  return months;
}

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const start = `${ym}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${ym}-${String(lastDay).padStart(2, '0')}`;
  return { start, end, days: lastDay };
}

function getAccountsWithBalances(db, includeArchived = false) {
  const whereClause = includeArchived ? '' : 'WHERE a.archived = 0';
  return db
    .prepare(
      `SELECT
        a.*,
        COALESCE(inc.total, 0) AS total_income,
        COALESCE(exp.total, 0) AS total_expense,
        COALESCE(tin.total, 0) AS transfers_in,
        COALESCE(tout.total, 0) AS transfers_out,
        ROUND(
          a.initial_balance
          + COALESCE(inc.total, 0)
          - COALESCE(exp.total, 0)
          + COALESCE(tin.total, 0)
          - COALESCE(tout.total, 0),
          2
        ) AS balance
      FROM accounts a
      LEFT JOIN (
        SELECT account_id, SUM(amount) AS total FROM transactions WHERE type = 'income' GROUP BY account_id
      ) inc ON inc.account_id = a.id
      LEFT JOIN (
        SELECT account_id, SUM(amount) AS total FROM transactions WHERE type = 'expense' GROUP BY account_id
      ) exp ON exp.account_id = a.id
      LEFT JOIN (
        SELECT to_account_id AS account_id, SUM(amount) AS total FROM transactions WHERE type = 'transfer' GROUP BY to_account_id
      ) tin ON tin.account_id = a.id
      LEFT JOIN (
        SELECT account_id, SUM(amount) AS total FROM transactions WHERE type = 'transfer' GROUP BY account_id
      ) tout ON tout.account_id = a.id
      ${whereClause}
      ORDER BY a.archived ASC, a.id ASC`
    )
    .all();
}

function getBudgetsForMonth(db, month) {
  const { start, end } = monthRange(month);
  // Specific month budget overrides default ('ALL') budget for the same category
  const rawBudgets = db
    .prepare(
      `SELECT b.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       WHERE b.month = ? OR b.month = 'ALL'
       ORDER BY CASE WHEN b.month = ? THEN 0 ELSE 1 END, c.name ASC`
    )
    .all(month, month);

  const byCategory = new Map();
  for (const b of rawBudgets) {
    if (!byCategory.has(b.category_id)) {
      byCategory.set(b.category_id, b);
    }
  }

  const spentRows = db
    .prepare(
      `SELECT category_id, ROUND(SUM(amount), 2) AS spent
       FROM transactions
       WHERE type = 'expense' AND date BETWEEN ? AND ? AND category_id IS NOT NULL
       GROUP BY category_id`
    )
    .all(start, end);
  const spentMap = new Map(spentRows.map((r) => [r.category_id, r.spent]));

  return Array.from(byCategory.values())
    .map((b) => {
      const spent = spentMap.get(b.category_id) || 0;
      const remaining = Number((b.amount - spent).toFixed(2));
      const percent = b.amount > 0 ? Number(((spent / b.amount) * 100).toFixed(1)) : 0;
      let status = 'ok';
      if (spent > b.amount) status = 'exceeded';
      else if (spent >= b.amount * b.alert_threshold) status = 'warning';
      return {
        ...b,
        spent,
        remaining,
        percent,
        status,
        is_override: b.month === month
      };
    })
    .sort((a, b) => b.percent - a.percent);
}

export function createApp(options = {}) {
  const db = initDatabase(options.dbPath);
  processDueRecurring(db);

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  // Health
  app.get('/api/health', (_req, res) => {
    const currency = db.prepare("SELECT value FROM settings WHERE key = 'currency'").get()?.value || 'EUR';
    res.json({
      ok: true,
      service: 'finance-backend',
      currency,
      serverTime: new Date().toISOString()
    });
  });

  // Settings
  app.get('/api/settings', (_req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json(obj);
  });

  app.put('/api/settings', (req, res) => {
    const allowed = ['currency', 'locale', 'theme'];
    const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    const tx = db.transaction((body) => {
      for (const key of allowed) {
        if (body[key] !== undefined && body[key] !== null) {
          stmt.run(key, String(body[key]).trim());
        }
      }
    });
    tx(req.body || {});
    const rows = db.prepare('SELECT key, value FROM settings').all();
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  });

  // Accounts
  app.get('/api/accounts', (req, res) => {
    const includeArchived = req.query.includeArchived === 'true';
    res.json(getAccountsWithBalances(db, includeArchived));
  });

  app.post('/api/accounts', (req, res) => {
    const { name, type = 'checking', currency = 'EUR', initial_balance = 0, color = '#2563eb', icon = 'wallet' } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Account name is required' });
    }
    const validTypes = ['checking', 'savings', 'cash', 'credit', 'investment'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid account type' });
    }
    const info = db
      .prepare(
        'INSERT INTO accounts (name, type, currency, initial_balance, color, icon) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(String(name).trim(), type, String(currency || 'EUR').toUpperCase(), Number(initial_balance) || 0, color, icon);
    const created = getAccountsWithBalances(db, true).find((a) => a.id === Number(info.lastInsertRowid));
    res.status(201).json(created);
  });

  app.put('/api/accounts/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Account not found' });

    const { name, type, currency, initial_balance, color, icon, archived } = req.body || {};
    db.prepare(
      `UPDATE accounts SET
        name = ?,
        type = ?,
        currency = ?,
        initial_balance = ?,
        color = ?,
        icon = ?,
        archived = ?
      WHERE id = ?`
    ).run(
      name !== undefined ? String(name).trim() : existing.name,
      type !== undefined ? type : existing.type,
      currency !== undefined ? String(currency).toUpperCase() : existing.currency,
      initial_balance !== undefined ? Number(initial_balance) : existing.initial_balance,
      color !== undefined ? color : existing.color,
      icon !== undefined ? icon : existing.icon,
      archived !== undefined ? (archived ? 1 : 0) : existing.archived,
      id
    );
    const updated = getAccountsWithBalances(db, true).find((a) => a.id === id);
    res.json(updated);
  });

  app.delete('/api/accounts/:id', (req, res) => {
    const id = Number(req.params.id);
    const used = db
      .prepare('SELECT COUNT(*) AS count FROM transactions WHERE account_id = ? OR to_account_id = ?')
      .get(id, id).count;
    const usedRec = db
      .prepare('SELECT COUNT(*) AS count FROM recurring_rules WHERE account_id = ? OR to_account_id = ?')
      .get(id, id).count;
    if (used > 0 || usedRec > 0) {
      // Soft archive instead of breaking history
      db.prepare('UPDATE accounts SET archived = 1 WHERE id = ?').run(id);
      return res.json({ archived: true, id });
    }
    const info = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Account not found' });
    res.json({ deleted: true, id });
  });

  // Categories
  app.get('/api/categories', (req, res) => {
    const { type } = req.query;
    const rows = type
      ? db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY name ASC').all(type)
      : db.prepare('SELECT * FROM categories ORDER BY type ASC, name ASC').all();
    res.json(rows);
  });

  app.post('/api/categories', (req, res) => {
    const { name, type, color = '#64748b', icon = 'tag' } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Category name is required' });
    if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'Category type must be income or expense' });
    try {
      const info = db
        .prepare('INSERT INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)')
        .run(String(name).trim(), type, color, icon);
      const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(info.lastInsertRowid));
      res.status(201).json(created);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'Category already exists for this type' });
      }
      throw err;
    }
  });

  app.put('/api/categories/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Category not found' });
    const { name, color, icon } = req.body || {};
    db.prepare('UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?').run(
      name !== undefined ? String(name).trim() : existing.name,
      color !== undefined ? color : existing.color,
      icon !== undefined ? icon : existing.icon,
      id
    );
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
  });

  app.delete('/api/categories/:id', (req, res) => {
    const id = Number(req.params.id);
    const info = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ deleted: true, id });
  });

  // Transactions
  function queryTransactions(query = {}) {
    const clauses = [];
    const params = [];

    if (query.month && /^\d{4}-\d{2}$/.test(query.month)) {
      const { start, end } = monthRange(query.month);
      clauses.push('t.date BETWEEN ? AND ?');
      params.push(start, end);
    }
    if (query.from) {
      clauses.push('t.date >= ?');
      params.push(query.from);
    }
    if (query.to) {
      clauses.push('t.date <= ?');
      params.push(query.to);
    }
    if (query.type && ['income', 'expense', 'transfer'].includes(query.type)) {
      clauses.push('t.type = ?');
      params.push(query.type);
    }
    if (query.accountId) {
      clauses.push('(t.account_id = ? OR t.to_account_id = ?)');
      params.push(Number(query.accountId), Number(query.accountId));
    }
    if (query.categoryId) {
      clauses.push('t.category_id = ?');
      params.push(Number(query.categoryId));
    }
    if (query.search && String(query.search).trim()) {
      const like = `%${String(query.search).trim()}%`;
      clauses.push('(t.description LIKE ? OR t.notes LIKE ? OR c.name LIKE ? OR a.name LIKE ?)');
      params.push(like, like, like, like);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Math.max(Number(query.limit) || 500, 1), 2000);
    const offset = Math.max(Number(query.offset) || 0, 0);

    const sql = `
      SELECT
        t.*,
        a.name AS account_name,
        a.color AS account_color,
        a.currency AS account_currency,
        ta.name AS to_account_name,
        ta.color AS to_account_color,
        c.name AS category_name,
        c.color AS category_color,
        c.icon AS category_icon
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      LEFT JOIN accounts ta ON ta.id = t.to_account_id
      LEFT JOIN categories c ON c.id = t.category_id
      ${where}
      ORDER BY t.date DESC, t.id DESC
      LIMIT ? OFFSET ?
    `;

    return db.prepare(sql).all(...params, limit, offset);
  }

  app.get('/api/transactions', (req, res) => {
    res.json(queryTransactions(req.query));
  });

  app.post('/api/transactions', (req, res) => {
    const {
      type,
      amount,
      date = todayISO(),
      account_id,
      to_account_id = null,
      category_id = null,
      description = '',
      notes = ''
    } = req.body || {};

    if (!['income', 'expense', 'transfer'].includes(type)) {
      return res.status(400).json({ error: 'Type must be income, expense, or transfer' });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    if (!account_id) {
      return res.status(400).json({ error: 'Account is required' });
    }
    if (type === 'transfer') {
      if (!to_account_id || Number(to_account_id) === Number(account_id)) {
        return res.status(400).json({ error: 'Transfer requires a different destination account' });
      }
    }

    const info = db
      .prepare(
        `INSERT INTO transactions (type, amount, date, account_id, to_account_id, category_id, description, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        type,
        Number(numAmount.toFixed(2)),
        date,
        Number(account_id),
        type === 'transfer' ? Number(to_account_id) : null,
        type === 'transfer' ? null : category_id ? Number(category_id) : null,
        String(description || '').trim(),
        String(notes || '').trim()
      );

    const created = queryTransactions({ limit: 1 }).find((t) => t.id === Number(info.lastInsertRowid)) ||
      db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(info.lastInsertRowid));
    res.status(201).json(created);
  });

  app.put('/api/transactions/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });

    const type = req.body.type ?? existing.type;
    const amount = req.body.amount !== undefined ? Number(req.body.amount) : existing.amount;
    const date = req.body.date ?? existing.date;
    const account_id = req.body.account_id !== undefined ? Number(req.body.account_id) : existing.account_id;
    const to_account_id =
      type === 'transfer'
        ? req.body.to_account_id !== undefined
          ? Number(req.body.to_account_id)
          : existing.to_account_id
        : null;
    const category_id =
      type === 'transfer'
        ? null
        : req.body.category_id !== undefined
          ? req.body.category_id
            ? Number(req.body.category_id)
            : null
          : existing.category_id;
    const description = req.body.description !== undefined ? String(req.body.description).trim() : existing.description;
    const notes = req.body.notes !== undefined ? String(req.body.notes).trim() : existing.notes;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    if (type === 'transfer' && (!to_account_id || to_account_id === account_id)) {
      return res.status(400).json({ error: 'Transfer requires a different destination account' });
    }

    db.prepare(
      `UPDATE transactions SET
        type = ?, amount = ?, date = ?, account_id = ?, to_account_id = ?,
        category_id = ?, description = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(type, Number(amount.toFixed(2)), date, account_id, to_account_id, category_id, description, notes, id);

    const updated = db
      .prepare(
        `SELECT t.*, a.name AS account_name, a.color AS account_color, a.currency AS account_currency,
                ta.name AS to_account_name, ta.color AS to_account_color,
                c.name AS category_name, c.color AS category_color, c.icon AS category_icon
         FROM transactions t
         JOIN accounts a ON a.id = t.account_id
         LEFT JOIN accounts ta ON ta.id = t.to_account_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.id = ?`
      )
      .get(id);
    res.json(updated);
  });

  app.delete('/api/transactions/:id', (req, res) => {
    const id = Number(req.params.id);
    const info = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ deleted: true, id });
  });

  // Budgets
  app.get('/api/budgets', (req, res) => {
    const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : currentMonthISO();
    res.json(getBudgetsForMonth(db, month));
  });

  app.post('/api/budgets', (req, res) => {
    const { category_id, amount, month = 'ALL', alert_threshold = 0.8 } = req.body || {};
    if (!category_id) return res.status(400).json({ error: 'Category is required' });
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Budget amount must be greater than 0' });
    }
    const targetMonth = month === 'ALL' || /^\d{4}-\d{2}$/.test(month) ? month : 'ALL';
    const threshold = Math.min(Math.max(Number(alert_threshold) || 0.8, 0.1), 1.0);

    db.prepare(
      `INSERT INTO budgets (category_id, month, amount, alert_threshold)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(category_id, month) DO UPDATE SET
         amount = excluded.amount,
         alert_threshold = excluded.alert_threshold`
    ).run(Number(category_id), targetMonth, Number(numAmount.toFixed(2)), threshold);

    const viewMonth = targetMonth === 'ALL' ? currentMonthISO() : targetMonth;
    const item = getBudgetsForMonth(db, viewMonth).find((b) => b.category_id === Number(category_id));
    res.status(201).json(item);
  });

  app.delete('/api/budgets/:id', (req, res) => {
    const id = Number(req.params.id);
    const info = db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Budget not found' });
    res.json({ deleted: true, id });
  });

  // Recurring rules
  app.get('/api/recurring', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT r.*, a.name AS account_name, ta.name AS to_account_name,
                c.name AS category_name, c.color AS category_color
         FROM recurring_rules r
         JOIN accounts a ON a.id = r.account_id
         LEFT JOIN accounts ta ON ta.id = r.to_account_id
         LEFT JOIN categories c ON c.id = r.category_id
         ORDER BY r.active DESC, r.next_due_date ASC`
      )
      .all();
    res.json(rows);
  });

  app.post('/api/recurring', (req, res) => {
    const {
      name,
      type,
      amount,
      account_id,
      to_account_id = null,
      category_id = null,
      description = '',
      frequency = 'monthly',
      start_date = todayISO(),
      end_date = null,
      auto_create = true
    } = req.body || {};

    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Rule name is required' });
    if (!['income', 'expense', 'transfer'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    if (!['daily', 'weekly', 'biweekly', 'monthly', 'yearly'].includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) return res.status(400).json({ error: 'Amount must be > 0' });
    if (!account_id) return res.status(400).json({ error: 'Account is required' });

    const info = db
      .prepare(
        `INSERT INTO recurring_rules
         (name, type, amount, account_id, to_account_id, category_id, description, frequency, start_date, end_date, next_due_date, active, auto_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .run(
        String(name).trim(),
        type,
        Number(numAmount.toFixed(2)),
        Number(account_id),
        type === 'transfer' ? Number(to_account_id) : null,
        type === 'transfer' ? null : category_id ? Number(category_id) : null,
        String(description || '').trim(),
        frequency,
        start_date,
        end_date || null,
        start_date,
        auto_create ? 1 : 0
      );

    if (auto_create) {
      processDueRecurring(db);
    }

    const created = db
      .prepare(
        `SELECT r.*, a.name AS account_name, ta.name AS to_account_name,
                c.name AS category_name, c.color AS category_color
         FROM recurring_rules r
         JOIN accounts a ON a.id = r.account_id
         LEFT JOIN accounts ta ON ta.id = r.to_account_id
         LEFT JOIN categories c ON c.id = r.category_id
         WHERE r.id = ?`
      )
      .get(Number(info.lastInsertRowid));
    res.status(201).json(created);
  });

  app.put('/api/recurring/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM recurring_rules WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Recurring rule not found' });

    const b = req.body || {};
    const type = b.type ?? existing.type;
    db.prepare(
      `UPDATE recurring_rules SET
        name = ?, type = ?, amount = ?, account_id = ?, to_account_id = ?, category_id = ?,
        description = ?, frequency = ?, next_due_date = ?, end_date = ?, active = ?, auto_create = ?
       WHERE id = ?`
    ).run(
      b.name !== undefined ? String(b.name).trim() : existing.name,
      type,
      b.amount !== undefined ? Number(Number(b.amount).toFixed(2)) : existing.amount,
      b.account_id !== undefined ? Number(b.account_id) : existing.account_id,
      type === 'transfer' ? (b.to_account_id !== undefined ? Number(b.to_account_id) : existing.to_account_id) : null,
      type === 'transfer' ? null : (b.category_id !== undefined ? (b.category_id ? Number(b.category_id) : null) : existing.category_id),
      b.description !== undefined ? String(b.description).trim() : existing.description,
      b.frequency ?? existing.frequency,
      b.next_due_date ?? existing.next_due_date,
      b.end_date !== undefined ? b.end_date || null : existing.end_date,
      b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
      b.auto_create !== undefined ? (b.auto_create ? 1 : 0) : existing.auto_create,
      id
    );

    const updated = db
      .prepare(
        `SELECT r.*, a.name AS account_name, ta.name AS to_account_name,
                c.name AS category_name, c.color AS category_color
         FROM recurring_rules r
         JOIN accounts a ON a.id = r.account_id
         LEFT JOIN accounts ta ON ta.id = r.to_account_id
         LEFT JOIN categories c ON c.id = r.category_id
         WHERE r.id = ?`
      )
      .get(id);
    res.json(updated);
  });

  app.post('/api/recurring/:id/trigger', (req, res) => {
    const id = Number(req.params.id);
    const result = triggerRecurringOnce(db, id, req.body?.date);
    if (!result) return res.status(404).json({ error: 'Recurring rule not found' });
    res.json(result);
  });

  app.post('/api/recurring/process', (req, res) => {
    const result = processDueRecurring(db, req.body?.upToDate || todayISO());
    res.json(result);
  });

  app.delete('/api/recurring/:id', (req, res) => {
    const id = Number(req.params.id);
    const info = db.prepare('DELETE FROM recurring_rules WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Recurring rule not found' });
    res.json({ deleted: true, id });
  });

  // Overview dashboard endpoint
  app.get('/api/overview', (req, res) => {
    processDueRecurring(db);

    const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : currentMonthISO();
    const prevMonth = getPreviousMonth(month);
    const { start, end, days } = monthRange(month);
    const prevRange = monthRange(prevMonth);

    const totalsForRange = (s, e) => {
      const row = db
        .prepare(
          `SELECT
            ROUND(COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0), 2) AS income,
            ROUND(COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0), 2) AS expenses,
            COUNT(*) AS count
           FROM transactions
           WHERE date BETWEEN ? AND ?`
        )
        .get(s, e);
      const net = Number((row.income - row.expenses).toFixed(2));
      const savingsRate = row.income > 0 ? Number((((row.income - row.expenses) / row.income) * 100).toFixed(1)) : 0;
      return { ...row, net, savingsRate };
    };

    const current = totalsForRange(start, end);
    const previous = totalsForRange(prevRange.start, prevRange.end);

    const pctDelta = (curr, prev) => {
      if (prev === 0) return curr === 0 ? 0 : null;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    const accounts = getAccountsWithBalances(db, false);
    const totalBalance = Number(accounts.reduce((acc, a) => acc + Number(a.balance || 0), 0).toFixed(2));

    const categoryBreakdown = (txType) =>
      db
        .prepare(
          `SELECT
            COALESCE(c.id, 0) AS category_id,
            COALESCE(c.name, 'Uncategorized') AS name,
            COALESCE(c.color, '#94a3b8') AS color,
            COALESCE(c.icon, 'tag') AS icon,
            ROUND(SUM(t.amount), 2) AS total,
            COUNT(*) AS count
           FROM transactions t
           LEFT JOIN categories c ON c.id = t.category_id
           WHERE t.type = ? AND t.date BETWEEN ? AND ?
           GROUP BY COALESCE(c.id, 0)
           ORDER BY total DESC`
        )
        .all(txType, start, end);

    const expenseByCategory = categoryBreakdown('expense').map((item) => ({
      ...item,
      percent: current.expenses > 0 ? Number(((item.total / current.expenses) * 100).toFixed(1)) : 0
    }));

    const incomeByCategory = categoryBreakdown('income').map((item) => ({
      ...item,
      percent: current.income > 0 ? Number(((item.total / current.income) * 100).toFixed(1)) : 0
    }));

    const months = getRecentMonths(month, 6);
    const trendStart = `${months[0]}-01`;
    const trendRows = db
      .prepare(
        `SELECT
          substr(date, 1, 7) AS month,
          ROUND(COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0), 2) AS income,
          ROUND(COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0), 2) AS expenses
         FROM transactions
         WHERE date BETWEEN ? AND ?
         GROUP BY substr(date, 1, 7)`
      )
      .all(trendStart, end);
    const trendMap = new Map(trendRows.map((r) => [r.month, r]));
    const monthlyTrend = months.map((m) => {
      const r = trendMap.get(m) || { income: 0, expenses: 0 };
      return {
        month: m,
        income: r.income,
        expenses: r.expenses,
        net: Number((r.income - r.expenses).toFixed(2))
      };
    });

    const dailyRows = db
      .prepare(
        `SELECT
          date,
          ROUND(COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0), 2) AS income,
          ROUND(COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0), 2) AS expenses
         FROM transactions
         WHERE date BETWEEN ? AND ?
         GROUP BY date`
      )
      .all(start, end);
    const dailyMap = new Map(dailyRows.map((r) => [r.date, r]));
    const dailyCashFlow = [];
    for (let day = 1; day <= days; day++) {
      const d = `${month}-${String(day).padStart(2, '0')}`;
      const r = dailyMap.get(d) || { income: 0, expenses: 0 };
      dailyCashFlow.push({ day: String(day), date: d, income: r.income, expenses: r.expenses });
    }

    const budgets = getBudgetsForMonth(db, month);
    const budgetSummary = {
      totalBudgeted: Number(budgets.reduce((s, b) => s + b.amount, 0).toFixed(2)),
      totalSpent: Number(budgets.reduce((s, b) => s + b.spent, 0).toFixed(2)),
      exceededCount: budgets.filter((b) => b.status === 'exceeded').length,
      warningCount: budgets.filter((b) => b.status === 'warning').length
    };

    const upcomingRecurring = db
      .prepare(
        `SELECT r.*, a.name AS account_name, c.name AS category_name, c.color AS category_color
         FROM recurring_rules r
         JOIN accounts a ON a.id = r.account_id
         LEFT JOIN categories c ON c.id = r.category_id
         WHERE r.active = 1
         ORDER BY r.next_due_date ASC
         LIMIT 6`
      )
      .all();

    const recentTransactions = queryTransactions({ month, limit: 8 });
    const currency = db.prepare("SELECT value FROM settings WHERE key = 'currency'").get()?.value || 'EUR';

    res.json({
      month,
      currency,
      summary: {
        ...current,
        totalBalance,
        incomeDeltaPct: pctDelta(current.income, previous.income),
        expenseDeltaPct: pctDelta(current.expenses, previous.expenses),
        netDelta: Number((current.net - previous.net).toFixed(2))
      },
      accounts,
      expenseByCategory,
      incomeByCategory,
      monthlyTrend,
      dailyCashFlow,
      budgets,
      budgetSummary,
      upcomingRecurring,
      recentTransactions
    });
  });

  // CSV export
  app.get('/api/export/csv', (req, res) => {
    const rows = queryTransactions({ ...req.query, limit: 2000 });
    const csv = serializeTransactionsCsv(rows);
    const suffix = req.query.month ? `-${req.query.month}` : '';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="finance-transactions${suffix}.csv"`);
    res.send(csv);
  });

  // JSON backup export
  app.get('/api/export/json', (_req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="finance-backup.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      settings: db.prepare('SELECT * FROM settings').all(),
      accounts: db.prepare('SELECT * FROM accounts').all(),
      categories: db.prepare('SELECT * FROM categories').all(),
      transactions: db.prepare('SELECT * FROM transactions ORDER BY date DESC, id DESC').all(),
      budgets: db.prepare('SELECT * FROM budgets').all(),
      recurring_rules: db.prepare('SELECT * FROM recurring_rules').all()
    });
  });

  // CSV import
  app.post('/api/import/csv', (req, res) => {
    const { csvText, defaultAccountId } = req.body || {};
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'csvText is required' });
    }

    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      return res.status(400).json({ error: 'CSV must include a header row and at least one data row' });
    }

    const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const findCol = (aliases) => headers.findIndex((h) => aliases.includes(h));

    const dateIdx = findCol(['date', 'datum', 'transactiondate', 'bookingdate']);
    const amountIdx = findCol(['amount', 'betrag', 'value', 'sum', 'eur']);
    const typeIdx = findCol(['type', 'typ', 'kind', 'direction']);
    const catIdx = findCol(['category', 'kategorie']);
    const accIdx = findCol(['account', 'konto', 'wallet']);
    const toAccIdx = findCol(['toaccount', 'destinationaccount', 'targetaccount']);
    const descIdx = findCol(['description', 'memo', 'title', 'payee', 'merchant', 'verwendungszweck']);
    const notesIdx = findCol(['notes', 'note', 'comment', 'notiz']);

    if (dateIdx === -1 || amountIdx === -1) {
      return res.status(400).json({
        error: 'CSV header must include at least "date" and "amount" columns'
      });
    }

    const allAccounts = db.prepare('SELECT * FROM accounts').all();
    const fallbackAccount =
      allAccounts.find((a) => a.id === Number(defaultAccountId)) || allAccounts[0];
    if (!fallbackAccount) {
      return res.status(400).json({ error: 'Please create an account before importing CSV' });
    }

    const accByName = new Map(allAccounts.map((a) => [a.name.toLowerCase(), a.id]));
    const allCats = db.prepare('SELECT * FROM categories').all();
    const catByKey = new Map(allCats.map((c) => [`${c.type}:${c.name.toLowerCase()}`, c.id]));

    const insertAccount = db.prepare(
      "INSERT INTO accounts (name, type, currency, initial_balance, color, icon) VALUES (?, 'checking', 'EUR', 0, '#3b82f6', 'wallet')"
    );
    const insertCat = db.prepare(
      "INSERT INTO categories (name, type, color, icon) VALUES (?, ?, '#64748b', 'tag')"
    );
    const insertTx = db.prepare(
      `INSERT INTO transactions (type, amount, date, account_id, to_account_id, category_id, description, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let imported = 0;
    let skipped = 0;
    const errors = [];

    const runImport = db.transaction(() => {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const normDate = normalizeDate(r[dateIdx]);
        const parsedAmount = parseAmount(r[amountIdx]);

        if (!normDate || !Number.isFinite(parsedAmount) || parsedAmount === 0) {
          skipped += 1;
          errors.push(`Row ${i + 1}: invalid date or amount`);
          continue;
        }

        let txType = typeIdx !== -1 ? String(r[typeIdx] || '').toLowerCase().trim() : '';
        if (['in', 'credit', 'einnahme', 'income'].includes(txType)) txType = 'income';
        else if (['out', 'debit', 'ausgabe', 'expense'].includes(txType)) txType = 'expense';
        else if (['transfer', 'umbuchung'].includes(txType)) txType = 'transfer';
        else txType = parsedAmount < 0 ? 'expense' : 'income';

        const absAmount = Number(Math.abs(parsedAmount).toFixed(2));

        let accId = fallbackAccount.id;
        if (accIdx !== -1 && r[accIdx]) {
          const key = r[accIdx].toLowerCase();
          if (accByName.has(key)) {
            accId = accByName.get(key);
          } else {
            const createdAcc = insertAccount.run(r[accIdx]);
            accId = Number(createdAcc.lastInsertRowid);
            accByName.set(key, accId);
          }
        }

        let toAccId = null;
        if (txType === 'transfer' && toAccIdx !== -1 && r[toAccIdx]) {
          const key = r[toAccIdx].toLowerCase();
          if (accByName.has(key)) {
            toAccId = accByName.get(key);
          } else {
            const createdAcc = insertAccount.run(r[toAccIdx]);
            toAccId = Number(createdAcc.lastInsertRowid);
            accByName.set(key, toAccId);
          }
        }
        if (txType === 'transfer' && (!toAccId || toAccId === accId)) {
          txType = parsedAmount < 0 ? 'expense' : 'income';
          toAccId = null;
        }

        let catId = null;
        if (txType !== 'transfer' && catIdx !== -1 && r[catIdx]) {
          const catName = r[catIdx].trim();
          const catKey = `${txType}:${catName.toLowerCase()}`;
          if (catByKey.has(catKey)) {
            catId = catByKey.get(catKey);
          } else {
            const createdCat = insertCat.run(catName, txType);
            catId = Number(createdCat.lastInsertRowid);
            catByKey.set(catKey, catId);
          }
        }

        const desc = descIdx !== -1 ? r[descIdx] || '' : '';
        const notes = notesIdx !== -1 ? r[notesIdx] || '' : '';

        insertTx.run(txType, absAmount, normDate, accId, toAccId, catId, desc, notes);
        imported += 1;
      }
    });

    runImport();
    res.json({ imported, skipped, errors: errors.slice(0, 20) });
  });

  // Serve built frontend static files when present (single-server self-hosted mode)
  const frontendDist = options.frontendDist || path.resolve(__dirname, '..', '..', 'frontend', 'dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, db };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const PORT = Number(process.env.PORT || 3001);
  const HOST = process.env.HOST || '0.0.0.0';
  const { app } = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`Finance backend listening on http://${HOST}:${PORT}`);
  });
}
