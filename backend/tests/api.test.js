import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/server.js';

function startTestServer() {
  const { app, db } = createApp({ dbPath: ':memory:' });
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, db, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function req(baseUrl, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-json response (e.g. csv)
  }
  return { status: res.status, json, text };
}

test('full finance API lifecycle: accounts, transactions, transfers, budgets, recurring, CSV', async (t) => {
  const { server, db, baseUrl } = await startTestServer();
  t.after(() => {
    server.close();
    db.close();
  });

  // 1. Health & default EUR currency
  const health = await req(baseUrl, '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.json.currency, 'EUR');

  // 2. Seeded accounts & categories
  const accountsRes = await req(baseUrl, '/api/accounts');
  assert.equal(accountsRes.status, 200);
  assert.ok(accountsRes.json.length >= 3);
  const checking = accountsRes.json[0];
  const savings = accountsRes.json[1];

  const catsRes = await req(baseUrl, '/api/categories');
  const salaryCat = catsRes.json.find((c) => c.name === 'Salary');
  const groceriesCat = catsRes.json.find((c) => c.name === 'Groceries');
  assert.ok(salaryCat && groceriesCat);

  // 3. Create income, expense, and transfer
  const inc = await req(baseUrl, '/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      type: 'income',
      amount: 3200,
      date: '2026-11-01',
      account_id: checking.id,
      category_id: salaryCat.id,
      description: 'Monthly Salary'
    })
  });
  assert.equal(inc.status, 201);

  const exp = await req(baseUrl, '/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      type: 'expense',
      amount: 185.5,
      date: '2026-11-05',
      account_id: checking.id,
      category_id: groceriesCat.id,
      description: 'REWE Groceries'
    })
  });
  assert.equal(exp.status, 201);

  const tr = await req(baseUrl, '/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      type: 'transfer',
      amount: 500,
      date: '2026-11-06',
      account_id: checking.id,
      to_account_id: savings.id,
      description: 'Monthly Savings Transfer'
    })
  });
  assert.equal(tr.status, 201);

  // 4. Verify computed balances
  const updatedAccounts = await req(baseUrl, '/api/accounts');
  const updatedChecking = updatedAccounts.json.find((a) => a.id === checking.id);
  const updatedSavings = updatedAccounts.json.find((a) => a.id === savings.id);
  assert.equal(updatedChecking.balance, 2514.5);
  assert.equal(updatedSavings.balance, 500);

  // 5. Budget warning/ok tracking
  const budget = await req(baseUrl, '/api/budgets', {
    method: 'POST',
    body: JSON.stringify({
      category_id: groceriesCat.id,
      amount: 200,
      month: 'ALL',
      alert_threshold: 0.8
    })
  });
  assert.equal(budget.status, 201);

  const budgetsNov = await req(baseUrl, '/api/budgets?month=2026-11');
  assert.equal(budgetsNov.json[0].spent, 185.5);
  assert.equal(budgetsNov.json[0].status, 'warning');

  // 6. Overview metrics
  const overview = await req(baseUrl, '/api/overview?month=2026-11');
  assert.equal(overview.status, 200);
  assert.equal(overview.json.summary.income, 3200);
  assert.equal(overview.json.summary.expenses, 185.5);
  assert.equal(overview.json.summary.net, 3014.5);
  assert.equal(overview.json.summary.totalBalance, 3014.5);

  // 7. Recurring rule creation + manual trigger
  const rec = await req(baseUrl, '/api/recurring', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Gym Membership',
      type: 'expense',
      amount: 39.99,
      account_id: checking.id,
      category_id: groceriesCat.id,
      frequency: 'monthly',
      start_date: '2027-01-01',
      auto_create: false
    })
  });
  assert.equal(rec.status, 201);

  const trig = await req(baseUrl, `/api/recurring/${rec.json.id}/trigger`, {
    method: 'POST',
    body: JSON.stringify({ date: '2026-11-10' })
  });
  assert.equal(trig.status, 200);
  assert.equal(trig.json.nextDueDate, '2026-12-10');

  // 8. CSV export + European semicolon CSV import
  const csvExp = await req(baseUrl, '/api/export/csv?month=2026-11');
  assert.equal(csvExp.status, 200);
  assert.ok(csvExp.text.includes('REWE Groceries'));

  const csvImp = await req(baseUrl, '/api/import/csv', {
    method: 'POST',
    body: JSON.stringify({
      defaultAccountId: checking.id,
      csvText: 'date;type;amount;category;description\n15.11.2026;expense;42,50;Dining & Cafes;Coffee & Lunch\n16.11.2026;income;150,00;Freelance;Logo design'
    })
  });
  assert.equal(csvImp.status, 200);
  assert.equal(csvImp.json.imported, 2);
  assert.equal(csvImp.json.skipped, 0);
});
