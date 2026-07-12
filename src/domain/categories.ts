import type { Category } from "../app/types";

export const UNCATEGORIZED_CATEGORY: Category = {
  key: "uncategorized",
  label: "Uncategorized",
  icon: "category",
  color: "#8a8d99",
  spentUsd: 0,
  budgetUsd: 0,
};

export function categoryFor(categories: Category[], key: string) {
  return (
    categories.find((category) => category.key === key) ??
    UNCATEGORIZED_CATEGORY
  );
}
