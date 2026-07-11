import { describe, expect, it } from 'vitest';
import { BALANCED, summarizeBudget } from '../src/domain/budget';
import { parseExpenseText } from '../src/domain/expenseParser';
import { DEFAULT_CATEGORIES, INITIAL_TODAY } from '../src/domain/fixtures';
import { INITIAL_MODEL } from '../src/app/initialState';
import { convertMoney, formatMoney, money, parseMoney } from '../src/domain/money';
import { bestAndWorst, buildHeatmap } from '../src/domain/insights';
import { summarizeModelForDay } from '../src/app/budgetSummary';
import { khr as appKhr, usd as appUsd } from '../src/app/formatters';
import { spentUsdForDay, spentUsdForMonth } from '../src/domain/dates';
import { applyQuickAmountChip, buildFastEntryMemory, rememberedFastEntryCategory } from '../src/app/fastEntryMemory';
import { normalizeLoadedModel } from '../src/app/normalizeLoadedModel';

describe('money', () => {
  it('stores USD cents and KHR whole riel', () => {
    expect(parseMoney('10.25', 'USD')).toEqual({ amountMinor: 1025, currency: 'USD' });
    expect(parseMoney('1000', 'KHR')).toEqual({ amountMinor: 1000, currency: 'KHR' });
  });

  it('converts KHR/USD deterministically at 4100', () => {
    expect(convertMoney(money(4000, 'KHR'), 'USD', { khrPerUsd: 4100 })).toEqual(money(98, 'USD'));
    expect(convertMoney(money(1000, 'USD'), 'KHR', { khrPerUsd: 4100 })).toEqual(money(41000, 'KHR'));
  });

  it('rejects non-positive or non-finite exchange rates before conversion', () => {
    expect(() => convertMoney(money(1000, 'KHR'), 'USD', { khrPerUsd: 0 })).toThrow('Exchange rate must be positive');
    expect(() => convertMoney(money(1000, 'KHR'), 'USD', { khrPerUsd: -4100 })).toThrow('Exchange rate must be positive');
    expect(() => convertMoney(money(1000, 'KHR'), 'USD', { khrPerUsd: Number.NaN })).toThrow('Exchange rate must be positive');
  });

  it('formats KHR and USD amounts with exactly two decimal places', () => {
    expect(formatMoney(money(1234, 'KHR'))).toBe('1,234.00៛');
    expect(formatMoney(money(1230, 'USD'))).toBe('$12.30');
  });
});

describe('app money formatters', () => {
  it('rounds KHR display amounts to exactly two decimal places while keeping USD at two decimals', () => {
    expect(appKhr(1234)).toBe('1,234.00៛');
    expect(appKhr(1234.567)).toBe('1,234.57៛');
    expect(appUsd(12.3)).toBe('$12.30');
  });
});

describe('initial model', () => {
  it('seeds popular categories without demo user data', () => {
    expect(INITIAL_MODEL.categories.map((category) => category.key)).toEqual([
      'food',
      'transport',
      'bills',
      'shopping',
      'ent',
      'health',
      'education',
      'family',
      'travel',
      'other',
    ]);
    expect(INITIAL_MODEL.expenses).toEqual([]);
    expect(INITIAL_MODEL.goals).toEqual([]);
    expect(INITIAL_MODEL.ious).toEqual([]);
    expect(INITIAL_MODEL.recurringPayments).toEqual([]);
    expect(INITIAL_MODEL.history).toEqual([]);
  });
});

describe('expense parser', () => {
  it('parses entertainment USD text', () => {
    const parsed = parseExpenseText('netflix, 10$');
    expect(parsed.amount).toEqual(money(1000, 'USD'));
    expect(parsed.categoryKey).toBe('ent');
    expect(parsed.label).toBe('netflix');
  });

  it('parses food KHR text', () => {
    const parsed = parseExpenseText('food, 1000 riels');
    expect(parsed.amount).toEqual(money(1000, 'KHR'));
    expect(parsed.categoryKey).toBe('food');
  });
  it('prefers the comma amount so numbered merchant names stay usable with chips', () => {
    const parsed = parseExpenseText('7 eleven, 5$');

    expect(parsed.amount).toEqual(money(500, 'USD'));
    expect(parsed.label).toBe('7 eleven');
  });
});

