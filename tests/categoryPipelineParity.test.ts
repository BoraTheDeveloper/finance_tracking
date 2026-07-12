/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { predictCategory } from "../src/domain/categoryClassifier";
import type { Currency } from "../src/app/types";

// Serve-fidelity guard: the Python pipeline reports metrics for a centroid+k-NN
// ensemble on full prototypes, but the app ships only the sparsified centroids
// exported to src/domain/categoryClassifierWeights.ts. These tests run the
// labeled datasets through the *shipped* TS classifier so a weights regeneration
// or a classifier change that drops on-device accuracy fails loudly here.
//
// Thresholds mirror ml/train_category_classifier.py's shipped-model gate.
// Keep them in sync if that gate changes.

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function shippedAccuracy(csvPath: string) {
  const lines = readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  const iClean = header.indexOf("clean_label");
  const iCat = header.indexOf("category_key");
  const iCcy = header.indexOf("currency_hint");
  const iAmt = header.indexOf("amount_value");

  let correct = 0;
  let total = 0;
  const misses: string[] = [];
  for (const line of lines.slice(1)) {
    const f = splitCsvLine(line);
    if (f.length <= iCat) continue;
    const result = predictCategory({
      cleanLabel: f[iClean],
      currency: (f[iCcy] || "USD") as Currency,
      amount: Number(f[iAmt] || 0),
      // Match the pipeline's eval defaults for these datasets.
      direction: "out",
      kindHint: "",
    });
    // Raw argmax (before the confidence<0.55 → 'other' remap), which is what the
    // pipeline's shipped-model gate measures.
    const predicted = result.alternatives[0]?.categoryKey ?? result.categoryKey;
    total += 1;
    if (predicted === f[iCat]) correct += 1;
    else misses.push(`${f[iClean]} → ${predicted} (want ${f[iCat]})`);
  }
  return { accuracy: total ? correct / total : 0, correct, total, misses };
}

describe("category pipeline serve fidelity (shipped TS classifier vs labeled data)", () => {
  it("validation accuracy meets the shipped-model gate (>= 0.85)", () => {
    const r = shippedAccuracy("ml/datasets/expense_category_validation.csv");
    // Surface misses in the failure message without failing on their content.
    expect(
      r.accuracy,
      `val ${r.correct}/${r.total}; misses: ${r.misses.join("; ")}`,
    ).toBeGreaterThanOrEqual(0.85);
  });

  it("test accuracy holds at the measured on-device level (>= 0.83)", () => {
    const r = shippedAccuracy("ml/datasets/expense_category_test.csv");
    expect(
      r.accuracy,
      `test ${r.correct}/${r.total}; misses: ${r.misses.join("; ")}`,
    ).toBeGreaterThanOrEqual(0.83);
  });
});
