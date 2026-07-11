import { describe, expect, it } from 'vitest';
import {
  appendTrimmedHistory,
  applyDateRollover,
  budgetCycleEndForDay,
  budgetCycleForDay,
  budgetCycleKeyForDay,
  budgetCycleStartForDay,
  daysInIsoMonth,
  daysRemainingInBudgetCycle,
  daysRemainingInMonth,
  elapsedIsoDays,
  filterExpensesByBudgetCycle,
  filterExpensesByDay,
  filterExpensesByMonth,
  isoDayFromDate,
  isoMonthFromDay,
  normalizeBudgetCycleStartDay,
  spentUsdForBudgetCycle,
  spentUsdForDay,
  spentUsdForMonth,
} from '../src/domain/dates';
const expenses = [
  { id: 'old', date: '2026-06-30', amount: 9, cur: 'USD' as const },
  { id: 'breakfast', date: '2026-07-05', amount: 2.5, cur: 'USD' as const },
  { id: 'bus', date: '2026-07-05', amount: 4000, cur: 'KHR' as const },
  { id: 'lunch', date: '2026-07-06', amount: 7, cur: 'USD' as const },
  { id: 'next-month', date: '2026-08-01', amount: 10, cur: 'USD' as const },
  { id: 'legacy-missing-date', amount: 99, cur: 'USD' as const },
] as const;

describe('ISO day and month helpers', () => {
  it('formats Date objects as local ISO days without timestamps', () => {
    expect(isoDayFromDate(new Date(2026, 0, 5, 23, 59, 1))).toBe('2026-01-05');
    expect(isoMonthFromDay('2026-01-05')).toBe('2026-01');
  });

  it('counts days left in the month including today', () => {
    expect(daysInIsoMonth('2024-02')).toBe(29);
    expect(daysRemainingInMonth('2024-02-28')).toBe(2);
    expect(daysRemainingInMonth('2023-02-28')).toBe(1);
    expect(daysRemainingInMonth('2026-07-31')).toBe(1);
    expect(daysRemainingInMonth('2026-07-01')).toBe(31);
  });

  it('computes payday budget cycles that span calendar months', () => {
    expect(normalizeBudgetCycleStartDay(5)).toBe(5);
    expect(normalizeBudgetCycleStartDay(0)).toBe(1);
    expect(budgetCycleStartForDay('2026-07-05', 5)).toBe('2026-07-05');
    expect(budgetCycleEndForDay('2026-07-05', 5)).toBe('2026-08-04');
    expect(budgetCycleStartForDay('2026-08-04', 5)).toBe('2026-07-05');
    expect(budgetCycleEndForDay('2026-08-04', 5)).toBe('2026-08-04');
    expect(budgetCycleKeyForDay('2026-08-04', 5)).toBe('2026-07');
    expect(daysRemainingInBudgetCycle('2026-08-01', 5)).toBe(4);
    expect(budgetCycleForDay('2026-08-05', 5)).toEqual({
      key: '2026-08',
      start: '2026-08-05',
      end: '2026-09-04',
      daysLeftIncludingToday: 31,
    });
  });

  it('lists elapsed rollover days from the last active day up to but not including today', () => {
    expect(elapsedIsoDays('2026-07-01', '2026-07-05')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
    ]);
    expect(elapsedIsoDays('2024-02-28', '2024-03-02')).toEqual(['2024-02-28', '2024-02-29', '2024-03-01']);
    expect(elapsedIsoDays('2026-07-05', '2026-07-05')).toEqual([]);
    expect(elapsedIsoDays('2026-07-06', '2026-07-05')).toEqual([]);
  });

  it('rejects impossible calendar dates', () => {
    expect(() => daysRemainingInMonth('2026-02-29')).toThrow('ISO day');
    expect(() => daysInIsoMonth('2026-13')).toThrow('ISO month');
  });
});

describe('expense date filtering and totals', () => {
  it('filters expenses by exact day and selected month', () => {
    expect(filterExpensesByDay(expenses, '2026-07-05').map((expense) => expense.id)).toEqual(['breakfast', 'bus']);
    expect(filterExpensesByMonth(expenses, '2026-07').map((expense) => expense.id)).toEqual(['breakfast', 'bus', 'lunch']);
  });

  it('filters and totals expenses in the budget cycle containing a day', () => {
    expect(filterExpensesByBudgetCycle(expenses, '2026-08-01', 5).map((expense) => expense.id)).toEqual(['breakfast', 'bus', 'lunch', 'next-month']);
    expect(spentUsdForBudgetCycle(expenses, '2026-08-01', 5, 4000)).toBe(20.5);
  });

  it('sums dated USD and KHR expenses for daily and monthly views', () => {
    expect(spentUsdForDay(expenses, '2026-07-05', 4000)).toBe(3.5);
    expect(spentUsdForMonth(expenses, '2026-07', 4000)).toBe(10.5);
  });
});

