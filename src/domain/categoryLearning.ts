import type {
  AppModel,
  CategoryTrainingExample,
  Expense,
  ExpensePrediction,
} from "../app/types";
import { correctionKeyFromCleanLabel } from "./expenseLabel";
import { WEIGHTS } from "./categoryClassifierWeights";

export const MAX_CATEGORY_TRAINING_EXAMPLES = 1000;

export function emptyCategoryLearningState(): Pick<
  AppModel,
  "merchantCorrections" | "categoryTrainingExamples" | "categoryModelVersion"
> {
  return {
    merchantCorrections: {},
    categoryTrainingExamples: [],
    categoryModelVersion: WEIGHTS.version,
  };
}

function trimTrainingExamples(examples: CategoryTrainingExample[]) {
  if (examples.length <= MAX_CATEGORY_TRAINING_EXAMPLES) return examples;
  return examples.slice(examples.length - MAX_CATEGORY_TRAINING_EXAMPLES);
}

// A monotonic suffix guarantees uniqueness even when many examples are created
// within the same millisecond (e.g. a bulk ABA import loop), where Date.now()
// alone would collide.
let trainingExampleSeq = 0;
function nextTrainingExampleId() {
  trainingExampleSeq += 1;
  return `train-${Date.now()}-${trainingExampleSeq}`;
}

export function rememberMerchantCorrection(
  corrections: AppModel["merchantCorrections"],
  cleanLabel: string,
  categoryKey: string,
) {
  const key = correctionKeyFromCleanLabel(cleanLabel);
  if (!key) return corrections;
  return { ...corrections, [key]: categoryKey };
}

export function categoryFromCorrections(
  corrections: AppModel["merchantCorrections"],
  cleanLabel: string,
) {
  const key = correctionKeyFromCleanLabel(cleanLabel);
  return key ? corrections[key] : undefined;
}

export function appendTrainingExample(
  examples: CategoryTrainingExample[],
  example: CategoryTrainingExample,
) {
  return trimTrainingExamples([...examples, example]);
}

export function appendTrainingExamples(
  examples: CategoryTrainingExample[],
  additions: readonly CategoryTrainingExample[],
) {
  if (additions.length === 0) return examples;
  return trimTrainingExamples([...examples, ...additions]);
}

export function buildTrainingExample(input: {
  id: string;
  rawText: string;
  cleanLabel: string;
  categoryKey: string;
  createdAtDay: string;
  corrected: boolean;
  prediction?: ExpensePrediction;
  sourceType?: CategoryTrainingExample["sourceType"];
  kindHint?: CategoryTrainingExample["kindHint"];
  localeHint?: CategoryTrainingExample["localeHint"];
}): CategoryTrainingExample {
  return {
    id: input.id,
    rawText: input.rawText,
    cleanLabel: input.cleanLabel,
    categoryKey: input.categoryKey,
    predictedCategoryKey: input.prediction?.predictedCategoryKey,
    predictionSource: input.prediction?.predictionSource,
    confidence: input.prediction?.confidence,
    corrected: input.corrected,
    createdAtDay: input.createdAtDay,
    sourceType: input.sourceType,
    kindHint: input.kindHint,
    localeHint: input.localeHint,
  };
}

type ExpenseSaveLearningInput = {
  rawText: string;
  cleanLabel: string;
  categoryKey: string;
  createdAtDay: string;
  prediction?: ExpensePrediction;
  sourceType?: CategoryTrainingExample["sourceType"];
  kindHint?: CategoryTrainingExample["kindHint"];
};

function buildExpenseSaveExample(
  input: ExpenseSaveLearningInput,
): CategoryTrainingExample {
  return buildTrainingExample({
    id: nextTrainingExampleId(),
    rawText: input.rawText,
    cleanLabel: input.cleanLabel,
    categoryKey: input.categoryKey,
    createdAtDay: input.createdAtDay,
    corrected: false,
    prediction: input.prediction,
    sourceType: input.sourceType,
    kindHint: input.kindHint,
  });
}

export function applyLearningOnExpenseSave(
  model: AppModel,
  input: ExpenseSaveLearningInput,
): AppModel {
  return {
    ...model,
    categoryTrainingExamples: appendTrainingExample(
      model.categoryTrainingExamples,
      buildExpenseSaveExample(input),
    ),
    categoryModelVersion: model.categoryModelVersion ?? WEIGHTS.version,
  };
}

/**
 * Append many training examples in one pass. Preferred over calling
 * applyLearningOnExpenseSave in a loop, which re-copies the whole example list
 * on every iteration (O(n²) for a bulk import).
 */
export function applyLearningOnExpenseSaveBatch(
  model: AppModel,
  inputs: readonly ExpenseSaveLearningInput[],
): AppModel {
  if (inputs.length === 0) return model;
  return {
    ...model,
    categoryTrainingExamples: appendTrainingExamples(
      model.categoryTrainingExamples,
      inputs.map(buildExpenseSaveExample),
    ),
    categoryModelVersion: model.categoryModelVersion ?? WEIGHTS.version,
  };
}

export function applyLearningOnCategoryEdit(
  model: AppModel,
  input: {
    expense: Expense;
    previousCategoryKey: string;
    nextCategoryKey: string;
    cleanLabel: string;
    rawText: string;
    createdAtDay: string;
  },
): AppModel {
  if (input.previousCategoryKey === input.nextCategoryKey) return model;

  const prediction = input.expense.prediction;
  const example = buildTrainingExample({
    id: nextTrainingExampleId(),
    rawText: input.rawText,
    cleanLabel: input.cleanLabel,
    categoryKey: input.nextCategoryKey,
    createdAtDay: input.createdAtDay,
    corrected: true,
    // 'imported' is the structural marker set by ABA import (toExpenseFromAbaTransaction),
    // more reliable than matching an English substring in the note.
    sourceType:
      input.expense.time === "imported" ? "aba_statement" : "free_text",
    prediction,
  });

  return {
    ...model,
    merchantCorrections: rememberMerchantCorrection(
      model.merchantCorrections,
      input.cleanLabel,
      input.nextCategoryKey,
    ),
    categoryTrainingExamples: appendTrainingExample(
      model.categoryTrainingExamples,
      example,
    ),
    categoryModelVersion: model.categoryModelVersion ?? WEIGHTS.version,
  };
}
