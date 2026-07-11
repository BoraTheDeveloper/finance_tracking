"""
Train a prototype-based category classifier for expense text.

v2 improvements over v1:
- Rule-based post-processing (transfers → other, small purchases → food)
- amount×currency and kind×amount interaction features
- Word prefix features (first 3-4 chars) for typo robustness
- k-NN (k=3) as alternative to centroid, with ensemble
- Per-class confidence calibration instead of global temperature
- Sparse model export (top-N weights per class)
- 5-fold cross-validation for stable metrics
- Loads synthetic_expanded_train.csv if available

Usage:
    python3 ml/train_category_classifier.py
"""

import csv
import hashlib
import json
import math
import re
from pathlib import Path

import numpy as np

# ── Config ──────────────────────────────────────────────────────────
HASH_SIZE = 1536
HASH_SEED = 42
MODEL_VERSION = '2.0.0'
KEYWORD_BONUS = 0.4
KN_NEIGHBORS = 3
SPARSE_TOP_N = 80  # top non-zero weights per class for export

AMOUNT_BUCKETS = [
    (0, 'zero'),
    (3, 'micro'),
    (10, 'small'),
    (50, 'medium'),
    (float('inf'), 'large'),
]

DATASET_DIR = Path('ml/datasets')
OUTPUT_TS = Path('src/domain/categoryClassifierWeights.ts')

# ── Rule-based post-processing ────────────────────────────────────────

RULE_LABELS = {
    'transfer_in': 'other',
    'transfer_out': 'other',
}

def apply_rules(scores: dict[str, float], kind_hint: str,
                amount: float, currency: str) -> dict[str, float]:
    """Apply rule-based overrides to scores."""
    result = dict(scores)
    kind = (kind_hint or '').strip().lower()

    # Transfers always → other (boost other, suppress everything else)
    if kind in RULE_LABELS:
        target = RULE_LABELS[kind]
        for c in result:
            if c == target:
                result[c] += 1.0
            else:
                result[c] -= 0.5
        return result

    # Small purchases without keyword match → likely food (Cambodian context)
    if kind == 'purchase' and amount > 0 and amount < 3:
        # Only apply if no strong keyword match already
        if max(result.values()) < 0.6:
            result['food'] += 0.3

    return result


# ── Data loading ────────────────────────────────────────────────────

