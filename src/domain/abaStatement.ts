import * as XLSX from 'xlsx';

import type { Currency, Expense, TransactionKind } from '../app/types';

export type AbaStatementTransaction = Readonly<{
  id: string;
  date: string;
  name: string;
  kind: TransactionKind;
  amount: number;
  cur: Currency;
  note: string;
  ref: string | null;
}>;

export type AbaStatementParseResult = Readonly<{
  transactions: AbaStatementTransaction[];
  skippedRows: number;
}>;

type Row = readonly unknown[];

type HeaderMap = Readonly<{
  date: number;
  details: number;
  moneyIn: number;
  moneyInCcy: number;
  moneyOut: number;
  moneyOutCcy: number;
}>;

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

function cellText(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeHeader(value: unknown) {
  return cellText(value).toLowerCase().replace(/\s+/g, ' ');
}

function toAmount(value: unknown) {
  const normalized = cellText(value).replace(/,/g, '');
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function toCurrency(value: unknown): Currency | null {
  const normalized = cellText(value).toUpperCase();
  return normalized === 'USD' || normalized === 'KHR' ? normalized : null;
}

export function parseAbaStatementDate(value: unknown) {
  const text = cellText(value);
  const match = /^(\w{3})\s+(\d{1,2}),\s*(\d{4})$/.exec(text);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  const day = Number(match[2]);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return `${match[3]}-${month}-${String(day).padStart(2, '0')}`;
}

function findHeader(rows: readonly Row[]): HeaderMap | null {
  for (const row of rows) {
    const headers = row.map(normalizeHeader);
    const date = headers.indexOf('date');
    const details = headers.indexOf('transaction details');
    const moneyIn = headers.indexOf('money in');
    const moneyOut = headers.indexOf('money out');
    if (date < 0 || details < 0 || moneyIn < 0 || moneyOut < 0) continue;

    return {
      date,
      details,
      moneyIn,
      moneyInCcy: moneyIn + 1,
      moneyOut,
      moneyOutCcy: moneyOut + 1,
    };
  }

  return null;
}

function cleanDetails(details: string) {
  return details.replace(/\s+/g, ' ').trim();
}

function extractRef(details: string) {
  return /\bREF#\s*([A-Z0-9-]+)/i.exec(details)?.[1] ?? null;
}

function extractName(details: string, kind: TransactionKind) {
  const normalized = cleanDetails(details);
  const purchase = /^PURCHASE AT\s+(.+?)\s+ON\s+/i.exec(normalized);
  if (purchase) return purchase[1].trim();

  const received = /^FUNDS RECEIVED FROM\s+(.+?)(?:\s+\(|\s+ORIGINAL AMOUNT\b|\s+REF#\b)/i.exec(normalized);
  if (received) return `From ${received[1].trim()}`;

  const transferred = /^FUNDS TRANSFERRED TO\s+(.+?)(?:\s+\d{6,}\b|\s+ORIGINAL AMOUNT\b|\s+REF#\b)/i.exec(normalized);
  if (transferred) return `To ${transferred[1].trim()}`;

  return kind === 'income' ? 'ABA income' : 'ABA transaction';
}

function buildNote(details: string, ref: string | null) {
  const original = /\bORIGINAL AMOUNT\s+([0-9,.]+\s+(?:USD|KHR))/i.exec(details)?.[1] ?? null;
  const parts = ['ABA import'];
  if (ref) parts.push(`REF# ${ref}`);
  if (original) parts.push(`Original ${original.replace(/\s+/g, ' ')}`);
  return parts.join(' · ');
}

function transactionId(date: string, kind: TransactionKind, ref: string | null, rowNumber: number) {
  return `aba-${date}-${kind}-${ref ?? `row-${rowNumber}`}`.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

export function parseAbaStatementRows(rows: readonly Row[]): AbaStatementParseResult {
  const header = findHeader(rows);
  if (!header) throw new Error('ABA statement header was not found');

  const transactions: AbaStatementTransaction[] = [];
  let skippedRows = 0;

  for (const [index, row] of rows.entries()) {
    const date = parseAbaStatementDate(row[header.date]);
    const details = cleanDetails(cellText(row[header.details]));
    if (!date && !details) continue;
    if (!date || !details) {
      skippedRows += 1;
      continue;
    }

    const moneyIn = toAmount(row[header.moneyIn]);
    const moneyOut = toAmount(row[header.moneyOut]);
    const kind: TransactionKind | null = moneyIn ? 'income' : moneyOut ? 'expense' : null;
    const amount = moneyIn ?? moneyOut;
    const cur = toCurrency(moneyIn ? row[header.moneyInCcy] : row[header.moneyOutCcy]);
    if (!kind || !amount || !cur) {
      skippedRows += 1;
      continue;
    }

    const ref = extractRef(details);
    transactions.push({
      id: transactionId(date, kind, ref, index + 1),
      date,
      name: extractName(details, kind),
      kind,
      amount,
      cur,
      note: buildNote(details, ref),
      ref,
    });
  }

  return { transactions, skippedRows };
}

function firstSheetRows(workbook: XLSX.WorkBook): Row[] {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('ABA statement has no sheets');
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, blankrows: false, raw: false });
}

export function parseAbaStatementWorkbookBase64(base64: string) {
  const workbook = XLSX.read(base64, { type: 'base64' });
  return parseAbaStatementRows(firstSheetRows(workbook));
}

export function parseAbaStatementText(text: string) {
  const workbook = XLSX.read(text, { type: 'string' });
  return parseAbaStatementRows(firstSheetRows(workbook));
}

export function toExpenseFromAbaTransaction(transaction: AbaStatementTransaction, cat: string): Expense {
  return {
    id: transaction.id,
    name: transaction.name,
    cat,
    amount: transaction.amount,
    cur: transaction.cur,
    time: 'imported',
    date: transaction.date,
    kind: transaction.kind,
    note: transaction.note,
  };
}

function postedAmountKey(amount: number) {
  return Math.round(amount * 100);
}

export function isDuplicateAbaTransaction(existing: readonly Expense[], transaction: AbaStatementTransaction) {
  return existing.some((expense) => {
    if (transaction.ref && expense.note?.includes(`REF# ${transaction.ref}`)) return true;
    const samePostedTransaction = expense.date === transaction.date
      && postedAmountKey(expense.amount) === postedAmountKey(transaction.amount)
      && expense.cur === transaction.cur
      && (expense.kind ?? 'expense') === transaction.kind;

    return samePostedTransaction;
  });
}
