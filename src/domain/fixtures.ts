import { Money, money } from "./money";

export type Category = Readonly<{
  key: string;
  label: string;
  icon: string;
  color: string;
  spent: Money;
  budget: Money;
}>;

export type Expense = Readonly<{
  id: string;
  name: string;
  categoryKey: string;
  amount: Money;
  occurredAt: string;
  note?: string;
}>;

export const DEFAULT_CATEGORIES: readonly Category[] = [
  {
    key: "food",
    label: "Food",
    icon: "restaurant",
    color: "#ef8b4f",
    spent: money(2350, "USD"),
    budget: money(14000, "USD"),
  },
  {
    key: "ent",
    label: "Entertainment",
    icon: "movie",
    color: "#7c5cff",
    spent: money(1500, "USD"),
    budget: money(11000, "USD"),
  },
  {
    key: "transport",
    label: "Transport",
    icon: "directions_bus",
    color: "#3ba6d4",
    spent: money(418, "USD"),
    budget: money(5000, "USD"),
  },
  {
    key: "bills",
    label: "Bills",
    icon: "receipt_long",
    color: "#d98a00",
    spent: money(1700, "USD"),
    budget: money(6000, "USD"),
  },
  {
    key: "shopping",
    label: "Shopping",
    icon: "shopping_bag",
    color: "#e05a8a",
    spent: money(1000, "USD"),
    budget: money(6000, "USD"),
  },
  {
    key: "health",
    label: "Health",
    icon: "medical_services",
    color: "#1f9d6b",
    spent: money(500, "USD"),
    budget: money(4000, "USD"),
  },
  {
    key: "other",
    label: "Other",
    icon: "category",
    color: "#8a8d99",
    spent: money(0, "USD"),
    budget: money(0, "USD"),
  },
];

export const INITIAL_TODAY: readonly Expense[] = [
  {
    id: "seed-phone",
    name: "Phone top-up",
    categoryKey: "bills",
    amount: money(200, "USD"),
    occurredAt: new Date().toISOString(),
  },
  {
    id: "seed-lunch",
    name: "Lunch",
    categoryKey: "food",
    amount: money(300, "USD"),
    occurredAt: new Date().toISOString(),
  },
  {
    id: "seed-bus",
    name: "Bus to work",
    categoryKey: "transport",
    amount: money(4000, "KHR"),
    occurredAt: new Date().toISOString(),
  },
  {
    id: "seed-coffee",
    name: "Morning coffee",
    categoryKey: "food",
    amount: money(250, "USD"),
    occurredAt: new Date().toISOString(),
  },
];

export const HISTORY_USD = [
  12, 8, 0, 17, 22, 9, 14, 6, 19, 11, 0, 25, 7, 13, 10, 8, 16, 21, 5, 0, 12, 9,
  28, 7, 14, 11, 6, 18, 8, 0, 13, 19, 24, 10, 9,
] as const;