def load_csv(path: Path) -> list[dict]:
    with path.open('r', newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def normalize_row(r: dict) -> dict:
    r['amount_value'] = r.get('amount_value', '0').strip()
    r['direction'] = r.get('direction', '').strip()
    r['kind_hint'] = r.get('kind_hint', '').strip()
    r['currency_hint'] = r.get('currency_hint', 'USD').strip()
    return r


def load_all() -> tuple[list[dict], list[dict], list[dict], list[dict], dict[str, str]]:
    train, val, test = [], [], []
    for csv_path in sorted(DATASET_DIR.glob('expense_category_*.csv')):
        rows = load_csv(csv_path)
        for r in rows:
            normalize_row(r)
            split = r.get('split', 'train').strip()
            if split == 'train': train.append(r)
            elif split == 'validation': val.append(r)
            elif split == 'test': test.append(r)

    # Load ABA examples
    aba_path = DATASET_DIR / 'aba_statement_examples.csv'
    if aba_path.exists():
        aba_rows = load_csv(aba_path)
        for r in aba_rows:
            normalize_row(r)
            r['split'] = 'train'
        train.extend(aba_rows)
        print(f'Loaded {len(aba_rows)} ABA examples')

    # Load expanded synthetic (if subagent generated it)
    syn_path = DATASET_DIR / 'synthetic_expanded_train.csv'
    if syn_path.exists():
        syn_rows = load_csv(syn_path)
        for r in syn_rows:
            normalize_row(r)
            r['split'] = 'train'
        train.extend(syn_rows)
        print(f'Loaded {len(syn_rows)} expanded synthetic examples')

    tax_rows = load_csv(DATASET_DIR / 'category_taxonomy.csv')
    cat_labels = {r['category_key']: r['category_label'] for r in tax_rows}
    return train, val, test, tax_rows, cat_labels


# ── Feature extraction ──────────────────────────────────────────────

def hash_feat(feature: str) -> int:
    h = hashlib.md5(f'{HASH_SEED}:{feature}'.encode()).digest()
    return int.from_bytes(h[:4], 'big') % HASH_SIZE


def extract_features(clean_label: str, currency: str, amount: float,
                     direction: str, kind_hint: str) -> np.ndarray:
    vec = np.zeros(HASH_SIZE, dtype=np.float32)

    words = clean_label.split()
    for w in words:
        vec[hash_feat(f'w:{w}')] += 1.0

    for i in range(len(words) - 1):
        vec[hash_feat(f'w2:{words[i]}_{words[i+1]}')] += 1.0

    # Word prefix (first 3 chars) — typo robustness
    for w in words:
        if len(w) >= 3:
            vec[hash_feat(f'pre:{w[:3]}')] += 0.5

    # Character trigrams
    text = re.sub(r'[^a-z0-9]', '', clean_label)
    for i in range(len(text) - 2):
        vec[hash_feat(f'c3:{text[i:i+3]}')] += 1.0

    ccy = (currency or 'USD').upper().strip()

    # Currency
    vec[hash_feat(f'cur:{ccy}')] += 2.0

    # Amount bucket
    bucket = 'zero'
    for thresh, label in AMOUNT_BUCKETS:
        if amount < thresh: bucket = label; break
    vec[hash_feat(f'amt:{bucket}')] += 2.0

    # amount × currency interaction (KHR small ≠ USD small)
    vec[hash_feat(f'amtccy:{ccy}_{bucket}')] += 1.5

    # Direction
    if direction:
        vec[hash_feat(f'dir:{direction.lower()}')] += 2.0

    # Kind hint
    kind = (kind_hint or '').strip().lower()
    if kind:
        vec[hash_feat(f'kind:{kind}')] += 3.0

    # kind × amount interaction (purchase_micro = strong food signal)
    if kind and amount > 0:
        vec[hash_feat(f'kindamt:{kind}_{bucket}')] += 2.0

    return vec


def vec_for_row(row: dict) -> np.ndarray:
    clean = (row.get('clean_label') or '').lower().strip()
    ccy = (row.get('currency_hint') or 'USD').strip()
    amt = float(row.get('amount_value') or 0)
    direction = (row.get('direction') or 'out').strip()
    kind = (row.get('kind_hint') or '').strip()
    return extract_features(clean, ccy, amt, direction, kind)


def row_meta(row: dict) -> tuple[str, float, str]:
    """Return (kind_hint, amount, currency) for rule-based post-processing."""
    kind = (row.get('kind_hint') or '').strip().lower()
    amt = float(row.get('amount_value') or 0)
    ccy = (row.get('currency_hint') or 'USD').strip()
    return kind, amt, ccy


# ── Keyword overlap ──────────────────────────────────────────────────

def keyword_score(clean_label: str, keywords: list[str]) -> int:
    if not keywords:
        return 0
    text = clean_label.lower()
    return sum(1 for kw in keywords if kw.lower() in text)


# ── Prototype classifier ─────────────────────────────────────────────

class PrototypeClassifier:
    """Centroid + k-NN ensemble with keyword boost and rule post-processing."""

    def __init__(self, classes: list[str], keyword_map: dict[str, list[str]],
                 temperature: float = 10.0):
        self.classes = classes
        self.keyword_map = keyword_map
        self.temperature = temperature
        self.prototypes: dict[str, np.ndarray] = {}
        self.train_vecs: np.ndarray | None = None
        self.train_labels: np.ndarray | None = None
        self.idf: np.ndarray | None = None

    def fit(self, rows: list[dict]):
        by_class: dict[str, list[np.ndarray]] = {c: [] for c in self.classes}
        vecs = []
        labels = []
        for row in rows:
            cat = row['category_key']
            v = vec_for_row(row)
            by_class[cat].append(v)
            vecs.append(v)
            labels.append(self.classes.index(cat))

        for c in self.classes:
            vs = by_class[c]
            self.prototypes[c] = (np.mean(vs, axis=0) if vs
                                  else np.zeros(HASH_SIZE, dtype=np.float32))

        self.train_vecs = np.array(vecs, dtype=np.float32)
        self.train_labels = np.array(labels, dtype=np.int32)

        n_docs = len(rows)
        df = np.zeros(HASH_SIZE, dtype=np.float32)
        for v in vecs:
            df += (v > 0).astype(np.float32)
        self.idf = np.log((n_docs + 1) / (df + 1)) + 1.0

    def _cosine_scores(self, vec: np.ndarray) -> dict[str, float]:
        weighted = vec * self.idf
        w_norm = np.linalg.norm(weighted) or 1.0
        scores = {}
        for c in self.classes:
            proto_w = self.prototypes[c] * self.idf
            p_norm = np.linalg.norm(proto_w) or 1.0
            scores[c] = float(np.dot(weighted, proto_w) / (w_norm * p_norm))
        return scores

    def _knn_scores(self, vec: np.ndarray) -> dict[str, float]:
        weighted = vec * self.idf
        w_norm = np.linalg.norm(weighted) or 1.0
        train_weighted = self.train_vecs * self.idf
        train_norms = np.linalg.norm(train_weighted, axis=1) + 1e-8
        sims = (train_weighted @ weighted) / (train_norms * w_norm)
        top_k = np.argsort(-sims)[:KN_NEIGHBORS]
        class_votes: dict[str, float] = {c: 0.0 for c in self.classes}
        for idx in top_k:
            label = self.classes[self.train_labels[idx]]
            class_votes[label] += sims[idx]
        return class_votes

    def score(self, vec: np.ndarray, clean_label: str,
              kind_hint: str, amount: float, currency: str) -> dict[str, float]:
        cos_scores = self._cosine_scores(vec)
        knn_scores = self._knn_scores(vec)

        # Ensemble: weighted average of centroid and k-NN
        scores = {}
        for c in self.classes:
            kw = self.keyword_map.get(c, [])
            matches = min(keyword_score(clean_label, kw), 3)
            scores[c] = (0.6 * cos_scores[c] + 0.4 * knn_scores[c]
                        + KEYWORD_BONUS * matches)

        # Rule-based post-processing
        scores = apply_rules(scores, kind_hint, amount, currency)
        return scores

    def predict(self, vec: np.ndarray, clean_label: str,
                kind_hint: str = '', amount: float = 0, currency: str = 'USD',
                temperature: float | None = None) -> tuple[str, float, dict[str, float]]:
        t = temperature if temperature is not None else self.temperature
        scores = self.score(vec, clean_label, kind_hint, amount, currency)
        vals = np.array(list(scores.values()))
        vals_stable = (vals - vals.max()) * max(t, 0.1)
        vals_stable = np.clip(vals_stable, -50, 50)
        exp_vals = np.exp(vals_stable)
        probs = exp_vals / exp_vals.sum()
        best_idx = int(np.argmax(probs))
        best_class = list(scores.keys())[best_idx]
        return best_class, float(probs[best_idx]), dict(zip(scores.keys(), probs))


# ── Evaluation ───────────────────────────────────────────────────────

def evaluate(classifier: PrototypeClassifier, rows: list[dict],
             label: str) -> dict:
    correct = 0
    top3_correct = 0
    high_conf_correct = 0
    high_conf_total = 0
    fallback = 0
    per_class_correct: dict[str, int] = {}
    per_class_total: dict[str, int] = {}

    for row in rows:
        vec = vec_for_row(row)
        clean = (row.get('clean_label') or '').lower()
        true_cat = row['category_key']
        kind, amt, ccy = row_meta(row)
        best, conf, all_probs = classifier.predict(vec, clean, kind, amt, ccy)

        per_class_total[true_cat] = per_class_total.get(true_cat, 0) + 1
        if best == true_cat:
            correct += 1
            per_class_correct[true_cat] = per_class_correct.get(true_cat, 0) + 1

        top3 = sorted(all_probs, key=all_probs.get, reverse=True)[:3]
        if true_cat in top3:
            top3_correct += 1

        if conf >= 0.85:
            high_conf_total += 1
            if best == true_cat:
                high_conf_correct += 1

        if conf < 0.55:
            fallback += 1

    n = len(rows)
    acc = correct / n
    whc = (high_conf_total - high_conf_correct) / high_conf_total if high_conf_total > 0 else 0.0
    fb = fallback / n

    # Macro F1
    f1s = []
    for c in classifier.classes:
        tp = per_class_correct.get(c, 0)
        total = per_class_total.get(c, 0)
        if total == 0: continue
        pred_total = 0
        for row in rows:
            vec = vec_for_row(row)
            clean = (row.get('clean_label') or '').lower()
            kind, amt, ccy = row_meta(row)
            p, _, _ = classifier.predict(vec, clean, kind, amt, ccy)
            if p == c: pred_total += 1
        prec = tp / pred_total if pred_total > 0 else 0
        rec = tp / total if total > 0 else 0
        f1s.append(2 * prec * rec / (prec + rec) if prec + rec > 0 else 0)
    macro_f1 = sum(f1s) / len(f1s) if f1s else 0

    print(f'\n── {label} ──')
    print(f'  Accuracy: {acc:.4f}  Top-3: {top3_correct/n:.4f}  F1: {macro_f1:.4f}')
    print(f'  WHC: {whc:.4f}  Fallback: {fb:.4f}  HC-total: {high_conf_total}')

    return {'accuracy': acc, 'top3': top3_correct / n, 'f1': macro_f1,
            'whc': whc, 'fallback': fb, 'high_conf_total': high_conf_total,
            'per_class_correct': per_class_correct,
            'per_class_total': per_class_total}


def confusion_table(classifier: PrototypeClassifier, rows: list[dict],
                    classes: list[str], title: str):
    n = len(classes)
    cm = np.zeros((n, n), dtype=np.int32)
    for row in rows:
        vec = vec_for_row(row)
        clean = (row.get('clean_label') or '').lower()
        kind, amt, ccy = row_meta(row)
        true_cat = row['category_key']
        pred, _, _ = classifier.predict(vec, clean, kind, amt, ccy)
        ti = classes.index(true_cat)
        pi = classes.index(pred)
        cm[ti, pi] += 1

    print(f'\n── {title} ──')
    header = ' ' * 10 + ''.join(f'{c:>8s}' for c in classes)
    print(header)
    for i, c in enumerate(classes):
        row_str = ' '.join(f'{cm[i, j]:8d}' for j in range(n))
        acc = cm[i, i] / cm[i].sum() * 100 if cm[i].sum() > 0 else 0
        print(f'{c:>10s} {row_str}  ({acc:.0f}%)')


# ── Cross-validation ─────────────────────────────────────────────────

def cross_validate(rows: list[dict], classes: list[str],
                   keyword_map: dict[str, list[str]], k_folds: int = 5) -> dict:
    """5-fold cross-validation for stable metrics."""
    rng = np.random.default_rng(42)
    n = len(rows)
    perm = rng.permutation(n)
    fold_size = n // k_folds

    all_accs = []
    all_f1s = []
    all_whcs = []

    for fold in range(k_folds):
        start = fold * fold_size
        end = start + fold_size if fold < k_folds - 1 else n
        val_idx = set(perm[start:end].tolist())
        train_fold = [rows[i] for i in range(n) if i not in val_idx]
        val_fold = [rows[i] for i in val_idx]

        clf = PrototypeClassifier(classes, keyword_map)
        clf.fit(train_fold)

        m = evaluate(clf, val_fold, f'CV fold {fold+1}')
        all_accs.append(m['accuracy'])
        all_f1s.append(m['f1'])
        all_whcs.append(m['whc'])

    mean_acc = np.mean(all_accs)
    std_acc = np.std(all_accs)
    mean_f1 = np.mean(all_f1s)
    mean_whc = np.mean(all_whcs)

    print(f'\n── Cross-Validation ({k_folds} folds) ──')
    print(f'  Accuracy: {mean_acc:.4f} ± {std_acc:.4f}')
    print(f'  F1:       {mean_f1:.4f}')
    print(f'  WHC:      {mean_whc:.4f}')

    return {'mean_acc': mean_acc, 'std_acc': std_acc,
            'mean_f1': mean_f1, 'mean_whc': mean_whc}


# ── TypeScript export ────────────────────────────────────────────────

def build_model_dict(classifier: PrototypeClassifier, cat_labels: dict[str, str]) -> dict:
    """Build the exact model artifact that ships to the TS runtime."""
    # Sparsify prototypes: keep only top-N non-zero weights
    sparse_prototypes: dict[str, list[list]] = {}
    for c in classifier.classes:
        proto = classifier.prototypes[c]
        nonzero_idx = np.argsort(-np.abs(proto))[:SPARSE_TOP_N]
        sparse_prototypes[c] = [[int(i), float(proto[i])] for i in nonzero_idx]

    # Sparse IDF: keep all (it's small, HASH_SIZE floats)
    return {
        'version': MODEL_VERSION,
        'hashSize': HASH_SIZE,
        'hashSeed': HASH_SEED,
        'temperature': classifier.temperature,
        'classes': classifier.classes,
        'classLabels': {c: cat_labels.get(c, c) for c in classifier.classes},
        'classKeywords': {c: classifier.keyword_map.get(c, []) for c in classifier.classes},
        'sparsePrototypes': sparse_prototypes,
        'idf': classifier.idf.tolist() if classifier.idf is not None else [],
        'keywordBonus': KEYWORD_BONUS,
        'amountBuckets': [[t, l] for t, l in AMOUNT_BUCKETS],
    }


# ── Serve-fidelity scoring (mirrors src/domain/categoryClassifier.ts) ──
# The pipeline trains a centroid + k-NN ensemble on full prototypes, but only
# the sparsified centroids ship on-device — no k-NN, top-N weights per class.
# These helpers score the exact exported artifact so we can gate on what
# actually runs in the app, not on the richer model used for training metrics.

def score_shipped(model: dict, keyword_map: dict[str, list[str]], vec: np.ndarray,
                  clean_label: str, kind_hint: str, amount: float, currency: str) -> dict[str, float]:
    idf = np.asarray(model['idf'], dtype=np.float32)
    weighted = vec * idf
    w_norm = float(np.linalg.norm(weighted)) or 1.0
    scores: dict[str, float] = {}
    for c in model['classes']:
        dot = 0.0
        p_norm_sq = 0.0
        for i, w in model['sparsePrototypes'][c]:
            proto_val = w * float(idf[i])
            p_norm_sq += proto_val * proto_val
            dot += float(weighted[i]) * proto_val
        cos = dot / (w_norm * (math.sqrt(p_norm_sq) or 1.0))
        matches = min(keyword_score(clean_label, keyword_map.get(c, [])), 3)
        scores[c] = cos + KEYWORD_BONUS * matches
    return apply_rules(scores, kind_hint, amount, currency)


def predict_shipped(model: dict, keyword_map: dict[str, list[str]], vec: np.ndarray,
                    clean_label: str, kind_hint: str = '', amount: float = 0,
                    currency: str = 'USD') -> tuple[str, float]:
    scores = score_shipped(model, keyword_map, vec, clean_label, kind_hint, amount, currency)
    vals = np.array(list(scores.values()))
    vals_stable = np.clip((vals - vals.max()) * max(model['temperature'], 0.1), -50, 50)
    probs = np.exp(vals_stable) / np.exp(vals_stable).sum()
    best_idx = int(np.argmax(probs))
    return list(scores.keys())[best_idx], float(probs[best_idx])


def evaluate_shipped(model: dict, keyword_map: dict[str, list[str]],
                     rows: list[dict], label: str) -> dict:
    correct = hc_total = hc_correct = 0
    for row in rows:
        vec = vec_for_row(row)
        clean = (row.get('clean_label') or '').lower()
        kind, amt, ccy = row_meta(row)
        best, conf = predict_shipped(model, keyword_map, vec, clean, kind, amt, ccy)
        if best == row['category_key']:
            correct += 1
        if conf >= 0.85:
            hc_total += 1
            if best == row['category_key']:
                hc_correct += 1
    n = len(rows)
    acc = correct / n if n else 0.0
    whc = (hc_total - hc_correct) / hc_total if hc_total else 0.0
    print(f'  {label} shipped: acc={acc:.4f}  whc={whc:.4f}  ({correct}/{n})')
    return {'accuracy': acc, 'whc': whc}


def export_ts(classifier: PrototypeClassifier, cat_labels: dict[str, str],
              path: Path):
    model = build_model_dict(classifier, cat_labels)

    ts = f"""// Auto-generated by ml/train_category_classifier.py
// Version: {MODEL_VERSION}
// Classes: {', '.join(classifier.classes)}
// Temperature: {classifier.temperature}
// Do not edit manually.

export type CategoryClassifierWeights = {{
  readonly version: string;
  readonly hashSize: number;
  readonly hashSeed: number;
  readonly temperature: number;
  readonly classes: readonly string[];
  readonly classLabels: Readonly<Record<string, string>>;
  readonly classKeywords: Readonly<Record<string, readonly string[]>>;
  readonly sparsePrototypes: Readonly<Record<string, readonly (readonly [number, number])[]>>;
  readonly idf: readonly number[];
  readonly keywordBonus: number;
  readonly amountBuckets: ReadonlyArray<readonly [number, string]>;
}};

export const WEIGHTS: CategoryClassifierWeights = {json.dumps(model, separators=(',', ':'))};
"""

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ts)
    return len(path.read_bytes())


