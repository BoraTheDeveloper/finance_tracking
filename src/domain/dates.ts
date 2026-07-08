import { Currency } from './money';

export type IsoDayString = `${number}-${number}-${number}`;
export type IsoMonthString = `${number}-${number}`;

export const MAX_HISTORY_DAYS = 35;

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH_RE = /^(\d{4})-(\d{2})$/;

export type DatedExpense = Readonly<{
  date?: string | null;
  amount: number;
  cur: Currency;
} & Record<string, unknown>>;

export type MonthlyResetCategory = {
  spentUsd: number;
  swept?: boolean;
};

export type RolloverInput<Category extends MonthlyResetCategory> = Readonly<{
  today: IsoDayString;
  lastActiveDay?: string | null;
  lastActiveMonth?: string | null;
  expenses: readonly DatedExpense[];
  history: readonly number[];
  categories: readonly Category[];
  paidBills: Readonly<Record<string, boolean>>;
  swept?: boolean;
  khrPerUsd?: number;
  maxHistoryDays?: number;
}>;

export type RolloverResult<Category extends MonthlyResetCategory> = Readonly<{
  lastActiveDay: IsoDayString;
  lastActiveMonth: IsoMonthString;
  history: number[];
  categories: Category[];
  paidBills: Record<string, boolean>;
  swept?: boolean;
  dailyRolledOver: boolean;
  monthlyRolledOver: boolean;
  previousActiveDaySpentUsd: number;
}>;

