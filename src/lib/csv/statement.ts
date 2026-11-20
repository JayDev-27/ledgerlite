import { parseCsv } from './parser';
import { parse, format, isValid } from 'date-fns';

type Direction = 'credit' | 'debit' | 'unknown';

export function readStatementMoney(raw = ''): number | undefined {
  const value = raw.trim().replace(/\u2212/g, '-').replace(/^\((.*)\)$/, '-$1')
    .replace(/^(INR|USD|EUR|GBP|CAD|AUD|NZD)\s*/i, '').replace(/[₹$€£]/g, '');
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?$/.test(value)) return undefined;
  const amount = Number(value.replace(/,/g, ''));
  return Number.isFinite(amount) ? amount : undefined;
}

function statementCurrency(raw: string): string | undefined {
  const codes = [...new Set(raw.match(/\b(?:INR|USD|EUR|GBP|CAD|AUD|NZD|JPY|AED|SGD|CHF|HKD|CNY)\b/gi)?.map((code) => code.toUpperCase()))];
  const symbol = raw.includes('₹') ? 'INR' : raw.includes('€') ? 'EUR' : raw.includes('£') ? 'GBP' : undefined;
  if (codes.length > 1 || (symbol && codes.length === 1 && codes[0] !== symbol)) return 'XXX';
  return codes[0] ?? symbol ?? (raw.includes('$') ? 'XXX' : undefined);
}

export function statementHeaders(headers: string[]) {
  const names = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9 /]/g, ' ').replace(/\s+/g, ' ').trim());
  const find = (pattern: RegExp) => names.findIndex((name) => pattern.test(name));
  return {
    date: [find(/^(?:transaction|txn)\s*(?:date|dt)$/), find(/^date$/), find(/^(?:posting|value)\s*(?:date|dt)$/)]
      .find((index) => index >= 0) ?? -1,
    merchant: find(/^(?:description|transaction description|transaction details|narration|merchant|payee|particulars|details)$/),
    debit: find(/^(?:debit|withdrawals?|money out)(?:\s+(?:amount|amt|inr|usd|dr))*(?: dr)?$/),
    credit: find(/^(?:credit|deposits?|money in)(?:\s+(?:amount|amt|inr|usd|cr))*(?: cr)?$/),
    amount: find(/^(?:(?:transaction|txn)\s+)?amount(?:\s+[a-z]{3})?$/),
    type: find(/^(?:(?:transaction |txn )?type|direction|dr\s*\/?\s*cr|cr\s*\/?\s*dr|debit\s*\/?\s*credit)$/),
    balance: find(/^(?:running |closing |available )?balance(?:\s+\w{3})?$/),
    currency: find(/^currency(?: code)?$/),
    category: find(/^category$/),
    method: find(/^payment (?:method|mode)$/),
  };
}

function directionFromType(value = ''): Direction {
  if (/^(?:cr|credit|deposit|inflow|money in)$/i.test(value)) return 'credit';
  if (/^(?:dr|debit|withdrawal|outflow|money out)$/i.test(value)) return 'debit';
  return 'unknown';
}

export function hasStatementDirections(headers: string[], rows: string[][], amountIndex?: number) {
  const cols = statementHeaders(headers);
  const amount = amountIndex ?? cols.amount;
  return cols.debit >= 0 || cols.credit >= 0 || cols.type >= 0 || cols.balance >= 0 ||
    rows.some((row) => directionFromType(row[amount]?.match(/\b(DR|CR)$/i)?.[1]) !== 'unknown' ||
      /^[+]/.test(row[amount] ?? '') ||
      (readStatementMoney(row[amount]) ?? 0) < 0);
}

export function isLedgerLiteExpenseExport(headers: string[]) {
  const names = new Set(headers.map((header) => header.toLowerCase()));
  return ['merchant', 'category', 'payment method', 'currency', 'tags', 'recurring', 'source'].every((name) => names.has(name));
}

interface StatementOptions {
  dateOrder?: string;
  currency?: string;
  expensesOnly?: boolean;
}

