import type {
  AppModel,
  Currency,
  ExpensePrediction,
  ExpensePredictionSource,
  TransactionKind,
} from "../app/types";
import type { Money } from "./money";
import { rememberedFastEntryCategory } from "../app/fastEntryMemory";
import { inferCategory } from "./expenseParser";
import { categoryFromCorrections } from "./categoryLearning";
import { cleanAbaDescription, cleanFreeTextLabel } from "./expenseLabel";
import {
  predictCategory,
  type CategoryClassifierInput,
  type CategoryKindHint,
  type CategoryPredictionSource,
} from "./categoryClassifier";

export type CategorySuggestionInput = Readonly<{
  rawText: string;
  label: string;
  currency: Currency;
  amount: number;
  kind: TransactionKind;
  kindHint?: CategoryKindHint;
  direction?: "in" | "out";
  sourceType?: "free_text" | "aba_statement";
}>;

export type CategorySuggestion = Readonly<{
  categoryKey: string;
  cleanLabel: string;
  confidence: number;
  source: ExpensePredictionSource;
  prediction: ExpensePrediction;
}>;

function mapClassifierSource(
  source: CategoryPredictionSource,
): ExpensePredictionSource {
  if (source === "keyword") return "keyword";
  if (source === "classifier") return "classifier";
  return "fallback";
}

export function buildClassifierInput(
  input: CategorySuggestionInput,
): CategoryClassifierInput {
  const cleanLabel =
    input.sourceType === "aba_statement"
      ? cleanAbaDescription(input.rawText)
      : cleanFreeTextLabel(input.label || input.rawText);

  return {
    cleanLabel,
    currency: input.currency,
    amount: input.amount,
    direction: input.direction ?? (input.kind === "income" ? "in" : "out"),
    kindHint: input.kindHint ?? "",
  };
}

export function suggestCategory(
  model: AppModel,
  input: CategorySuggestionInput,
): CategorySuggestion {
  if (input.kind === "income") {
    const cleanLabel = cleanFreeTextLabel(input.label || input.rawText);
    return {
      categoryKey: "income",
      cleanLabel,
      confidence: 1,
      source: "fallback",
      prediction: {
        cleanLabel,
        predictedCategoryKey: "income",
        predictionSource: "fallback",
        confidence: 1,
      },
    };
  }

  const classifierInput = buildClassifierInput(input);
  const correction = categoryFromCorrections(
    model.merchantCorrections,
    classifierInput.cleanLabel,
  );
  if (correction) {
    return {
      categoryKey: correction,
      cleanLabel: classifierInput.cleanLabel,
      confidence: 1,
      source: "correction",
      prediction: {
        cleanLabel: classifierInput.cleanLabel,
        predictedCategoryKey: correction,
        predictionSource: "correction",
        confidence: 1,
      },
    };
  }

  // Fast-entry memory is keyed by normalizeFastEntryName(expense.name); recall
  // must feed the same raw label so the key matches (cleanLabel strips
  // weekday/month words that normalizeFastEntryName keeps).
  const fastEntry = rememberedFastEntryCategory(
    input.label || input.rawText,
    model.fastEntryMemory,
    model.categories,
  );
  if (fastEntry) {
    return {
      categoryKey: fastEntry,
      cleanLabel: classifierInput.cleanLabel,
      confidence: 0.9,
      source: "keyword",
      prediction: {
        cleanLabel: classifierInput.cleanLabel,
        predictedCategoryKey: fastEntry,
        predictionSource: "keyword",
        confidence: 0.9,
      },
    };
  }

  const classifier = predictCategory(classifierInput);
  const keywordFallback = inferCategory(input.rawText.toLowerCase());
  const categoryKey =
    classifier.source === "fallback" && keywordFallback !== "other"
      ? keywordFallback
      : classifier.categoryKey;

  const source =
    classifier.source === "fallback" && keywordFallback !== "other"
      ? "keyword"
      : mapClassifierSource(classifier.source);

  return {
    categoryKey,
    cleanLabel: classifier.cleanLabel,
    confidence: classifier.confidence,
    source,
    prediction: {
      cleanLabel: classifier.cleanLabel,
      predictedCategoryKey: categoryKey,
      predictionSource: source,
      confidence: classifier.confidence,
    },
  };
}

export function suggestCategoryForAddText(
  model: AppModel,
  rawText: string,
  parsed: {
    label: string;
    currency: Currency;
    amount: Money | null;
    categoryKey: string;
  },
  kind: TransactionKind,
) {
  const amount =
    parsed.amount == null
      ? 0
      : parsed.currency === "USD"
        ? parsed.amount.amountMinor / 100
        : parsed.amount.amountMinor;

  return suggestCategory(model, {
    rawText,
    label: parsed.label,
    currency: parsed.currency,
    amount,
    kind,
    sourceType: "free_text",
  });
}

export function suggestCategoryForAba(
  model: AppModel,
  transaction: {
    name: string;
    amount: number;
    cur: Currency;
    kind: TransactionKind;
  },
) {
  return suggestCategory(model, {
    rawText: transaction.name,
    label: transaction.name,
    currency: transaction.cur,
    amount: transaction.amount,
    kind: transaction.kind,
    kindHint: transaction.kind === "income" ? "transfer_in" : "purchase",
    direction: transaction.kind === "income" ? "in" : "out",
    sourceType: "aba_statement",
  });
}
