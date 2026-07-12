import * as XLSX from "xlsx";

import type { Currency, Expense, TransactionKind } from "../app/types";
import { collapseWhitespace } from "./expenseLabel";

export type AbaStatementTransaction = Readonly<{
  id: string;
  date: string;
  name: string;
  kind: TransactionKind;
  amount: number;
  cur: Currency;
  note: string;
  ref: string | null;
  balance?: number;
}>;

export type AbaBalanceWarning = Readonly<{
  rowNumber: number;
  date: string;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
}>;

export type AbaStatementParseResult = Readonly<{
  transactions: AbaStatementTransaction[];
  skippedRows: number;
  warnings: readonly AbaBalanceWarning[];
}>;

type Row = readonly unknown[];

type HeaderMap = Readonly<{
  date: number;
  details: number;
  moneyIn: number;
  moneyInCcy: number;
  moneyOut: number;
  moneyOutCcy: number;
  balance: number | null;
  balanceCcy: number | null;
  sourceFile: number | null;
}>;

const BALANCE_TOLERANCE = 0.02;

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function cellText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeHeader(value: unknown) {
  return cellText(value).toLowerCase().replace(/\s+/g, " ");
}

function toAmount(value: unknown) {
  const normalized = cellText(value).replace(/,/g, "");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Parse a running balance, where 0.00 (and negatives) are legitimate values, not "missing". */
function toBalance(value: unknown) {
  const normalized = cellText(value).replace(/,/g, "");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function toCurrency(value: unknown): Currency | null {
  const normalized = cellText(value).toUpperCase();
  return normalized === "USD" || normalized === "KHR" ? normalized : null;
}

export function parseAbaStatementDate(value: unknown) {
  const text = cellText(value);
  const match = /^(\w{3})\s+(\d{1,2}),\s*(\d{4})$/.exec(text);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  const day = Number(match[2]);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return `${match[3]}-${month}-${String(day).padStart(2, "0")}`;
}

function findHeader(rows: readonly Row[]): HeaderMap | null {
  for (const row of rows) {
    const headers = row.map(normalizeHeader);
    const date = headers.indexOf("date");
    const details = headers.indexOf("transaction details");
    const moneyIn = headers.indexOf("money in");
    const moneyOut = headers.indexOf("money out");
    if (date < 0 || details < 0 || moneyIn < 0 || moneyOut < 0) continue;

    const balance = headers.indexOf("balance");
    const sourceFile = headers.indexOf("source file");

    return {
      date,
      details,
      moneyIn,
      moneyInCcy: moneyIn + 1,
      moneyOut,
      moneyOutCcy: moneyOut + 1,
      balance: balance >= 0 ? balance : null,
      balanceCcy: balance >= 0 ? balance + 1 : null,
      sourceFile: sourceFile >= 0 ? sourceFile : null,
    };
  }

  return null;
}

function extractRef(details: string) {
  return /\bREF#\s*([A-Z0-9-]+)/i.exec(details)?.[1] ?? null;
}

function extractName(details: string, kind: TransactionKind) {
  const normalized = collapseWhitespace(details);
  const purchase = /^PURCHASE AT\s+(.+?)\s+ON\s+/i.exec(normalized);
  if (purchase) return purchase[1].trim();

  const received =
    /^FUNDS RECEIVED FROM\s+(.+?)(?:\s+\(|\s+ORIGINAL AMOUNT\b|\s+REF#)/i.exec(
      normalized,
    );
  if (received) return `From ${received[1].trim()}`;

  const transferred =
    /^FUNDS TRANSFERRED TO\s+(.+?)(?:\s+\d{6,}\b|\s+ORIGINAL AMOUNT\b|\s+REF#)/i.exec(
      normalized,
    );
  if (transferred) return `To ${transferred[1].trim()}`;

  return kind === "income" ? "ABA income" : "ABA transaction";
}

function buildNote(details: string, ref: string | null) {
  const original =
    /\bORIGINAL AMOUNT\s+([0-9,.]+\s+(?:USD|KHR))/i.exec(details)?.[1] ?? null;
  const parts = ["ABA import"];
  if (ref) parts.push(`REF# ${ref}`);
  if (original) parts.push(`Original ${original.replace(/\s+/g, " ")}`);
  return parts.join(" · ");
}

function transactionId(
  date: string,
  kind: TransactionKind,
  ref: string | null,
  rowNumber: number,
) {
  return `aba-${date}-${kind}-${ref ?? `row-${rowNumber}`}`.replace(
    /[^a-zA-Z0-9_-]+/g,
    "-",
  );
}

export function parseAbaStatementRows(
  rows: readonly Row[],
): AbaStatementParseResult {
  const header = findHeader(rows);
  if (!header) throw new Error("ABA statement header was not found");

  const transactions: AbaStatementTransaction[] = [];
  const warnings: AbaBalanceWarning[] = [];
  let skippedRows = 0;
  let prevBalance: number | null = null;
  let prevSourceFile: string | null = null;

  for (const [index, row] of rows.entries()) {
    const date = parseAbaStatementDate(row[header.date]);
    const details = collapseWhitespace(cellText(row[header.details]));
    if (!date && !details) continue;
    if (!date || !details) {
      skippedRows += 1;
      continue;
    }

    const moneyIn = toAmount(row[header.moneyIn]);
    const moneyOut = toAmount(row[header.moneyOut]);
    const kind: TransactionKind | null = moneyIn
      ? "income"
      : moneyOut
        ? "expense"
        : null;
    const amount = moneyIn ?? moneyOut;
    const cur = toCurrency(
      moneyIn ? row[header.moneyInCcy] : row[header.moneyOutCcy],
    );
    if (!kind || !amount || !cur) {
      skippedRows += 1;
      continue;
    }

    // A combined multi-statement CSV carries one running balance per source file;
    // reset continuity tracking at each file boundary so we don't compare across them.
    const sourceFile =
      header.sourceFile !== null ? cellText(row[header.sourceFile]) : null;
    if (sourceFile !== null && sourceFile !== prevSourceFile) {
      prevBalance = null;
      prevSourceFile = sourceFile;
    }

    const balance =
      header.balance !== null ? toBalance(row[header.balance]) : null;

    if (balance !== null && prevBalance !== null) {
      const signedDelta = (moneyIn ?? 0) - (moneyOut ?? 0);
      const expected = Math.round((prevBalance + signedDelta) * 100) / 100;
      const diff = Math.round((balance - expected) * 100) / 100;
      if (Math.abs(diff) > BALANCE_TOLERANCE) {
        warnings.push({
          rowNumber: index + 1,
          date,
          expectedBalance: expected,
          actualBalance: balance,
          difference: diff,
        });
      }
    }
    if (balance !== null) prevBalance = balance;

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
      ...(balance != null ? { balance } : {}),
    });
  }

  return { transactions, skippedRows, warnings };
}

/**
 * RFC-4180-style CSV parser: a quoted field may span embedded newlines and
 * contain escaped double-quotes (""), so we scan the whole text rather than
 * splitting on newlines first.
 */
function parseCsvText(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.some((cell) => cell.length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char !== "\r") {
      field += char;
    }
  }
  pushRow();
  return rows;
}
function firstSheetRows(workbook: XLSX.WorkBook): Row[] {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("ABA statement has no sheets");
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<Row>(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });
}

