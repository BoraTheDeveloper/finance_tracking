import { describe, expect, it } from 'vitest';
import type { Expense } from '../src/app/types';
import {
  isDuplicateAbaTransaction,
  parseAbaStatementRows,
  toExpenseFromAbaTransaction,
} from '../src/domain/abaStatement';

const statementRows = [
  ['Account statement for Personal Savings'],
  ['Generated at', 'Jul 09, 2026'],
  ['Date', 'Transaction Details', 'Money In', 'Currency', 'Money Out', 'Currency'],
  [
    'Jul 8, 2026',
    'FUNDS RECEIVED FROM ACME PAYROLL ORIGINAL AMOUNT 1,200.00 USD REF# INC-001',
    '1,200.00',
    'USD',
    '',
    '',
  ],
  [
    'Jul 8, 2026',
    'PURCHASE AT BROWN COFFEE ON 08 Jul 2026 REF# OUT-001',
    '',
    '',
    '4.50',
    'USD',
  ],
  [
    'Jul 9, 2026',
    'PURCHASE AT LUCKY SUPERMARKET ON 09 Jul 2026 ORIGINAL AMOUNT 16,400 KHR REF# OUT-002',
    '',
    '',
    '4.00',
    'USD',
  ],
] as const;

describe('ABA statement imports', () => {
  it('discovers the statement header and maps income, USD purchases, and KHR-original card purchases', () => {
    const result = parseAbaStatementRows(statementRows);

    expect(result.transactions).toEqual([
      {
        id: 'aba-2026-07-08-income-INC-001',
        date: '2026-07-08',
        name: 'From ACME PAYROLL',
        kind: 'income',
        amount: 1200,
        cur: 'USD',
        note: 'ABA import · REF# INC-001 · Original 1,200.00 USD',
        ref: 'INC-001',
      },
      {
        id: 'aba-2026-07-08-expense-OUT-001',
        date: '2026-07-08',
        name: 'BROWN COFFEE',
        kind: 'expense',
        amount: 4.5,
        cur: 'USD',
        note: 'ABA import · REF# OUT-001',
        ref: 'OUT-001',
      },
      {
        id: 'aba-2026-07-09-expense-OUT-002',
        date: '2026-07-09',
        name: 'LUCKY SUPERMARKET',
        kind: 'expense',
        amount: 4,
        cur: 'USD',
        note: 'ABA import · REF# OUT-002 · Original 16,400 KHR',
        ref: 'OUT-002',
      },
    ]);
  });

  it('converts a KHR-original ABA purchase into an expense using the account debit currency and note', () => {
    const khrOriginalPurchase = parseAbaStatementRows(statementRows).transactions[2];

    expect(toExpenseFromAbaTransaction(khrOriginalPurchase, 'food')).toEqual({
      id: 'aba-2026-07-09-expense-OUT-002',
      name: 'LUCKY SUPERMARKET',
      cat: 'food',
      amount: 4,
      cur: 'USD',
      time: 'imported',
      date: '2026-07-09',
      kind: 'expense',
      note: 'ABA import · REF# OUT-002 · Original 16,400 KHR',
    });
  });

  it('treats a matching ABA REF# as a duplicate even when other imported fields differ', () => {
    const transaction = parseAbaStatementRows(statementRows).transactions[1];
    const existing: Expense[] = [
      {
        id: 'manual-out-001',
        name: 'Renamed merchant',
        cat: 'food',
        amount: 99,
        cur: 'KHR',
        time: '12:00',
        date: '2026-07-01',
        kind: 'expense',
        note: 'Imported earlier · REF# OUT-001',
      },
    ];

    expect(isDuplicateAbaTransaction(existing, transaction)).toBe(true);
  });

  it('treats a manual expense with the same posted ABA amount as a duplicate without requiring REF# or matching name', () => {
    const transaction = parseAbaStatementRows(statementRows).transactions[1];
    const existing: Expense[] = [
      {
        id: 'manual-coffee',
        name: 'Coffee cash note',
        cat: 'food',
        amount: 4.5,
        cur: 'USD',
        time: '08:30',
        date: '2026-07-08',
        kind: 'expense',
        note: 'Tracked manually before importing the statement',
      },
    ];

    expect(isDuplicateAbaTransaction(existing, transaction)).toBe(true);
  });

  it('rejects rows without the ABA statement header', () => {
    expect(() => parseAbaStatementRows([
      ['Account statement for Personal Savings'],
      ['Date', 'Details', 'Debit', 'Credit'],
    ])).toThrow('ABA statement header was not found');
  });
});
