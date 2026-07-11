import type { AppModel, Expense, RecurringPayment } from './types';
import { INITIAL_MODEL } from './initialState';
import { isLanguage } from './i18n';
import { rolloverUsdAfterElapsedDays } from './budgetSummary';
import { buildFastEntryMemory } from './fastEntryMemory';
import { normalizeDueDay } from '../domain/recurring';
import {
  applyDateRollover,
  budgetCycleKeyForDay,
  elapsedIsoDays,
  isIsoDay,
  isIsoMonth,
  isoDayFromDate,
  normalizeBudgetCycleStartDay,
} from '../domain/dates';

export type PersistedExpense = Omit<Expense, 'date'> & { date?: unknown };
export type PersistedRecurringPayment = Omit<RecurringPayment, 'amount' | 'cur' | 'dueDay'> & {
  amount?: unknown;
  cur?: unknown;
  dueDay?: unknown;
};
export type PersistedAppModel = Partial<Omit<AppModel, 'expenses' | 'recurringPayments' | 'lastActiveDay' | 'lastActiveMonth' | 'budgetCycleStartDay' | 'language'>> & {
  expenses?: PersistedExpense[];
  recurringPayments?: PersistedRecurringPayment[];
  lastActiveDay?: unknown;
  lastActiveMonth?: unknown;
  budgetCycleStartDay?: unknown;
  language?: unknown;
};

export const WELCOME_ONBOARDING_STEP = 0;
export const FIRST_SETUP_ONBOARDING_STEP = 1;
export const LAST_SETUP_ONBOARDING_STEP = 3;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeOnboardingStep(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return WELCOME_ONBOARDING_STEP;
  if (value < WELCOME_ONBOARDING_STEP) return WELCOME_ONBOARDING_STEP;
  if (value > LAST_SETUP_ONBOARDING_STEP) return LAST_SETUP_ONBOARDING_STEP;
  return value;
}

export function normalizeLoadedModel(state: PersistedAppModel | undefined, today = isoDayFromDate(new Date())): AppModel {
  const raw = state ?? {};
  const budgetCycleStartDay = normalizeBudgetCycleStartDay(raw.budgetCycleStartDay);
  const todayMonth = budgetCycleKeyForDay(today, budgetCycleStartDay);
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
  const recurringPayments = (raw.recurringPayments ?? INITIAL_MODEL.recurringPayments).map((payment) => {
    const name = typeof payment.name === 'string' ? payment.name.trim() : '';
    const amount = typeof payment.amount === 'number' && Number.isFinite(payment.amount) ? round2(payment.amount) : 0;
    if (!name || amount <= 0) return null;
    return {
      id: typeof payment.id === 'string' && payment.id.trim() ? payment.id : `recurring-${name.toLocaleLowerCase().replace(/\s+/g, '-')}`,
      name,
      amount,
      cur: payment.cur === 'KHR' ? 'KHR' as const : 'USD' as const,
      dueDay: normalizeDueDay(payment.dueDay),
    };
  }).filter((payment): payment is RecurringPayment => payment !== null);
  const rawLastActiveDay = raw.lastActiveDay;
  const rawLastActiveMonth = raw.lastActiveMonth;
  const rawRolloverUsd = raw.rolloverUsd;
  const rawRate = raw.rate;
  const rawExchangeRateLastFetchedDay = raw.exchangeRateLastFetchedDay;
  const rawExchangeRateSource = raw.exchangeRateSource;
  const rawCategories = raw.categories;
  const language = isLanguage(raw.language) ? raw.language : INITIAL_MODEL.language;
  const rate = typeof rawRate === 'number' && Number.isFinite(rawRate) && rawRate > 0 ? round2(rawRate) : INITIAL_MODEL.rate;
  const exchangeRateLastFetchedDay = typeof rawExchangeRateLastFetchedDay === 'string' && isIsoDay(rawExchangeRateLastFetchedDay)
    ? rawExchangeRateLastFetchedDay
    : INITIAL_MODEL.exchangeRateLastFetchedDay;
  const exchangeRateSource = typeof rawExchangeRateSource === 'string' && rawExchangeRateSource.trim()
    ? rawExchangeRateSource
    : INITIAL_MODEL.exchangeRateSource;
  const lastActiveDay = typeof rawLastActiveDay === 'string' && isIsoDay(rawLastActiveDay) ? rawLastActiveDay : today;
  const lastActiveMonth = typeof rawLastActiveMonth === 'string' && isIsoMonth(rawLastActiveMonth) ? rawLastActiveMonth : todayMonth;
  const shouldSeedDefaultCategories = raw.defaultCategoriesSeeded !== true && (!rawCategories || rawCategories.length === 0);
  const categories = shouldSeedDefaultCategories ? INITIAL_MODEL.categories : rawCategories ?? INITIAL_MODEL.categories;
  const fastEntryMemory = buildFastEntryMemory(expenses, categories);
  const merchantCorrections =
    raw.merchantCorrections && typeof raw.merchantCorrections === 'object'
      ? Object.fromEntries(
          Object.entries(raw.merchantCorrections).filter(
            ([key, value]) => typeof key === 'string' && typeof value === 'string',
          ),
        )
      : INITIAL_MODEL.merchantCorrections;
  const categoryTrainingExamples = Array.isArray(raw.categoryTrainingExamples)
    ? raw.categoryTrainingExamples.filter(
        (row): row is AppModel['categoryTrainingExamples'][number] =>
          Boolean(row)
          && typeof row === 'object'
          && typeof row.id === 'string'
          && typeof row.rawText === 'string'
          && typeof row.cleanLabel === 'string'
          && typeof row.categoryKey === 'string'
          && typeof row.corrected === 'boolean'
          && typeof row.createdAtDay === 'string',
      )
    : INITIAL_MODEL.categoryTrainingExamples;
  const categoryModelVersion =
    typeof raw.categoryModelVersion === 'string' ? raw.categoryModelVersion : INITIAL_MODEL.categoryModelVersion;
  let next: AppModel = {
    ...INITIAL_MODEL,
    ...raw,
    custom: { ...INITIAL_MODEL.custom, ...(raw.custom ?? {}) },
    defaultCategoriesSeeded: true,
    categories,
    expenses,
    goals: raw.goals ?? INITIAL_MODEL.goals,
    ious: raw.ious ?? INITIAL_MODEL.ious,
    recurringPayments,
    history: (raw.history ?? INITIAL_MODEL.history).filter(Number.isFinite).slice(-35),
    rolloverUsd: typeof rawRolloverUsd === 'number' && Number.isFinite(rawRolloverUsd) ? rawRolloverUsd : 0,
    onbStep: normalizeOnboardingStep(raw.onbStep),
    paidBills: raw.paidBills ?? {},
    fastEntryMemory,
    lastActiveDay,
    lastActiveMonth,
    budgetCycleStartDay,
    rate,
    exchangeRateLastFetchedDay,
    exchangeRateSource,
    language,
    merchantCorrections,
    categoryTrainingExamples,
    categoryModelVersion,
  };

  const rollover = applyDateRollover({
    today,
    lastActiveDay: next.lastActiveDay,
    lastActiveMonth: next.lastActiveMonth,
    budgetCycleStartDay: next.budgetCycleStartDay,
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