export function readStatementRows(headers: string[], rows: string[][], columns = statementHeaders(headers), context = '', options: StatementOptions = {}) {
  const columnMoney = (row: string[], index: number) => readStatementMoney(row[index]);
  const columnAmounts = rows.map((row) => columnMoney(row, columns.amount));
  const preamble = headers.join(' ') + ' ' + context;
  const dateCells = rows.map((row) => row[columns.date]?.match(/^(\d{1,2})[/-](\d{1,2})[/-]\d{4}$/));
  const mustBeMdy = dateCells.some((parts) => Number(parts?.[2]) > 12);
  const mustBeDmy = dateCells.some((parts) => Number(parts?.[1]) > 12);
  const currencyFromHeaders = statementCurrency(preamble);
  const unsignedExpenseFile = (options.expensesOnly || isLedgerLiteExpenseExport(headers)) &&
    !hasStatementDirections(headers, rows, columns.amount);
  const dateOrder = options.dateOrder || context;
  const dateFormat = mustBeMdy && !mustBeDmy ? 'M/d/yyyy' : mustBeDmy && !mustBeMdy ? 'd/M/yyyy'
    : /\bMM[-/]DD[-/]YYYY\b/i.test(dateOrder) ? 'M/d/yyyy'
      : /\bDD[-/]MM[-/]YYYY\b/i.test(dateOrder) ? 'd/M/yyyy' : '';

  // A payment/credit or explicit deposit provides a sign anchor. A checking balance
  // delta also confirms the convention when every comparable row agrees.
  const anchors = new Set<number>();
  const balanceAnchors = new Set<number>();
  const accountKind = /\bcredit card\b/i.test(preamble) ||
    rows.some((row) => /\bpayment thank you\b/i.test(row[columns.merchant] ?? '')) ? 'card'
    : /\b(?:checking|savings)\b/i.test(preamble) ? 'bank' : undefined;
  let previousBalance: number | undefined;
  for (const [index, row] of rows.entries()) {
    const amount = columnAmounts[index];
    const balance = columnMoney(row, columns.balance);
    const merchant = row[columns.merchant] ?? '';
    if (amount) {
      if (/\b(?:payment thank you|direct deposit|salary credited|mobile deposit|payroll deposit)\b/i.test(merchant)) anchors.add(Math.sign(amount));
      if (/\b(?:pos purchase|ach debit|atm withdrawal)\b/i.test(merchant)) anchors.add(-Math.sign(amount));
      if (balance !== undefined && previousBalance !== undefined && Math.abs(Math.abs(balance - previousBalance) - Math.abs(amount)) < 0.005) {
        balanceAnchors.add(Math.sign((balance - previousBalance) * amount));
      }
    }
    previousBalance = balance;
  }
  const creditSign = anchors.size === 1 ? [...anchors][0]
    : anchors.size === 0 && accountKind && balanceAnchors.size === 1
      ? [...balanceAnchors][0]! * (accountKind === 'bank' ? 1 : -1)
      : undefined;

  return rows.map((row, index) => {
    const signed = row[columns.amount] ?? '';
    const marker = signed.match(/\s*(DR|CR)$/i);
    const generic = marker ? readStatementMoney(signed.slice(0, -marker[0].length)) : columnAmounts[index];
    const debit = columnMoney(row, columns.debit);
    const credit = columnMoney(row, columns.credit);
    const split = columns.debit >= 0 || columns.credit >= 0;
    const amount = split ? (debit || credit || 0) : (generic ?? 0);
    let direction: Direction = 'unknown';
    if (split) {
      const debitCell = row[columns.debit] ?? '';
      const creditCell = row[columns.credit] ?? '';
      const malformed = (debitCell && !/^[-—]$/.test(debitCell) && debit === undefined) ||
        (creditCell && !/^[-—]$/.test(creditCell) && credit === undefined);
      if (!malformed && Boolean(debit) !== Boolean(credit)) direction = debit ? 'debit' : 'credit';
    } else if (columns.type >= 0 || marker) {
      const fromColumn = directionFromType(row[columns.type]);
      const fromAmount = directionFromType(marker?.[1]);
      direction = fromColumn === 'unknown' ? fromAmount : fromAmount === 'unknown' || fromColumn === fromAmount ? fromColumn : 'unknown';
    } else if (creditSign && amount) {
      direction = Math.sign(amount) === creditSign ? 'credit' : 'debit';
    } else if (unsignedExpenseFile && amount > 0) {
      direction = 'debit';
    }

    const rawDate = row[columns.date] ?? '';
    let date = '';
    if (/^\d{4}[-/]\d{2}[-/]\d{2}(?:$|T)/.test(rawDate)) {
      date = rawDate.slice(0, 10).replace(/\//g, '-');
    } else if (/^\d{1,2}[- ]+[A-Za-z]{3}[- ]+\d{4}$/.test(rawDate)) {
      const parsed = parse(rawDate.replace(/ +/g, '-'), 'd-MMM-yyyy', new Date(2000, 0, 1));
      if (isValid(parsed)) date = format(parsed, 'yyyy-MM-dd');
    } else if (dateFormat && /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(rawDate)) {
      const parsed = parse(rawDate.replace(/-/g, '/'), dateFormat, new Date(2000, 0, 1));
      if (isValid(parsed)) date = format(parsed, 'yyyy-MM-dd');
    }
    const rowCurrency = row[columns.currency]?.trim().toUpperCase();
    const rawMoney = split ? [row[columns.credit], row[columns.debit]].join(' ') : signed;
    const labeledCurrency = /^[A-Z]{3}$/.test(rowCurrency ?? '') ? rowCurrency : undefined;
    const amountCurrency = statementCurrency(rawMoney);
    const currency = labeledCurrency && amountCurrency && amountCurrency !== 'XXX' && labeledCurrency !== amountCurrency
      ? 'XXX' : labeledCurrency ??
        (amountCurrency === 'XXX' && rawMoney.includes('$') ? currencyFromHeaders ?? 'XXX' : amountCurrency) ??
        currencyFromHeaders ?? options.currency;

    return { accountKind, direction, date, amount: Math.abs(amount), currency, merchant: row[columns.merchant] ?? '',
      category: row[columns.category], method: row[columns.method] };
  });
}

export function parseStatementCsv(text: string, options?: StatementOptions) {
  for (const delimiter of [',', ';', '\t']) {
    const first = parseCsv(text, delimiter);
    const allRows = [first.headers, ...first.rows];
    const headerIndex = allRows.findIndex((row) => {
      const columns = statementHeaders(row);
      return columns.date >= 0 && columns.merchant >= 0 &&
        (columns.amount >= 0 || columns.debit >= 0 || columns.credit >= 0);
    });
    const headers = allRows[headerIndex];
    if (!headers) continue;
    const body = allRows.slice(headerIndex + 1);
    const preamble = allRows.slice(0, headerIndex).flat().join(' ');
    return { headers, body, preamble, headerRecord: headerIndex + 1, rows: readStatementRows(headers, body, undefined, preamble, options) };
  }
}
