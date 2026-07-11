import type { Currency } from '../app/types';
import { hashFeatureIndex } from './featureHash';
import { WEIGHTS, type CategoryClassifierWeights } from './categoryClassifierWeights';

export type CategoryKindHint = '' | 'purchase' | 'transfer_in' | 'transfer_out' | 'other';

export type CategoryClassifierInput = Readonly<{
  cleanLabel: string;
  currency: Currency;
  amount: number;
  direction?: 'in' | 'out';
  kindHint?: CategoryKindHint;
}>;

export type CategoryPredictionSource = 'classifier' | 'keyword' | 'fallback';

export type CategoryClassifierResult = Readonly<{
  categoryKey: string;
  confidence: number;
  source: CategoryPredictionSource;
  alternatives: ReadonlyArray<Readonly<{ categoryKey: string; confidence: number }>>;
  cleanLabel: string;
}>;

const AUTO_THRESHOLD = 0.85;
const SUGGEST_THRESHOLD = 0.55;

function amountBucket(amount: number, buckets: CategoryClassifierWeights['amountBuckets']) {
  for (const [threshold, label] of buckets) {
    if (amount < threshold) return label;
  }
  return buckets[buckets.length - 1]?.[1] ?? 'large';
}

function buildFeatureWeights(input: CategoryClassifierInput, weights: CategoryClassifierWeights) {
  const map = new Map<number, number>();
  const add = (feature: string, value: number) => {
    const index = hashFeatureIndex(feature, weights.hashSize, weights.hashSeed);
    map.set(index, (map.get(index) ?? 0) + value);
  };

  const clean = input.cleanLabel.toLowerCase().trim();
  const words = clean.split(/\s+/).filter(Boolean);
  for (const word of words) add(`w:${word}`, 1);
  for (let i = 0; i < words.length - 1; i += 1) add(`w2:${words[i]}_${words[i + 1]}`, 1);
  for (const word of words) {
    if (word.length >= 3) add(`pre:${word.slice(0, 3)}`, 0.5);
  }

  const compact = clean.replace(/[^a-z0-9]/g, '');
  for (let i = 0; i < compact.length - 2; i += 1) add(`c3:${compact.slice(i, i + 3)}`, 1);

  const currency = input.currency.toUpperCase();
  const bucket = amountBucket(input.amount, weights.amountBuckets);
  add(`cur:${currency}`, 2);
  add(`amt:${bucket}`, 2);
  add(`amtccy:${currency}_${bucket}`, 1.5);

  const direction = (input.direction ?? 'out').toLowerCase();
  add(`dir:${direction}`, 2);

  const kind = (input.kindHint ?? '').trim().toLowerCase();
  if (kind) {
    add(`kind:${kind}`, 3);
    if (input.amount > 0) add(`kindamt:${kind}_${bucket}`, 2);
  }

  const idfWeighted = new Map<number, number>();
  for (const [index, value] of map) {
    const idf = weights.idf[index] ?? 1;
    idfWeighted.set(index, value * idf);
  }
  return idfWeighted;
}

function vectorNorm(values: Map<number, number>) {
  let sum = 0;
  for (const value of values.values()) sum += value * value;
  return Math.sqrt(sum) || 1;
}

function cosineSimilarity(
  query: Map<number, number>,
  prototype: ReadonlyArray<readonly [number, number]>,
  idf: readonly number[],
) {
  let dot = 0;
  let protoNorm = 0;
  for (const [index, weight] of prototype) {
    const idfWeight = idf[index] ?? 1;
    const protoValue = weight * idfWeight;
    protoNorm += protoValue * protoValue;
    const queryValue = query.get(index);
    if (queryValue != null) dot += queryValue * protoValue;
  }
  return dot / (vectorNorm(query) * (Math.sqrt(protoNorm) || 1));
}

function keywordMatches(cleanLabel: string, keywords: readonly string[]) {
  const text = cleanLabel.toLowerCase();
  return Math.min(keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length, 3);
}

function applyRules(
  scores: Record<string, number>,
  kindHint: CategoryKindHint,
  amount: number,
) {
  const next = { ...scores };
  if (kindHint === 'transfer_in' || kindHint === 'transfer_out') {
    for (const key of Object.keys(next)) {
      next[key] += key === 'other' ? 1 : -0.5;
    }
    return next;
  }
  if (kindHint === 'purchase' && amount > 0 && amount < 3 && Math.max(...Object.values(next)) < 0.6) {
    next.food = (next.food ?? 0) + 0.3;
  }
  return next;
}

function softmax(scores: Record<string, number>, temperature: number) {
  const classes = Object.keys(scores);
  const max = Math.max(...classes.map((key) => scores[key]));
  const scaled = classes.map((key) => (scores[key] - max) * Math.max(temperature, 0.1));
  const clipped = scaled.map((value) => Math.max(-50, Math.min(50, value)));
  const exps = clipped.map((value) => Math.exp(value));
  const sum = exps.reduce((total, value) => total + value, 0) || 1;
  return Object.fromEntries(classes.map((key, index) => [key, exps[index] / sum]));
}

export function predictCategory(
  input: CategoryClassifierInput,
  weights: CategoryClassifierWeights = WEIGHTS,
): CategoryClassifierResult {
  const query = buildFeatureWeights(input, weights);
  const rawScores: Record<string, number> = {};

  for (const classKey of weights.classes) {
    const prototype = weights.sparsePrototypes[classKey] ?? [];
    const cosine = cosineSimilarity(query, prototype, weights.idf);
    const keywordBonus =
      weights.keywordBonus * keywordMatches(input.cleanLabel, weights.classKeywords[classKey] ?? []);
    rawScores[classKey] = cosine + keywordBonus;
  }

  const ruled = applyRules(rawScores, input.kindHint ?? '', input.amount);
  const probs = softmax(ruled, weights.temperature);
  const ranked = weights.classes
    .map((categoryKey) => ({ categoryKey, confidence: probs[categoryKey] ?? 0 }))
    .sort((left, right) => right.confidence - left.confidence);

  const top = ranked[0] ?? { categoryKey: 'other', confidence: 0 };
  const keywordOnly = keywordMatches(input.cleanLabel, weights.classKeywords[top.categoryKey] ?? []) > 0;
  const source: CategoryPredictionSource =
    top.confidence < SUGGEST_THRESHOLD
      ? 'fallback'
      : keywordOnly && top.confidence < AUTO_THRESHOLD
        ? 'keyword'
        : 'classifier';

  return {
    categoryKey: top.confidence < SUGGEST_THRESHOLD ? 'other' : top.categoryKey,
    confidence: top.confidence,
    source,
    alternatives: ranked.slice(0, 3),
    cleanLabel: input.cleanLabel,
  };
}

export const CATEGORY_CONFIDENCE_AUTO = AUTO_THRESHOLD;
export const CATEGORY_CONFIDENCE_SUGGEST = SUGGEST_THRESHOLD;