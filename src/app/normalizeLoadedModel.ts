import type { AppModel, Expense } from './types';
import { INITIAL_MODEL } from './initialState';
import { rolloverUsdAfterElapsedDays } from './budgetSummary';
import {
  applyDateRollover,
  elapsedIsoDays,
  isIsoDay,
  isIsoMonth,
  isoDayFromDate,
  isoMonthFromDay,
} from '../domain/dates';

export type PersistedExpense = Omit<Expense, 'date'> & { date?: unknown };
export type PersistedAppModel = Partial<Omit<AppModel, 'expenses' | 'lastActiveDay' | 'lastActiveMonth'>> & {
  expenses?: PersistedExpense[];
  lastActiveDay?: unknown;
  lastActiveMonth?: unknown;
};

export function normalizeLoadedModel(state: PersistedAppModel | undefined, today = isoDayFromDate(new Date())): AppModel {
  const todayMonth = isoMonthFromDay(today);
  const raw = state ?? {};
  const expenses = (raw.expenses ?? INITIAL_MODEL.expenses).map((expense) => {
    const date = expense.date;
    return {
      ...expense,
      date: typeof date === 'string' && isIsoDay(date) ? date : today,
    };
  });
  const rawLastActiveDay = raw.lastActiveDay;
  const rawLastActiveMonth = raw.lastActiveMonth;
  const rawRolloverUsd = raw.rolloverUsd;
  const lastActiveDay = typeof rawLastActiveDay === 'string' && isIsoDay(rawLastActiveDay) ? rawLastActiveDay : today;
  const lastActiveMonth = typeof rawLastActiveMonth === 'string' && isIsoMonth(rawLastActiveMonth) ? rawLastActiveMonth : todayMonth;
  let next: AppModel = {
    ...INITIAL_MODEL,
    ...raw,
    custom: { ...INITIAL_MODEL.custom, ...(raw.custom ?? {}) },
    categories: raw.categories ?? INITIAL_MODEL.categories,
    expenses,
    goals: raw.goals ?? INITIAL_MODEL.goals,
    ious: raw.ious ?? INITIAL_MODEL.ious,
    history: (raw.history ?? INITIAL_MODEL.history).filter(Number.isFinite).slice(-35),
    rolloverUsd: typeof rawRolloverUsd === 'number' && Number.isFinite(rawRolloverUsd) ? rawRolloverUsd : 0,
    paidBills: raw.paidBills ?? {},
    lastActiveDay,
    lastActiveMonth,
  };

  const rollover = applyDateRollover({
    today,
    lastActiveDay: next.lastActiveDay,
    lastActiveMonth: next.lastActiveMonth,
    expenses: next.expenses,
    history: next.history,
    categories: next.categories,
    paidBills: next.paidBills,
    swept: next.swept,
    khrPerUsd: next.rate,
  });
  const elapsedDays = elapsedIsoDays(lastActiveDay, today);
  const priorLeftUsd = rollover.dailyRolledOver && !rollover.monthlyRolledOver
    ? rolloverUsdAfterElapsedDays(next, elapsedDays)
    : next.rolloverUsd;

  next = {
    ...next,
    history: rollover.history,
    categories: rollover.categories,
    paidBills: rollover.paidBills,
    swept: rollover.swept ?? next.swept,
    rolloverUsd: rollover.monthlyRolledOver ? 0 : priorLeftUsd,
    lastActiveDay: rollover.lastActiveDay,
    lastActiveMonth: rollover.lastActiveMonth,
  };

  return next;
}
