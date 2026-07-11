import { describe, expect, it } from 'vitest';
import type { Expense, RecurringPayment } from '../src/app/types';
import { filterTransactions } from '../src/domain/transactionFilters';
import { normalizeDueDay, recurringPaidBillKey, upcomingRecurringPayments } from '../src/domain/recurring';

const categories = [
  { key: 'food', label: 'Food & drinks' },
  { key: 'ent', label: 'Entertainment' },
];

const transactions: Expense[] = [
  { id: 'tx-1', name: 'Netflix', cat: 'ent', amount: 9.99, cur: 'USD', time: '20:00', date: '2026-07-05', kind: 'expense', note: 'family plan' },
  { id: 'tx-2', name: 'Salary', cat: 'income', amount: 1200, cur: 'USD', time: '09:00', date: '2026-07-05', kind: 'income', note: 'payday' },
  { id: 'tx-3', name: 'Noodles', cat: 'food', amount: 12000, cur: 'KHR', time: '12:10', date: '2026-08-01', kind: 'expense' },
];

describe('local transaction filters', () => {
  it('matches transaction name, note, category label, and type text locally', () => {
    expect(filterTransactions(transactions, { text: 'net', categories }).map((transaction) => transaction.id)).toEqual(['tx-1']);
    expect(filterTransactions(transactions, { text: 'payday', categories }).map((transaction) => transaction.id)).toEqual(['tx-2']);
    expect(filterTransactions(transactions, { text: 'food', categories }).map((transaction) => transaction.id)).toEqual(['tx-3']);
    expect(filterTransactions(transactions, { text: 'income', categories }).map((transaction) => transaction.id)).toEqual(['tx-2']);
    expect(filterTransactions(transactions, { text: 'outcome', categories }).map((transaction) => transaction.id)).toEqual(['tx-1', 'tx-3']);
  });

  it('combines type, category, and month filters', () => {
    expect(filterTransactions(transactions, { kind: 'expense', month: '2026-07', categories }).map((transaction) => transaction.id)).toEqual(['tx-1']);
    expect(filterTransactions(transactions, { categoryKey: 'income', month: '2026-07', categories }).map((transaction) => transaction.id)).toEqual(['tx-2']);
    expect(filterTransactions(transactions, { categoryKey: 'food', month: '2026-07', categories })).toEqual([]);
  });
});

describe('recurring payment helpers', () => {
  it('normalizes due days into the monthly calendar range', () => {
    expect(normalizeDueDay(0)).toBe(1);
    expect(normalizeDueDay(5.8)).toBe(5);
    expect(normalizeDueDay(40)).toBe(31);
  });

  it('returns unpaid recurring payments in due-day order', () => {
    const payments: RecurringPayment[] = [
      { id: 'gym', name: 'Gym', amount: 20, cur: 'USD', dueDay: 20 },
      { id: 'music', name: 'Music', amount: 5, cur: 'USD', dueDay: 5 },
      { id: 'empty', name: '', amount: 10, cur: 'USD', dueDay: 1 },
    ];

    expect(upcomingRecurringPayments(payments, { [recurringPaidBillKey('gym')]: true }).map((payment) => payment.id)).toEqual(['music']);
    expect(upcomingRecurringPayments(payments, {}, false)).toEqual([]);
  });
});