describe('daily and monthly rollover', () => {
  it('appends the prior active day total and trims history to the configured window', () => {
    const history = Array.from({ length: 35 }, (_, index) => index + 1);

    const result = applyDateRollover({
      today: '2026-07-06',
      lastActiveDay: '2026-07-05',
      lastActiveMonth: '2026-07',
      expenses,
      history,
      categories: [{ key: 'food', spentUsd: 12, swept: true }],
      paidBills: { rent: true },
      swept: true,
      khrPerUsd: 4000,
    });

    expect(result.dailyRolledOver).toBe(true);
    expect(result.monthlyRolledOver).toBe(false);
    expect(result.previousActiveDaySpentUsd).toBe(3.5);
    expect(result.history).toHaveLength(35);
    expect(result.history[0]).toBe(2);
    expect(result.history.at(-1)).toBe(3.5);
    expect(result.categories).toEqual([{ key: 'food', spentUsd: 12, swept: true }]);
    expect(result.paidBills).toEqual({ rent: true });
    expect(result.swept).toBe(true);
    expect(result.lastActiveDay).toBe('2026-07-06');
    expect(result.lastActiveMonth).toBe('2026-07');
  });

  it('fills every skipped inactive day before today with actual spend or zero', () => {
    const result = applyDateRollover({
      today: '2026-07-05',
      lastActiveDay: '2026-07-01',
      lastActiveMonth: '2026-07',
      expenses: [
        { id: 'rent', date: '2026-07-01', amount: 12, cur: 'USD' },
        { id: 'groceries', date: '2026-07-03', amount: 8000, cur: 'KHR' },
        { id: 'today', date: '2026-07-05', amount: 99, cur: 'USD' },
      ],
      history: [30],
      categories: [{ key: 'food', spentUsd: 12, swept: true }],
      paidBills: { rent: true },
      swept: true,
      khrPerUsd: 4000,
    });

    expect(result.dailyRolledOver).toBe(true);
    expect(result.monthlyRolledOver).toBe(false);
    expect(result.previousActiveDaySpentUsd).toBe(12);
    expect(result.history).toEqual([30, 12, 0, 2, 0]);
    expect(result.categories).toEqual([{ key: 'food', spentUsd: 12, swept: true }]);
    expect(result.paidBills).toEqual({ rent: true });
    expect(result.swept).toBe(true);
    expect(result.lastActiveDay).toBe('2026-07-05');
    expect(result.lastActiveMonth).toBe('2026-07');
  });

  it('trims rollover history after appending all skipped inactive days', () => {
    const result = applyDateRollover({
      today: '2026-07-05',
      lastActiveDay: '2026-07-01',
      lastActiveMonth: '2026-07',
      expenses: [
        { id: 'coffee', date: '2026-07-01', amount: 4, cur: 'USD' },
        { id: 'dinner', date: '2026-07-04', amount: 7, cur: 'USD' },
      ],
      history: [1, 2, 3, 4],
      categories: [],
      paidBills: {},
      maxHistoryDays: 5,
    });

    expect(result.history).toEqual([4, 4, 0, 0, 7]);
  });

  it('resets month-scoped state when the active month changes', () => {
    const result = applyDateRollover({
      today: '2026-07-01',
      lastActiveDay: '2026-06-30',
      lastActiveMonth: '2026-06',
      expenses,
      history: [8, 9],
      categories: [
        { key: 'food', spentUsd: 12, swept: true },
        { key: 'transport', spentUsd: 4 },
      ],
      paidBills: { rent: true, loan: true },
      swept: true,
    });

    expect(result.dailyRolledOver).toBe(true);
    expect(result.monthlyRolledOver).toBe(true);
    expect(result.previousActiveDaySpentUsd).toBe(9);
    expect(result.history).toEqual([8, 9, 9]);
    expect(result.categories).toEqual([
      { key: 'food', spentUsd: 0, swept: false },
      { key: 'transport', spentUsd: 0 },
    ]);
    expect(result.paidBills).toEqual({});
    expect(result.swept).toBe(false);
    expect(result.lastActiveMonth).toBe('2026-07');
  });

  it('resets month-scoped state on a payday cycle boundary instead of calendar month', () => {
    const carried = applyDateRollover({
      today: '2026-08-01',
      lastActiveDay: '2026-07-31',
      lastActiveMonth: '2026-07',
      budgetCycleStartDay: 5,
      expenses,
      history: [],
      categories: [{ key: 'food', spentUsd: 12, swept: true }],
      paidBills: { rent: true },
      swept: true,
    });
    expect(carried.monthlyRolledOver).toBe(false);
    expect(carried.lastActiveMonth).toBe('2026-07');
    expect(carried.categories).toEqual([{ key: 'food', spentUsd: 12, swept: true }]);

    const reset = applyDateRollover({
      today: '2026-08-05',
      lastActiveDay: '2026-08-04',
      lastActiveMonth: '2026-07',
      budgetCycleStartDay: 5,
      expenses,
      history: [],
      categories: [{ key: 'food', spentUsd: 12, swept: true }],
      paidBills: { rent: true },
      swept: true,
    });
    expect(reset.monthlyRolledOver).toBe(true);
    expect(reset.lastActiveMonth).toBe('2026-08');
    expect(reset.categories).toEqual([{ key: 'food', spentUsd: 0, swept: false }]);
    expect(reset.paidBills).toEqual({});
  });

  it('treats missing legacy activity markers as safe first launch state', () => {
    const result = applyDateRollover({
      today: '2026-07-06',
      expenses,
      history: [1, 2],
      categories: [{ key: 'food', spentUsd: 12, swept: true }],
      paidBills: { rent: true },
      swept: true,
    });

    expect(result.dailyRolledOver).toBe(false);
    expect(result.monthlyRolledOver).toBe(false);
    expect(result.previousActiveDaySpentUsd).toBe(0);
    expect(result.history).toEqual([1, 2]);
    expect(result.categories).toEqual([{ key: 'food', spentUsd: 12, swept: true }]);
    expect(result.paidBills).toEqual({ rent: true });
    expect(result.swept).toBe(true);
    expect(result.lastActiveDay).toBe('2026-07-06');
    expect(result.lastActiveMonth).toBe('2026-07');
  });

  it('exposes history trimming as a small pure helper', () => {
    expect(appendTrimmedHistory([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });
});
