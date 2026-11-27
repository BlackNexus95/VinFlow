function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeTransactionsCsv(rows) {
  const headers = [
    'date',
    'type',
    'amount',
    'currency',
    'category',
    'account',
    'to_account',
    'description',
    'notes'
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.type,
        Number(r.amount).toFixed(2),
        r.account_currency || 'EUR',
        r.category_name || '',
        r.account_name || '',
        r.to_account_name || '',
        r.description || '',
        r.notes || ''
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  return lines.join('\r\n') + '\r\n';
}

export function parseCsv(text) {
  const cleaned = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // Detect delimiter from first line if semicolon-delimited (common in European bank exports)
  const firstLine = cleaned.split(/\r?\n/, 1)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delim = semiCount > commaCount ? ';' : ',';

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c !== '')) rows.push(row);
  }
  return rows;
}

export function parseAmount(raw) {
  if (typeof raw === 'number') return raw;
  let s = String(raw || '')
    .trim()
    .replace(/[€$£\s]/g, '');
  if (!s) return NaN;
  // Support European decimal format like "1.234,56" or "42,50"
  if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(s) || /^-?\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  return Number(s);
}

export function normalizeDate(raw) {
  const s = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  const eu = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (eu) {
    const [, d, m, y] = eu;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}
