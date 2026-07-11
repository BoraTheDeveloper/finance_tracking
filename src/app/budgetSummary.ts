import type { AppModel } from '../app/types';
import { BALANCED, SAVER, summarizeBudget } from '../domain/budget';
import { daysRemainingInBudgetCycle, filterExpensesByBudgetCycle, filterExpensesByDay } from '../domain/dates';
import { money } from '../domain/money';
import { amountUsd } from './formatters';
import { isExpenseTransaction, isIncomeTransaction } from '../domain/transactions';

export function summarizeModelForDay(model: AppModel, day: string, rolloverUsd: number) {
  const cycleTransactions = filterExpensesByBudgetCycle(model.expenses, day, model.budgetCycleStartDay);
  const monthExpenses = cycleTransactions.filter(isExpenseTransaction);
  const monthIncomeUsd = cycleTransactions.filter(isIncomeTransaction).reduce((sum, transaction) => sum + amountUsd(transaction.amount, transaction.cur, model.rate), 0);
  const monthSpendByCategory = new Map<string, number>();
  monthExpenses.forEach((expense) => {
    monthSpendByCategory.set(expense.cat, (monthSpendByCategory.get(expense.cat) ?? 0) + amountUsd(expense.amount, expense.cur, model.rate));
  });
  const method = model.method === 'custom'
    ? { key: 'custom' as const, needsPct: model.custom.needs, wantsPct: model.custom.wants, savePct: model.custom.save }
    : model.method === 'balanced' ? BALANCED : SAVER;

  return summarizeBudget({
    salary: money(Math.round((amountUsd(model.salary, model.salaryCur, model.rate) + monthIncomeUsd) * 100), 'USD'),
    fixedCosts: [money(Math.round(model.rent * 100), 'USD'), money(Math.round(model.utilities * 100), 'USD'), money(Math.round(model.loan * 100), 'USD')],
    savedSoFar: money(Math.round(model.goals.reduce((sum, goal) => sum + amountUsd(goal.saved, goal.cur, model.rate), 0) * 100), 'USD'),
    categorySpend: model.categories.map((category) => ({
      key: category.key,
      spent: money(Math.round((monthSpendByCategory.get(category.key) ?? 0) * 100), 'USD' as const),
      budget: money(Math.round(category.budgetUsd * 100), 'USD' as const),
    })),
    todayExpenses: filterExpensesByDay(model.expenses, day).filter(isExpenseTransaction).map((expense) => money(expense.cur === 'USD' ? Math.round(expense.amount * 100) : Math.round(expense.amount), expense.cur)),
    method,
    rate: { khrPerUsd: model.rate },
    daysLeftIncludingToday: daysRemainingInBudgetCycle(day, model.budgetCycleStartDay),
    rolloverYesterday: money(Math.round(rolloverUsd * 100), 'USD'),
  });
}

export function rolloverUsdAfterElapsedDays(model: AppModel, elapsedDays: readonly string[]) {
  let rolloverUsd = model.rolloverUsd;
  elapsedDays.forEach((day) => {
    const dayBudget = summarizeModelForDay(model, day, rolloverUsd);
    rolloverUsd = Math.max(0, dayBudget.leftTodayUsd.amountMinor / 100);
  });
  return rolloverUsd;
}
