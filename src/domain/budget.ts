import { ExchangeRate, Money, convertMoney, money, percent, toUsdCents } from './money';

export type BudgetMethod = Readonly<{
  key: 'balanced' | 'saver';
  needsPct: number;
  wantsPct: number;
  savePct: number;
}>;

export const BALANCED: BudgetMethod = { key: 'balanced', needsPct: 50, wantsPct: 30, savePct: 20 };
export const SAVER: BudgetMethod = { key: 'saver', needsPct: 40, wantsPct: 30, savePct: 30 };

export type CategorySpend = Readonly<{
  key: string;
  spent: Money;
  budget: Money;
}>;

export type BudgetInput = Readonly<{
  salary: Money;
  fixedCosts: readonly Money[];
  savedSoFar: Money;
  categorySpend: readonly CategorySpend[];
  todayExpenses: readonly Money[];
  method: BudgetMethod;
  rate: ExchangeRate;
  daysLeftIncludingToday: number;
  rolloverYesterday: Money;
}>;

export type BudgetSummary = Readonly<{
  salaryUsd: Money;
  fixedUsd: Money;
  savingsTargetUsd: Money;
  spendableMonthUsd: Money;
  spentMonthUsd: Money;
  baseDailyUsd: Money;
  dailyBudgetUsd: Money;
  spentTodayUsd: Money;
  leftTodayUsd: Money;
  tomorrowUsd: Money;
  savedSoFarUsd: Money;
  monthPct: number;
  savingsPct: number;
  ringPct: number;
  status: 'under' | 'close' | 'over';
}>;

export function summarizeBudget(input: BudgetInput): BudgetSummary {
  const daysLeft = Math.max(1, Math.floor(input.daysLeftIncludingToday));
  const salaryUsd = convertMoney(input.salary, 'USD', input.rate);
  const fixedUsd = money(input.fixedCosts.reduce((sum, item) => sum + toUsdCents(item, input.rate), 0), 'USD');
  const savingsTargetUsd = money(Math.round((salaryUsd.amountMinor * input.method.savePct) / 100), 'USD');
  const spendableMonthUsd = money(Math.max(salaryUsd.amountMinor - fixedUsd.amountMinor - savingsTargetUsd.amountMinor, 0), 'USD');
  const spentMonthUsd = money(input.categorySpend.reduce((sum, item) => sum + toUsdCents(item.spent, input.rate), 0), 'USD');
  const remainingMonth = Math.max(spendableMonthUsd.amountMinor - spentMonthUsd.amountMinor, 0);
  const baseDailyUsd = money(Math.round(remainingMonth / daysLeft), 'USD');
  const rolloverUsd = convertMoney(input.rolloverYesterday, 'USD', input.rate);
  const dailyBudgetUsd = money(Math.max(baseDailyUsd.amountMinor + rolloverUsd.amountMinor, 0), 'USD');
  const spentTodayUsd = money(input.todayExpenses.reduce((sum, item) => sum + toUsdCents(item, input.rate), 0), 'USD');
  const leftTodayUsd = money(dailyBudgetUsd.amountMinor - spentTodayUsd.amountMinor, 'USD');
  const tomorrowBase = Math.round(Math.max(spendableMonthUsd.amountMinor - spentMonthUsd.amountMinor, 0) / Math.max(daysLeft - 1, 1));
  const tomorrowUsd = money(Math.max(tomorrowBase + leftTodayUsd.amountMinor, 0), 'USD');
  const savedSoFarUsd = convertMoney(input.savedSoFar, 'USD', input.rate);
  const ringPct = dailyBudgetUsd.amountMinor <= 0 ? 0 : Math.max(0, Math.min(1, leftTodayUsd.amountMinor / dailyBudgetUsd.amountMinor));

  return {
    salaryUsd,
    fixedUsd,
    savingsTargetUsd,
    spendableMonthUsd,
    spentMonthUsd,
    baseDailyUsd,
    dailyBudgetUsd,
    spentTodayUsd,
    leftTodayUsd,
    tomorrowUsd,
    savedSoFarUsd,
    monthPct: percent(spentMonthUsd.amountMinor, spendableMonthUsd.amountMinor),
    savingsPct: percent(savedSoFarUsd.amountMinor, savingsTargetUsd.amountMinor),
    ringPct,
    status: leftTodayUsd.amountMinor < -50 ? 'over' : ringPct < 0.25 ? 'close' : 'under',
  };
}
