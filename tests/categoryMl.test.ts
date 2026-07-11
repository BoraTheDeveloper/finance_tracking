import { describe, expect, it } from 'vitest';
import { INITIAL_MODEL } from '../src/app/initialState';
import { normalizeLoadedModel } from '../src/app/normalizeLoadedModel';
import {
  cleanAbaDescription,
  cleanFreeTextLabel,
  correctionKeyFromCleanLabel,
} from '../src/domain/expenseLabel';
import { predictCategory } from '../src/domain/categoryClassifier';
import {
  MAX_CATEGORY_TRAINING_EXAMPLES,
  applyLearningOnCategoryEdit,
  applyLearningOnExpenseSave,
  categoryFromCorrections,
  rememberMerchantCorrection,
} from '../src/domain/categoryLearning';
import { suggestCategory } from '../src/domain/categorySuggestion';

describe('expenseLabel', () => {
  it('cleans free-text amounts and date words', () => {
    expect(cleanFreeTextLabel('brown coffee 12000 riels')).toBe('brown coffee');
    expect(cleanFreeTextLabel('netflix, 10$')).toBe('netflix');
    expect(cleanFreeTextLabel('lunch yesterday 6 usd')).toBe('lunch');
  });

  it('cleans ABA purchase descriptions', () => {
    const raw =
      'PURCHASE AT PHAEN COFFEE by D.L ON Jul 04, 2026 ORIGINAL AMOUNT 4.50 USD REF# ABC-1';
    expect(cleanAbaDescription(raw)).toContain('phaen coffee');
    expect(cleanAbaDescription(raw)).not.toContain('REF#');
  });

  it('normalizes correction keys', () => {
    expect(correctionKeyFromCleanLabel('Brown Coffee!')).toBe('brown coffee');
  });
});

describe('categoryLearning', () => {
  it('remembers merchant corrections by cleaned label key', () => {
    const next = rememberMerchantCorrection({}, 'Brown Coffee', 'food');
    expect(categoryFromCorrections(next, 'brown coffee')).toBe('food');
  });

  it('caps training examples at 1000', () => {
    const examples = Array.from({ length: MAX_CATEGORY_TRAINING_EXAMPLES + 5 }, (_, index) => ({
      id: `ex-${index}`,
      rawText: `coffee ${index}`,
      cleanLabel: 'coffee',
      categoryKey: 'food',
      corrected: false,
      createdAtDay: '2026-07-01',
    }));
    const model = { ...INITIAL_MODEL, categoryTrainingExamples: examples };
    const next = applyLearningOnExpenseSave(model, {
      rawText: 'coffee 2',
      cleanLabel: 'coffee',
      categoryKey: 'food',
      createdAtDay: '2026-07-02',
    });
    expect(next.categoryTrainingExamples).toHaveLength(MAX_CATEGORY_TRAINING_EXAMPLES);
  });

  it('records corrected category edits', () => {
    const expense = {
      id: 'exp-1',
      name: 'netflix',
      cat: 'other',
      amount: 10,
      cur: 'USD' as const,
      time: '12:00',
      date: '2026-07-01',
      prediction: {
        cleanLabel: 'netflix',
        predictedCategoryKey: 'other',
        predictionSource: 'classifier' as const,
        confidence: 0.4,
      },
    };
    const next = applyLearningOnCategoryEdit(INITIAL_MODEL, {
      expense,
      previousCategoryKey: 'other',
      nextCategoryKey: 'ent',
      cleanLabel: 'netflix',
      rawText: 'netflix 10',
      createdAtDay: '2026-07-01',
    });
    expect(next.merchantCorrections.netflix).toBe('ent');
    expect(next.categoryTrainingExamples.at(-1)?.corrected).toBe(true);
  });
});

describe('categoryClassifier', () => {
  it('returns a valid ranked prediction object', () => {
    const result = predictCategory({
      cleanLabel: 'netflix',
      currency: 'USD',
      amount: 10,
      direction: 'out',
    });
    expect(['ent', 'other', 'bills']).toContain(result.categoryKey);
    expect(result.alternatives.length).toBe(3);
  });
});

describe('category suggestion stack', () => {
  it('maps netflix free text to entertainment via keyword fallback', () => {
    const suggestion = suggestCategory(INITIAL_MODEL, {
      rawText: 'netflix 10',
      label: 'netflix',
      currency: 'USD',
      amount: 10,
      kind: 'expense',
      sourceType: 'free_text',
    });
    expect(suggestion.categoryKey).toBe('ent');
  });
});

describe('category suggestion priority', () => {
  it('prefers merchant correction over classifier', () => {
    const model = {
      ...INITIAL_MODEL,
      merchantCorrections: { netflix: 'ent' },
    };
    const suggestion = suggestCategory(model, {
      rawText: 'netflix 10',
      label: 'netflix',
      currency: 'USD',
      amount: 10,
      kind: 'expense',
      sourceType: 'free_text',
    });
    expect(suggestion.categoryKey).toBe('ent');
    expect(suggestion.source).toBe('correction');
  });
});

describe('normalizeLoadedModel category learning migration', () => {
  it('defaults missing learning fields on old persisted state', () => {
    const model = normalizeLoadedModel({ onboarded: true, screen: 'home' }, '2026-07-01');
    expect(model.merchantCorrections).toEqual({});
    expect(model.categoryTrainingExamples).toEqual([]);
    expect(model.categoryModelVersion).toBeNull();
  });
});