type DayParts = Readonly<{ year: number; month: number; day: number }>;

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function parseIsoDay(value: string): DayParts | null {
  const match = ISO_DAY_RE.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

function parseIsoMonth(value: string): Omit<DayParts, 'day'> | null {
  const match = ISO_MONTH_RE.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function isIsoDay(value: string): value is IsoDayString {
  return parseIsoDay(value) != null;
}

export function isIsoMonth(value: string): value is IsoMonthString {
  return parseIsoMonth(value) != null;
}

export function assertIsoDay(value: string, label = 'ISO day'): IsoDayString {
  if (!isIsoDay(value)) throw new Error(`${label} must be YYYY-MM-DD`);
  return value;
}

export function assertIsoMonth(value: string, label = 'ISO month'): IsoMonthString {
  if (!isIsoMonth(value)) throw new Error(`${label} must be YYYY-MM`);
  return value;
}

export function isoDayFromDate(date: Date): IsoDayString {
  if (!Number.isFinite(date.getTime())) throw new Error('date must be valid');
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` as IsoDayString;
}

export function isoMonthFromDate(date: Date): IsoMonthString {
  if (!Number.isFinite(date.getTime())) throw new Error('date must be valid');
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}` as IsoMonthString;
}

export function isoMonthFromDay(day: string): IsoMonthString {
  const parts = parseIsoDay(assertIsoDay(day));
  return `${parts!.year}-${pad2(parts!.month)}` as IsoMonthString;
}

export function daysInIsoMonth(month: string): number {
  const parts = parseIsoMonth(assertIsoMonth(month));
  return daysInMonth(parts!.year, parts!.month);
}

function isoDayTimestamp(day: string): number {
  const parts = parseIsoDay(assertIsoDay(day));
  return new Date(parts!.year, parts!.month - 1, parts!.day).getTime();
}

export function addIsoDays(day: string, days: number): IsoDayString {
  if (!Number.isInteger(days)) throw new Error('days must be an integer');
  const parts = parseIsoDay(assertIsoDay(day));
  return isoDayFromDate(new Date(parts!.year, parts!.month - 1, parts!.day + days));
}

export function elapsedIsoDays(lastActiveDay: string, today: string): IsoDayString[] {
  const start = assertIsoDay(lastActiveDay, 'lastActiveDay');
  const end = assertIsoDay(today, 'today');
  if (isoDayTimestamp(start) >= isoDayTimestamp(end)) return [];

  const days: IsoDayString[] = [];
  for (let cursor = start; cursor !== end; cursor = addIsoDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}

export function daysRemainingInMonth(day: string): number {
  const parts = parseIsoDay(assertIsoDay(day));
  return daysInMonth(parts!.year, parts!.month) - parts!.day + 1;
}


function expenseDate(expense: object): string | null | undefined {
  if (!('date' in expense)) return undefined;
  const date = expense.date;
  return typeof date === 'string' ? date : date === null ? null : undefined;
}
export function isIsoDayInMonth(day: string | null | undefined, month: string): day is IsoDayString {
  assertIsoMonth(month);
  return typeof day === 'string' && isIsoDay(day) && day.startsWith(`${month}-`);
}

export function filterExpensesByDay<Expense extends object>(expenses: readonly Expense[], day: string): Expense[] {
  assertIsoDay(day);
  return expenses.filter((expense) => expenseDate(expense) === day);
}

export function filterExpensesByMonth<Expense extends object>(expenses: readonly Expense[], month: string): Expense[] {
  assertIsoMonth(month);
  return expenses.filter((expense) => isIsoDayInMonth(expenseDate(expense), month));
}

export function amountUsd(expense: Pick<DatedExpense, 'amount' | 'cur'>, khrPerUsd = 4100): number {
  if (!Number.isFinite(expense.amount)) throw new Error('expense amount must be finite');
  if (!Number.isFinite(khrPerUsd) || khrPerUsd <= 0) throw new Error('KHR per USD rate must be positive');
  return expense.cur === 'KHR' ? expense.amount / khrPerUsd : expense.amount;
}

function isSpendingRecord(expense: DatedExpense) {
  return expense.kind !== 'income';
}

export function spentUsdForDay(expenses: readonly DatedExpense[], day: string, khrPerUsd = 4100): number {
  return filterExpensesByDay(expenses, day).filter(isSpendingRecord).reduce((sum, expense) => sum + amountUsd(expense, khrPerUsd), 0);
}

export function spentUsdForMonth(expenses: readonly DatedExpense[], month: string, khrPerUsd = 4100): number {
  return filterExpensesByMonth(expenses, month).filter(isSpendingRecord).reduce((sum, expense) => sum + amountUsd(expense, khrPerUsd), 0);
}

export function appendTrimmedHistory(history: readonly number[], spentUsd: number, maxHistoryDays = MAX_HISTORY_DAYS): number[] {
  if (!Number.isFinite(spentUsd)) throw new Error('spent USD must be finite');
  if (!Number.isInteger(maxHistoryDays) || maxHistoryDays < 1) throw new Error('max history days must be a positive integer');
  return [...history, spentUsd].slice(-maxHistoryDays);
}

function resetCategoryForNewMonth<Category extends MonthlyResetCategory>(category: Category): Category {
  if ('swept' in category) return { ...category, spentUsd: 0, swept: false };
  return { ...category, spentUsd: 0 };
}

export function applyDateRollover<Category extends MonthlyResetCategory>(input: RolloverInput<Category>): RolloverResult<Category> {
  const today = assertIsoDay(input.today, 'today');
  const todayMonth = isoMonthFromDay(today);
  const lastActiveDay = typeof input.lastActiveDay === 'string' && isIsoDay(input.lastActiveDay) ? input.lastActiveDay : null;
  const lastActiveMonth = typeof input.lastActiveMonth === 'string' && isIsoMonth(input.lastActiveMonth) ? input.lastActiveMonth : null;
  const elapsedDays = lastActiveDay != null ? elapsedIsoDays(lastActiveDay, today) : [];
  const dailyRolledOver = elapsedDays.length > 0;
  const monthlyRolledOver = lastActiveMonth != null && lastActiveMonth !== todayMonth;
  const previousActiveDaySpentUsd = dailyRolledOver ? spentUsdForDay(input.expenses, elapsedDays[0], input.khrPerUsd) : 0;
  const history = dailyRolledOver
    ? elapsedDays.reduce((items, day) => appendTrimmedHistory(items, spentUsdForDay(input.expenses, day, input.khrPerUsd), input.maxHistoryDays), [...input.history])
    : [...input.history];

  return {
    lastActiveDay: today,
    lastActiveMonth: todayMonth,
    history,
    categories: monthlyRolledOver ? input.categories.map(resetCategoryForNewMonth) : [...input.categories],
    paidBills: monthlyRolledOver ? {} : { ...input.paidBills },
    swept: monthlyRolledOver && input.swept != null ? false : input.swept,
    dailyRolledOver,
    monthlyRolledOver,
    previousActiveDaySpentUsd,
  };
}
