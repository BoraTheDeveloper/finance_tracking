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

export const WELCOME_ONBOARDING_STEP = 0;
export const FIRST_SETUP_ONBOARDING_STEP = 1;
export const LAST_SETUP_ONBOARDING_STEP = 3;

export function normalizeOnboardingStep(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return WELCOME_ONBOARDING_STEP;
  if (value < WELCOME_ONBOARDING_STEP) return WELCOME_ONBOARDING_STEP;
  if (value > LAST_SETUP_ONBOARDING_STEP) return LAST_SETUP_ONBOARDING_STEP;
  return value;
}

export function normalizeLoadedModel(state: PersistedAppModel | undefined, today = isoDayFromDate(new Date())): AppModel {
  const todayMonth = isoMonthFromDay(today);
  const raw = state ?? {};
  const expenses = (raw.expenses ?? INITIAL_MODEL.expenses).map((expense) => {
    const date = expense.date;
    const kind = expense.kind === 'income' ? 'income' as const : 'expense' as const;
    return {
      ...expense,
      cat: kind === 'income' ? expense.cat || 'income' : expense.cat,
      kind,
      date: typeof date === 'string' && isIsoDay(date) ? date : today,
    };
  });
  const rawLastActiveDay = raw.lastActiveDay;
  const rawLastActiveMonth = raw.lastActiveMonth;
  const rawRolloverUsd = raw.rolloverUsd;
  const rawRate = raw.rate;
  const rawExchangeRateLastFetchedDay = raw.exchangeRateLastFetchedDay;
  const rawExchangeRateSource = raw.exchangeRateSource;
  const rawCategories = raw.categories;
  const rate = typeof rawRate === 'number' && Number.isFinite(rawRate) && rawRate > 0 ? rawRate : INITIAL_MODEL.rate;
  const exchangeRateLastFetchedDay = typeof rawExchangeRateLastFetchedDay === 'string' && isIsoDay(rawExchangeRateLastFetchedDay)
    ? rawExchangeRateLastFetchedDay
    : INITIAL_MODEL.exchangeRateLastFetchedDay;
  const exchangeRateSource = typeof rawExchangeRateSource === 'string' && rawExchangeRateSource.trim()
    ? rawExchangeRateSource
    : INITIAL_MODEL.exchangeRateSource;
  const lastActiveDay = typeof rawLastActiveDay === 'string' && isIsoDay(rawLastActiveDay) ? rawLastActiveDay : today;
  const lastActiveMonth = typeof rawLastActiveMonth === 'string' && isIsoMonth(rawLastActiveMonth) ? rawLastActiveMonth : todayMonth;
  const shouldSeedDefaultCategories = raw.defaultCategoriesSeeded !== true && (!rawCategories || rawCategories.length === 0);
  let next: AppModel = {
    ...INITIAL_MODEL,
    ...raw,
    custom: { ...INITIAL_MODEL.custom, ...(raw.custom ?? {}) },
    defaultCategoriesSeeded: true,
    categories: shouldSeedDefaultCategories ? INITIAL_MODEL.categories : rawCategories ?? INITIAL_MODEL.categories,
    expenses,
    goals: raw.goals ?? INITIAL_MODEL.goals,
    ious: raw.ious ?? INITIAL_MODEL.ious,
    history: (raw.history ?? INITIAL_MODEL.history).filter(Number.isFinite).slice(-35),
    rolloverUsd: typeof rawRolloverUsd === 'number' && Number.isFinite(rawRolloverUsd) ? rawRolloverUsd : 0,
    onbStep: normalizeOnboardingStep(raw.onbStep),
    paidBills: raw.paidBills ?? {},
    lastActiveDay,
    lastActiveMonth,
    rate,
    exchangeRateLastFetchedDay,
    exchangeRateSource,
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