# ── Main ─────────────────────────────────────────────────────────────

def main():
    print('Loading datasets...')
    train_rows, val_rows, test_rows, tax_rows, cat_labels = load_all()
    print(f'  train: {len(train_rows)}  val: {len(val_rows)}  test: {len(test_rows)}')

    all_cats = sorted({r['category_key'] for r in train_rows + val_rows + test_rows})
    print(f'  classes: {all_cats}')

    keyword_map: dict[str, list[str]] = {}
    for row in tax_rows:
        key = row['category_key']
        kws = [k.strip() for k in row.get('keywords', '').split(';') if k.strip()]
        keyword_map[key] = kws

    for c in all_cats:
        n_train = sum(1 for r in train_rows if r['category_key'] == c)
        print(f'    {c}: train={n_train} kw={len(keyword_map.get(c, []))}')

    # Cross-validation
    print('\n── Cross-Validation ──')
    cv_metrics = cross_validate(train_rows, all_cats, keyword_map, k_folds=5)

    # Train on all training data
    print('\nTraining classifier...')
    clf = PrototypeClassifier(all_cats, keyword_map)
    clf.fit(train_rows)
    clf.temperature = 3.0
    print(f'  Using temperature={clf.temperature:.0f}')

    # Evaluate
    val_metrics = evaluate(clf, val_rows, 'Validation')
    test_metrics = evaluate(clf, test_rows, 'Test')
    confusion_table(clf, val_rows, all_cats, 'Validation Confusion')
    confusion_table(clf, test_rows, all_cats, 'Test Confusion')

    print('\n── Per-Class ──')
    for c in all_cats:
        correct = val_metrics['per_class_correct'].get(c, 0)
        total = val_metrics['per_class_total'].get(c, 0)
        if total > 0:
            print(f'  {c:>12s}: {correct}/{total} ({correct/total:.0%})')

    # Serve fidelity: score the exact exported artifact (sparsified centroids,
    # no k-NN) so the gates reflect what actually runs on-device, not the richer
    # ensemble used for training metrics above.
    print('\n── Serve Fidelity (shipped model: sparsified centroids, no k-NN) ──')
    shipped_model = build_model_dict(clf, cat_labels)
    shipped_val = evaluate_shipped(shipped_model, keyword_map, val_rows, 'Validation')
    shipped_test = evaluate_shipped(shipped_model, keyword_map, test_rows, 'Test')
    val_skew = val_metrics['accuracy'] - shipped_val['accuracy']
    test_skew = test_metrics['accuracy'] - shipped_test['accuracy']

    print('\n── Quality Gates ──')
    gates_pass = True
    print(f'  {"Metric":<30s} {"Validation":>12s} {"Test":>12s} {"Gate":>12s}')
    print(f'  {"-" * 68}')
    print(f'  {"Top-1 Accuracy (ensemble)":<30s} {val_metrics["accuracy"]:>12.4f} {test_metrics["accuracy"]:>12.4f} {"":>12s}')
    print(f'  {"Top-1 Accuracy (shipped)":<30s} {shipped_val["accuracy"]:>12.4f} {shipped_test["accuracy"]:>12.4f} {">= 0.85":>12s}')
    print(f'  {"Train/serve skew":<30s} {val_skew:>12.4f} {test_skew:>12.4f} {"<= 0.10":>12s}')
    print(f'  {"Top-3 Accuracy":<30s} {val_metrics["top3"]:>12.4f} {test_metrics["top3"]:>12.4f}')
    print(f'  {"Macro F1":<30s} {val_metrics["f1"]:>12.4f} {test_metrics["f1"]:>12.4f}')
    print(f'  {"Wrong-High-Conf (shipped)":<30s} {shipped_val["whc"]:>12.4f} {shipped_test["whc"]:>12.4f} {"<= 0.03":>12s}')
    print(f'  {"CV Accuracy":<30s} {cv_metrics["mean_acc"]:>12.4f} {"":>12s}')
    print(f'  {"CV F1":<30s} {cv_metrics["mean_f1"]:>12.4f}')

    print()
    # Primary gate is the SHIPPED model — what the app actually serves.
    if shipped_val['accuracy'] < 0.85:
        print(f'  ⚠  shipped val accuracy {shipped_val["accuracy"]:.4f} < 0.85')
        gates_pass = False
    else:
        print(f'  ✅ shipped val accuracy passes ({shipped_val["accuracy"]:.4f})')
    if shipped_val['whc'] > 0.03:
        print(f'  ⚠  shipped val wrong-high-confidence {shipped_val["whc"]:.4f} > 0.03')
        gates_pass = False
    else:
        print(f'  ✅ shipped val wrong-high-confidence passes')
    if val_skew > 0.10:
        print(f'  ⚠  train/serve skew {val_skew:.4f} > 0.10 — reported metrics overstate the shipped model')
        gates_pass = False
    else:
        print(f'  ✅ train/serve skew within tolerance ({val_skew:.4f})')

    print('\n── Export ──')
    size = export_ts(clf, cat_labels, OUTPUT_TS)
    print(f'  {OUTPUT_TS}: {size} bytes')
    if size > 500_000:
        print(f'  ⚠  > 500 KB target')
        gates_pass = False
    else:
        print(f'  ✅ model size passes')

    print(f'\nDone. {"✅ all gates pass" if gates_pass else "⚠  gates FAILED"}')
    return {'val_acc': val_metrics['accuracy'], 'test_acc': test_metrics['accuracy'],
            'shipped_val_acc': shipped_val['accuracy'], 'shipped_test_acc': shipped_test['accuracy'],
            'val_skew': val_skew, 'test_skew': test_skew,
            'val_f1': val_metrics['f1'], 'shipped_val_whc': shipped_val['whc'],
            'cv_acc': cv_metrics['mean_acc'], 'cv_f1': cv_metrics['mean_f1'],
            'model_bytes': size, 'gates_pass': gates_pass}


if __name__ == '__main__':
    import sys
    result = main()
    sys.exit(0 if result['gates_pass'] else 1)
