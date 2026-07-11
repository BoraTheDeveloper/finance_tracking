import type { Currency, Goal, Sheet } from '../app/types';
import type { Theme } from '../theme/theme';

export function round2(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function usd(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function usd0(amount: number) {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

export function khr(amount: number) {
  return `${round2(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}៛`;
}

export function amountUsd(amount: number, cur: Currency, rate: number) {
  return cur === 'KHR' ? amount / rate : amount;
}

export function amountLabel(amount: number, cur: Currency) {
  return cur === 'KHR' ? khr(amount) : usd(amount);
}

export function ordinal(n: number) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = n % 100;
  return `${n}${suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0]}`;
}

export function notifyToDate(hhmm: string) {
  const [hour, minute] = (hhmm || '21:00').split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hour) ? hour : 21, Number.isFinite(minute) ? minute : 0, 0, 0);
  return date;
}

export function formatClock(hhmm: string) {
  const [rawHour, rawMinute] = (hhmm || '21:00').split(':');
  let hour = Number(rawHour);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${(rawMinute ?? '00').padStart(2, '0')} ${suffix}`;
}

export function nowTime() {
  const date = new Date();
  let hour = date.getHours();
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${String(date.getMinutes()).padStart(2, '0')} ${suffix}`;
}

export function monthsToGo(goal: Goal) {
  if (goal.perMonth <= 0 || goal.saved >= goal.target) return null;
  const months = Math.ceil((goal.target - goal.saved) / goal.perMonth);
  return `${months} month${months === 1 ? '' : 's'} to go`;
}

export function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function dayFromInput(value: string) {
  const parsed = Number(value.replace(/[^0-9]/g, ''));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(31, Math.trunc(parsed));
}

export function heatColor(status: string, theme: Theme) {
  if (status === 'none') return theme.surface2;
  if (status === 'saved-high') return theme.heat.savedHigh;
  if (status === 'saved') return theme.heat.saved;
  if (status === 'near') return theme.heat.near;
  if (status === 'over') return theme.heat.over;
  return theme.heat.overHigh;
}

export function sheetTitle(sheet: Sheet) {
  if (sheet === 'income') return 'Monthly income';
  if (sheet === 'fixed') return 'Rent & utilities';
  if (sheet === 'loan') return 'Loan repayment';
  if (sheet === 'method') return 'Budgeting method';
  if (sheet === 'cycle') return 'Budget cycle';
  if (sheet === 'currency') return 'Currencies';
  if (sheet === 'reminder') return 'Daily reminder';
  if (sheet === 'category') return 'New category';
  if (sheet === 'entry') return 'Edit entry';
  if (sheet === 'iou') return 'Borrowed money';
  if (sheet === 'goal') return 'New goal';
  if (sheet === 'recurring') return 'Recurring payments';
  if (sheet === 'day') return 'Day view';
  if (sheet === 'month') return 'Current cycle';
  if (sheet === 'formula') return 'Daily budget';
  return '';
}
