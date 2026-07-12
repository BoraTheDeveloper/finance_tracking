import type { Expense } from "../app/types";

export function transactionKind(transaction: Pick<Expense, "kind">) {
  return transaction.kind === "income" ? "income" : "expense";
}

export function isIncomeTransaction(transaction: Pick<Expense, "kind">) {
  return transactionKind(transaction) === "income";
}

export function isExpenseTransaction(transaction: Pick<Expense, "kind">) {
  return transactionKind(transaction) === "expense";
}