describe('fast entry helpers', () => {
  const categories = [
    { key: 'food', label: 'Food', icon: 'restaurant', color: '#ef8b4f', spentUsd: 0, budgetUsd: 120 },
    { key: 'transport', label: 'Transport', icon: 'directions-bus', color: '#3ba6d4', spentUsd: 0, budgetUsd: 60 },
  ];

  it('remembers the latest saved expense category by normalized merchant name', () => {
    const memory = buildFastEntryMemory([
      { id: 'new', name: 'Lucky Burger', cat: 'food', amount: 5, cur: 'USD', time: '12:00', date: '2026-07-07', kind: 'expense' },
      { id: 'old', name: 'Lucky Burger', cat: 'transport', amount: 4, cur: 'USD', time: '12:00', date: '2026-07-01', kind: 'expense' },
      { id: 'income', name: 'Lucky Burger', cat: 'income', amount: 100, cur: 'USD', time: '12:00', date: '2026-07-08', kind: 'income' },
    ], categories);

    expect(rememberedFastEntryCategory('lucky burger', memory, categories)).toBe('food');
  });

  it('rebuilds local memory for restored legacy models from saved expenses', () => {
    const normalized = normalizeLoadedModel({
      categories,
      expenses: [
        { id: 'coffee', name: 'Brown Coffee', cat: 'food', amount: 3, cur: 'USD', time: '08:00', date: '2026-07-07', kind: 'expense' },
      ],
    }, '2026-07-08');

    expect(rememberedFastEntryCategory('brown coffee', normalized.fastEntryMemory, normalized.categories)).toBe('food');
  });

  it('appends and replaces quick chip amounts as parseable transaction text', () => {
    expect(parseExpenseText(applyQuickAmountChip('coffee', '5$')).amount).toEqual(money(500, 'USD'));
    expect(parseExpenseText(applyQuickAmountChip('coffee, 2$', '5000 riels')).amount).toEqual(money(5000, 'KHR'));
  });

});

describe('budget summary', () => {
  it('matches prototype fixture-level math', () => {
    const summary = summarizeBudget({
      salary: money(120000, 'USD'),
      fixedCosts: [money(35000, 'USD'), money(3500, 'USD'), money(15000, 'USD')],
      savedSoFar: money(23200, 'USD'),
      categorySpend: DEFAULT_CATEGORIES,
      todayExpenses: INITIAL_TODAY.map((expense) => expense.amount),
      method: BALANCED,
      rate: { khrPerUsd: 4100 },
      daysLeftIncludingToday: 27,
      rolloverYesterday: money(700, 'USD'),
    });

    expect(formatMoney(summary.spendableMonthUsd)).toBe('$425.00');
    expect(formatMoney(summary.savingsTargetUsd)).toBe('$240.00');
    expect(formatMoney(summary.spentMonthUsd)).toBe('$74.68');
    expect(formatMoney(summary.baseDailyUsd)).toBe('$12.97');
    expect(formatMoney(summary.dailyBudgetUsd)).toBe('$19.97');
    expect(formatMoney(summary.spentTodayUsd)).toBe('$8.48');
    expect(formatMoney(summary.leftTodayUsd)).toBe('$11.49');
  });
});

