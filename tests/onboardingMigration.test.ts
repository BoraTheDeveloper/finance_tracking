import { describe, expect, it } from 'vitest';
import { INITIAL_MODEL } from '../src/app/initialState';
import {
  FIRST_SETUP_ONBOARDING_STEP,
  LAST_SETUP_ONBOARDING_STEP,
  WELCOME_ONBOARDING_STEP,
  normalizeLoadedModel,
  normalizeOnboardingStep,
} from '../src/app/normalizeLoadedModel';

const TODAY = '2026-07-07';

describe('onboarding step migration', () => {
  it('starts fresh installs at welcome without remapping old setup steps', () => {
    expect(INITIAL_MODEL.onbStep).toBe(WELCOME_ONBOARDING_STEP);
    expect(normalizeLoadedModel(undefined, TODAY).onbStep).toBe(WELCOME_ONBOARDING_STEP);

    for (const step of [FIRST_SETUP_ONBOARDING_STEP, 2, LAST_SETUP_ONBOARDING_STEP]) {
      expect(normalizeLoadedModel({ onboarded: false, screen: 'onboarding', onbStep: step }, TODAY).onbStep).toBe(step);
    }
  });

  it('keeps restored onboarded users on their persisted screen instead of forcing welcome', () => {
    const restored = normalizeLoadedModel({ onboarded: true, screen: 'home', onbStep: WELCOME_ONBOARDING_STEP }, TODAY);

    expect(restored.onboarded).toBe(true);
    expect(restored.screen).toBe('home');
    expect(restored.onbStep).toBe(WELCOME_ONBOARDING_STEP);
  });

  it('normalizes invalid persisted onboarding steps to a reachable setup boundary', () => {
    expect(normalizeOnboardingStep(-1)).toBe(WELCOME_ONBOARDING_STEP);
    expect(normalizeOnboardingStep(4)).toBe(LAST_SETUP_ONBOARDING_STEP);
    expect(normalizeOnboardingStep(1.5)).toBe(WELCOME_ONBOARDING_STEP);
    expect(normalizeOnboardingStep(undefined)).toBe(WELCOME_ONBOARDING_STEP);

    expect(normalizeLoadedModel({ onbStep: -9 } as never, TODAY).onbStep).toBe(WELCOME_ONBOARDING_STEP);
    expect(normalizeLoadedModel({ onbStep: 99 } as never, TODAY).onbStep).toBe(LAST_SETUP_ONBOARDING_STEP);
  });
});

describe('default category migration', () => {
  it('seeds legacy empty category state without creating personal records', () => {
    const normalized = normalizeLoadedModel({ defaultCategoriesSeeded: false, categories: [] }, TODAY);

    expect(normalized.defaultCategoriesSeeded).toBe(true);
    expect(normalized.categories.map((category) => category.key)).toEqual(INITIAL_MODEL.categories.map((category) => category.key));
    expect(normalized.expenses).toEqual([]);
    expect(normalized.goals).toEqual([]);
    expect(normalized.ious).toEqual([]);
    expect(normalized.history).toEqual([]);
  });

  it('preserves a user-cleared category list once defaults were already seeded', () => {
    const normalized = normalizeLoadedModel({ defaultCategoriesSeeded: true, categories: [] }, TODAY);

    expect(normalized.defaultCategoriesSeeded).toBe(true);
    expect(normalized.categories).toEqual([]);
  });

  it('preserves custom categories during normalization', () => {
    const customCategories = [
      { key: 'market', label: 'Market', icon: 'store', color: '#123456', spentUsd: 7, budgetUsd: 90 },
    ];

    const normalized = normalizeLoadedModel({ defaultCategoriesSeeded: false, categories: customCategories }, TODAY);

    expect(normalized.defaultCategoriesSeeded).toBe(true);
    expect(normalized.categories).toEqual(customCategories);
  });
});

describe('transaction kind migration', () => {
  it('treats legacy persisted transactions without a kind as expenses', () => {
    const normalized = normalizeLoadedModel({
      expenses: [
        {
          id: 'legacy-lunch',
          name: 'Lunch',
          cat: 'food',
          amount: 7,
          cur: 'USD',
          time: '12:00',
          date: '2026-07-06',
        },
      ],
    }, TODAY);

    expect(normalized.expenses[0]).toMatchObject({
      id: 'legacy-lunch',
      kind: 'expense',
      date: '2026-07-06',
    });
  });

  it('preserves persisted income transaction kinds during normalization', () => {
    const normalized = normalizeLoadedModel({
      expenses: [
        {
          id: 'cash-gift',
          name: 'Cash gift',
          cat: 'income',
          amount: 25,
          cur: 'USD',
          time: '09:00',
          date: '2026-07-06',
          kind: 'income',
        },
      ],
    }, TODAY);

    expect(normalized.expenses[0]).toMatchObject({
      id: 'cash-gift',
      kind: 'income',
      date: '2026-07-06',
    });
  });
});
