import type { Category, Expense, TransactionKind } from "../app/types";
import { isIsoMonth, isoMonthFromDay } from "./dates";
import { transactionKind } from "./transactions";

export type TransactionFilterKind = TransactionKind | "all";

export type TransactionFilterInput = Readonly<{
  text?: string;
  kind?: TransactionFilterKind;
  categoryKey?: string;
  month?: string;
  categories?: readonly Pick<Category, "key" | "label">[];
}>;

function normalizedSearch(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function categoryLabel(
  categoryKey: string,
  categories: readonly Pick<Category, "key" | "label">[] | undefined,
) {
  if (categoryKey === "income") return "Income";
  return (
    categories?.find((category) => category.key === categoryKey)?.label ??
    categoryKey
  );
}

export function transactionSearchHaystack(
  transaction: Expense,
  categories: readonly Pick<Category, "key" | "label">[] = [],
) {
  const kind = transactionKind(transaction);
  const typeLabel = kind === "income" ? "income" : "outcome expense";
  return [
    transaction.name,
    transaction.note ?? "",
    categoryLabel(transaction.cat, categories),
    typeLabel,
  ]
    .join(" ")
    .toLocaleLowerCase();
}

export function filterTransactions(
  transactions: readonly Expense[],
  filters: TransactionFilterInput,
) {
  const text = normalizedSearch(filters.text);
  const kind = filters.kind ?? "all";
  const categoryKey = filters.categoryKey?.trim() ?? "";
  const month = filters.month?.trim() ?? "";

  if (month && !isIsoMonth(month)) return [];

  return transactions.filter((transaction) => {
    const transactionKindValue = transactionKind(transaction);
    if (kind !== "all" && transactionKindValue !== kind) return false;
    if (month && isoMonthFromDay(transaction.date) !== month) return false;
    if (categoryKey) {
      if (categoryKey === "income") {
        if (transactionKindValue !== "income") return false;
      } else if (transaction.cat !== categoryKey) {
        return false;
      }
    }
    return (
      !text ||
      transactionSearchHaystack(transaction, filters.categories).includes(text)
    );
  });
}