describe('income transaction totals', () => {
  it('excludes income transactions from day and month spend totals while keeping legacy transactions spendable', () => {
    const transactions = [
      { id: 'legacy-lunch', date: '2026-07-05', amount: 6, cur: 'USD' as const },
      { id: 'bus', date: '2026-07-05', amount: 4000, cur: 'KHR' as const, kind: 'expense' as const },
      { id: 'cash-gift', date: '2026-07-05', amount: 20, cur: 'USD' as const, kind: 'income' as const },
      { id: 'bonus', date: '2026-07-06', amount: 12, cur: 'USD' as const, kind: 'income' as const },
    ];

    expect(spentUsdForDay(transactions, '2026-07-05', 4000)).toBe(7);
    expect(spentUsdForMonth(transactions, '2026-07', 4000)).toBe(7);
  });

  it('adds monthly income to spendable budget without counting it as today spend', () => {
    const summary = summarizeModelForDay({
      ...INITIAL_MODEL,
      salary: 1000,
      salaryCur: 'USD',
      rate: 4000,
      rent: 100,
      utilities: 50,
      loan: 0,
      method: 'balanced',
      categories: [
        { key: 'food', label: 'Food', icon: 'restaurant', color: '#ef8b4f', spentUsd: 0, budgetUsd: 500 },
      ],
      expenses: [
        {
          id: 'legacy-lunch',
          name: 'Lunch',
          cat: 'food',
          amount: 10,
          cur: 'USD',
          time: '12:00',
          date: '2026-07-10',
        },
        {
          id: 'bus',
          name: 'Bus',
          cat: 'food',
          amount: 8000,
          cur: 'KHR',
          time: '13:00',
          date: '2026-07-10',
          kind: 'expense',
        },
        {
          id: 'cash-gift',
          name: 'Cash gift',
          cat: 'income',
          amount: 100,
          cur: 'USD',
          time: '09:00',
          date: '2026-07-10',
          kind: 'income',
        },
        {
          id: 'bonus',
          name: 'Bonus',
          cat: 'income',
          amount: 40000,
          cur: 'KHR',
          time: '09:00',
          date: '2026-07-06',
          kind: 'income',
        },
      ],
    }, '2026-07-10', 5);

    expect(summary.salaryUsd).toEqual(money(111000, 'USD'));
    expect(summary.savingsTargetUsd).toEqual(money(22200, 'USD'));
    expect(summary.spendableMonthUsd).toEqual(money(73800, 'USD'));
    expect(summary.spentMonthUsd).toEqual(money(1200, 'USD'));
    expect(summary.spentTodayUsd).toEqual(money(1200, 'USD'));
    expect(summary.dailyBudgetUsd).toEqual(money(3800, 'USD'));
  });

  it('uses the active payday budget cycle for income, spending, and days left', () => {
    const summary = summarizeModelForDay({
      ...INITIAL_MODEL,
      budgetCycleStartDay: 5,
      salary: 1000,
      salaryCur: 'USD',
      rate: 4000,
      rent: 0,
      utilities: 0,
      loan: 0,
      method: 'balanced',
      categories: [
        { key: 'food', label: 'Food', icon: 'restaurant', color: '#ef8b4f', spentUsd: 0, budgetUsd: 500 },
      ],
      expenses: [
        { id: 'before-cycle', name: 'Before', cat: 'food', amount: 99, cur: 'USD', time: '09:00', date: '2026-07-04', kind: 'expense' },
        { id: 'cycle-start', name: 'Start', cat: 'food', amount: 10, cur: 'USD', time: '09:00', date: '2026-07-05', kind: 'expense' },
        { id: 'cycle-income', name: 'Bonus', cat: 'income', amount: 100, cur: 'USD', time: '09:00', date: '2026-08-01', kind: 'income' },
        { id: 'cycle-end', name: 'End', cat: 'food', amount: 20, cur: 'USD', time: '09:00', date: '2026-08-04', kind: 'expense' },
        { id: 'next-cycle', name: 'Next', cat: 'food', amount: 77, cur: 'USD', time: '09:00', date: '2026-08-05', kind: 'expense' },
      ],
    }, '2026-08-01', 0);

    expect(summary.salaryUsd).toEqual(money(110000, 'USD'));
    expect(summary.savingsTargetUsd).toEqual(money(22000, 'USD'));
    expect(summary.spendableMonthUsd).toEqual(money(88000, 'USD'));
    expect(summary.spentMonthUsd).toEqual(money(3000, 'USD'));
    expect(summary.dailyBudgetUsd).toEqual(money(21250, 'USD'));
  });
});

describe('insight heatmap helpers', () => {
  it('classifies no spend, low spend, enough budget, and overspend at thresholds', () => {
    const cells = buildHeatmap([0, 5, 8.5, 10, 13, 13.01], 10);

    expect(cells.map((cell) => cell.status)).toEqual([
      'none',
      'saved-high',
      'saved',
      'near',
      'over',
      'over-high',
    ]);
    expect(cells.map((cell) => cell.spentUsdCents)).toEqual([0, 500, 850, 1000, 1300, 1301]);
  });

  it('keeps insight rankings meaningful when history has empty days', () => {
    expect(bestAndWorst([0, 12, 4, 0, 9], 10)).toEqual({
      spentMost: 1,
      savedMost: 2,
    });
    expect(bestAndWorst([0, 0], 10)).toEqual({
      spentMost: -1,
      savedMost: -1,
    });
  });

  it('uses only the latest 35 days and labels today when the visible history reaches today', () => {
    const longHistory = Array.from({ length: 40 }, (_item, index) => index + 1);
    const longCells = buildHeatmap(longHistory, 100);

    expect(longCells).toHaveLength(35);
    expect(longCells[0]).toMatchObject({ index: 0, spentUsdCents: 600, label: 'Day 1' });
    expect(longCells[34]).toMatchObject({ index: 34, spentUsdCents: 4000 });

    const fullVisibleCells = buildHeatmap(Array.from({ length: 35 }, (_item, index) => index + 1), 100);
    expect(fullVisibleCells[34]).toMatchObject({ index: 34, spentUsdCents: 3500, label: 'Today' });
  });
});
