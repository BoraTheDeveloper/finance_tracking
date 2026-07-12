export type HeatCell = Readonly<{
  index: number;
  spentUsdCents: number;
  label: string;
  status: "none" | "saved-high" | "saved" | "near" | "over" | "over-high";
}>;

export function buildHeatmap(
  historyUsd: readonly number[],
  dailyBudgetUsd: number,
): HeatCell[] {
  return historyUsd.slice(-35).map((spent, index) => {
    const ratio = dailyBudgetUsd <= 0 ? 0 : spent / dailyBudgetUsd;
    return {
      index,
      spentUsdCents: Math.round(spent * 100),
      label: index === historyUsd.length - 1 ? "Today" : `Day ${index + 1}`,
      status:
        spent === 0
          ? "none"
          : ratio <= 0.5
            ? "saved-high"
            : ratio <= 0.85
              ? "saved"
              : ratio <= 1
                ? "near"
                : ratio <= 1.3
                  ? "over"
                  : "over-high",
    };
  });
}

export function bestAndWorst(
  historyUsd: readonly number[],
  dailyBudgetUsd: number,
) {
  let spentMost = -1;
  let savedMost = -1;
  historyUsd.forEach((spent, index) => {
    if (spent > 0 && (spentMost < 0 || spent > historyUsd[spentMost]))
      spentMost = index;
    if (
      spent > 0 &&
      (savedMost < 0 ||
        dailyBudgetUsd - spent > dailyBudgetUsd - historyUsd[savedMost])
    )
      savedMost = index;
  });
  return { spentMost, savedMost };
}