export function parseAbaStatementWorkbookBase64(base64: string) {
  const workbook = XLSX.read(base64, { type: "base64" });
  return parseAbaStatementRows(firstSheetRows(workbook));
}

export function parseAbaStatementText(text: string) {
  const workbook = XLSX.read(text, { type: "string" });
  return parseAbaStatementRows(firstSheetRows(workbook));
}

/** Parse ABA statement exported as CSV (same columns as XLSX). */
export function parseAbaStatementCsvText(text: string) {
  return parseAbaStatementRows(parseCsvText(text));
}

export function toExpenseFromAbaTransaction(
  transaction: AbaStatementTransaction,
  cat: string,
  prediction?: Expense["prediction"],
): Expense {
  return {
    id: transaction.id,
    name: transaction.name,
    cat,
    amount: transaction.amount,
    cur: transaction.cur,
    time: "imported",
    date: transaction.date,
    kind: transaction.kind,
    note: transaction.note,
    ...(prediction ? { prediction } : {}),
    ...(transaction.ref ? { importSourceHash: transaction.ref } : {}),
  };
}

function postedAmountKey(amount: number) {
  return Math.round(amount * 100);
}

export function isDuplicateAbaTransaction(
  existing: readonly Expense[],
  transaction: AbaStatementTransaction,
) {
  return existing.some((expense) => {
    // A REF# is only unique per direction: a transfer's outgoing (expense) and
    // incoming (income) legs share the same REF#, so the kind must also match.
    if (transaction.ref && expense.note?.includes(`REF# ${transaction.ref}`)) {
      return (expense.kind ?? "expense") === transaction.kind;
    }
    // Fallback for ref-less rows: date + amount + currency + kind alone can
    // collide across genuinely different same-day purchases, so require the
    // merchant name to match too.
    return (
      expense.date === transaction.date &&
      postedAmountKey(expense.amount) === postedAmountKey(transaction.amount) &&
      expense.cur === transaction.cur &&
      (expense.kind ?? "expense") === transaction.kind &&
      expense.name === transaction.name
    );
  });
}

function isSameAbaTransaction(
  a: AbaStatementTransaction,
  b: AbaStatementTransaction,
) {
  if (a.ref && b.ref) return a.ref === b.ref && a.kind === b.kind;
  return (
    a.date === b.date &&
    postedAmountKey(a.amount) === postedAmountKey(b.amount) &&
    a.cur === b.cur &&
    a.kind === b.kind &&
    a.name === b.name
  );
}

/**
 * Filter parsed transactions against already-stored expenses AND against each
 * other, so duplicate rows within a single imported file are also dropped.
 */
export function dedupeAbaTransactions(
  existing: readonly Expense[],
  transactions: readonly AbaStatementTransaction[],
): AbaStatementTransaction[] {
  const accepted: AbaStatementTransaction[] = [];
  for (const transaction of transactions) {
    if (isDuplicateAbaTransaction(existing, transaction)) continue;
    if (accepted.some((prior) => isSameAbaTransaction(prior, transaction)))
      continue;
    accepted.push(transaction);
  }
  return accepted;
}
