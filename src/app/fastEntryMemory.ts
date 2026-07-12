import type { AppModel, Currency, Expense, FastEntryMemory } from "./types";
import { isExpenseTransaction } from "../domain/transactions";

export const FAST_ENTRY_MEMORY_LIMIT = 40;

const AMOUNT_AND_CURRENCY_WORDS =
  /(?:[$៛]|\busd\b|\bdollars?\b|\bbucks?\b|\bkhr\b|\briels?\b|\d[\d,]*(?:\.\d+)?)/gi;

export type QuickAmountChip = Readonly<{
  label: string;
  text: string;
  cur: Currency;
}>;

export const QUICK_AMOUNT_CHIPS: readonly QuickAmountChip[] = [
  { label: "$2", text: "2$", cur: "USD" },
  { label: "$5", text: "5$", cur: "USD" },
  { label: "$10", text: "10$", cur: "USD" },
  { label: "៛2,000", text: "2000 riels", cur: "KHR" },
  { label: "៛5,000", text: "5000 riels", cur: "KHR" },
  { label: "៛10,000", text: "10000 riels", cur: "KHR" },
];

export function applyQuickAmountChip(addText: string, chipText: string) {
  const text = addText.trim();
  if (!text) return chipText;

  const commaParts = text.split(",");
  const trailingPart = commaParts[commaParts.length - 1] ?? "";
  if (commaParts.length > 1 && /\d/.test(trailingPart)) {
    const merchantText = commaParts.slice(0, -1).join(",").trim();
    return merchantText ? `${merchantText}, ${chipText}` : chipText;
  }

  return `${text}${text.endsWith(",") ? " " : ", "}${chipText}`;
}

export function normalizeFastEntryName(name: string) {
  return name
    .toLowerCase()
    .replace(AMOUNT_AND_CURRENCY_WORDS, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function buildFastEntryMemory(
  expenses: readonly Expense[],
  categories: AppModel["categories"],
): FastEntryMemory {
  const memory: FastEntryMemory = {};
  let memorySize = 0;

  for (const expense of expenses) {
    if (
      !isExpenseTransaction(expense) ||
      !categories.some((category) => category.key === expense.cat)
    )
      continue;
    const key = normalizeFastEntryName(expense.name);
    if (!key || memory[key]) continue;

    memory[key] = { cat: expense.cat, lastUsed: expense.date };
    memorySize += 1;
    if (memorySize >= FAST_ENTRY_MEMORY_LIMIT) break;
  }

  return memory;
}

export function rememberedFastEntryCategory(
  name: string,
  memory: FastEntryMemory,
  categories: AppModel["categories"],
) {
  const key = normalizeFastEntryName(name);
  const remembered = key ? memory[key] : undefined;
  if (
    !remembered ||
    !categories.some((category) => category.key === remembered.cat)
  )
    return null;
  return remembered.cat;
}
