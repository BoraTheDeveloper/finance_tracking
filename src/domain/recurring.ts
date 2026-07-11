import type { RecurringPayment } from '../app/types';

export function normalizeDueDay(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 1) return 1;
  return Math.min(31, Math.trunc(numericValue));
}

export function recurringPaidBillKey(id: string) {
  return `recurring:${id}`;
}

export function isUpcomingRecurringPayment(payment: RecurringPayment, paidBills: Readonly<Record<string, boolean>>, billReminders = true) {
  return billReminders
    && payment.name.trim().length > 0
    && Number.isFinite(payment.amount)
    && payment.amount > 0
    && !paidBills[recurringPaidBillKey(payment.id)];
}

export function upcomingRecurringPayments(payments: readonly RecurringPayment[], paidBills: Readonly<Record<string, boolean>>, billReminders = true) {
  return payments
    .filter((payment) => isUpcomingRecurringPayment(payment, paidBills, billReminders))
    .slice()
    .sort((left, right) => left.dueDay - right.dueDay || left.name.localeCompare(right.name));
}
