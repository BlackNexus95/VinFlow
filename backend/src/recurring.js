export function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function advanceDate(isoDate, frequency) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));

  switch (frequency) {
    case 'daily':
      dt.setUTCDate(dt.getUTCDate() + 1);
      break;
    case 'weekly':
      dt.setUTCDate(dt.getUTCDate() + 7);
      break;
    case 'biweekly':
      dt.setUTCDate(dt.getUTCDate() + 14);
      break;
    case 'monthly': {
      const targetMonth = dt.getUTCMonth() + 1;
      const targetYear = dt.getUTCFullYear() + Math.floor(targetMonth / 12);
      const normMonth = targetMonth % 12;
      const maxDay = new Date(Date.UTC(targetYear, normMonth + 1, 0)).getUTCDate();
      dt.setUTCFullYear(targetYear, normMonth, Math.min(d, maxDay));
      break;
    }
    case 'yearly': {
      const targetYear = dt.getUTCFullYear() + 1;
      const maxDay = new Date(Date.UTC(targetYear, m, 0)).getUTCDate();
      dt.setUTCFullYear(targetYear, m - 1, Math.min(d, maxDay));
      break;
    }
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }

  return dt.toISOString().slice(0, 10);
}

export function processDueRecurring(db, upToDate = todayISO()) {
  const rules = db
    .prepare(
      `SELECT * FROM recurring_rules
       WHERE active = 1 AND auto_create = 1 AND next_due_date <= ?`
    )
    .all(upToDate);

  if (rules.length === 0) return { created: 0, transactionIds: [] };

  const insertTx = db.prepare(`
    INSERT INTO transactions (type, amount, date, account_id, to_account_id, category_id, description, notes, recurring_id)
    VALUES (@type, @amount, @date, @account_id, @to_account_id, @category_id, @description, @notes, @recurring_id)
  `);
  const updateRule = db.prepare(`
    UPDATE recurring_rules SET next_due_date = ?, active = ? WHERE id = ?
  `);

  const createdIds = [];

  const runBatch = db.transaction(() => {
    for (const rule of rules) {
      let due = rule.next_due_date;
      let active = rule.active;
      let safety = 0;

      while (active && due <= upToDate && safety < 366) {
        safety += 1;
        if (rule.end_date && due > rule.end_date) {
          active = 0;
          break;
        }

        const res = insertTx.run({
          type: rule.type,
          amount: rule.amount,
          date: due,
          account_id: rule.account_id,
          to_account_id: rule.to_account_id,
          category_id: rule.category_id,
          description: rule.description || rule.name,
          notes: `Auto-posted from recurring rule: ${rule.name}`,
          recurring_id: rule.id
        });
        createdIds.push(Number(res.lastInsertRowid));

        due = advanceDate(due, rule.frequency);
        if (rule.end_date && due > rule.end_date) {
          active = 0;
        }
      }

      updateRule.run(due, active, rule.id);
    }
  });

  runBatch();
  return { created: createdIds.length, transactionIds: createdIds };
}

export function triggerRecurringOnce(db, ruleId, overrideDate) {
  const rule = db.prepare('SELECT * FROM recurring_rules WHERE id = ?').get(ruleId);
  if (!rule) return null;

  const postDate = overrideDate || rule.next_due_date || todayISO();
  const nextDue = advanceDate(postDate, rule.frequency);
  const stillActive = rule.end_date && nextDue > rule.end_date ? 0 : rule.active;

  let txId;
  const run = db.transaction(() => {
    const res = db
      .prepare(
        `INSERT INTO transactions (type, amount, date, account_id, to_account_id, category_id, description, notes, recurring_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        rule.type,
        rule.amount,
        postDate,
        rule.account_id,
        rule.to_account_id,
        rule.category_id,
        rule.description || rule.name,
        `Posted from recurring rule: ${rule.name}`,
        rule.id
      );
    txId = Number(res.lastInsertRowid);
    db.prepare('UPDATE recurring_rules SET next_due_date = ?, active = ? WHERE id = ?').run(
      nextDue,
      stillActive,
      rule.id
    );
  });

  run();
  return { transactionId: txId, nextDueDate: nextDue, active: Boolean(stillActive) };
}
