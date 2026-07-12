import {
  PERSISTED_APP_STATE_VERSION,
  type PersistedEnvelope,
} from "./persistedState";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export type RestorePreviewCounts = Readonly<{
  categories: number;
  expenses: number;
  goals: number;
  ious: number;
  recurringPayments: number;
}>;

export type RestorePreview = Readonly<{
  backupDate: string | null;
  counts: RestorePreviewCounts;
}>;

const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function validIsoDay(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_DAY_PATTERN.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

function countArrayProperty(
  state: Record<string, unknown>,
  key: keyof RestorePreviewCounts,
) {
  const value = state[key];
  return Array.isArray(value) ? value.length : 0;
}

function latestExpenseDate(expenses: unknown) {
  if (!Array.isArray(expenses)) return null;

  let latest: string | null = null;
  for (const expense of expenses) {
    if (!isObjectRecord(expense)) continue;
    const date = validIsoDay(expense.date);
    if (date && (!latest || date > latest)) latest = date;
  }

  return latest;
}

export function deriveRestorePreview(
  envelope: PersistedEnvelope<unknown>,
): RestorePreview | null {
  if (!isObjectRecord(envelope.state)) return null;

  return {
    backupDate:
      validIsoDay(envelope.state.lastActiveDay) ??
      latestExpenseDate(envelope.state.expenses),
    counts: {
      categories: countArrayProperty(envelope.state, "categories"),
      expenses: countArrayProperty(envelope.state, "expenses"),
      goals: countArrayProperty(envelope.state, "goals"),
      ious: countArrayProperty(envelope.state, "ious"),
      recurringPayments: countArrayProperty(
        envelope.state,
        "recurringPayments",
      ),
    },
  };
}

export function backupFileName(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `luy-khnom-backup-${stamp}.json`;
}

export function stringifyPersistedBackup<T extends object>(state: T) {
  return `${JSON.stringify({ version: PERSISTED_APP_STATE_VERSION, state }, null, 2)}\n`;
}

export function parsePersistedBackup<T extends object>(
  raw: string,
): PersistedEnvelope<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Backup file is not valid JSON");
  }

  if (
    !isObjectRecord(parsed) ||
    typeof parsed.version !== "number" ||
    !Number.isFinite(parsed.version) ||
    !isObjectRecord(parsed.state)
  ) {
    throw new Error("Backup must be a persisted Luy Khnom JSON envelope");
  }

  return { version: parsed.version, state: parsed.state as T };
}
