import { isoDayFromDate, isoMonthFromDay } from '../domain/dates';

export function shiftIsoMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  return isoMonthFromDay(isoDayFromDate(new Date(year, monthIndex - 1 + delta, 1)));
}

export function monthLabel(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Days until the next occurrence of a monthly due-day (1–31), from today.
export function daysUntilDue(dueDay: number) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  let due = new Date(year, month, dueDay);
  if (due.getTime() < new Date(year, month, today.getDate()).getTime()) due = new Date(year, month + 1, dueDay);
  return Math.round((due.getTime() - new Date(year, month, today.getDate()).getTime()) / 86400000);
}

export function dueText(dueDay: number) {
  const days = daysUntilDue(dueDay);
  if (days <= 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}
