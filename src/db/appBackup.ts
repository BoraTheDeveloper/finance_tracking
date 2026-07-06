import { PERSISTED_APP_STATE_VERSION, type PersistedEnvelope } from './persistedState';

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function backupFileName(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `luy-khnom-backup-${stamp}.json`;
}

export function stringifyPersistedBackup<T extends object>(state: T) {
  return `${JSON.stringify({ version: PERSISTED_APP_STATE_VERSION, state }, null, 2)}\n`;
}

export function parsePersistedBackup<T extends object>(raw: string): PersistedEnvelope<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Backup file is not valid JSON');
  }

  if (!isObjectRecord(parsed) || typeof parsed.version !== 'number' || !Number.isFinite(parsed.version) || !isObjectRecord(parsed.state)) {
    throw new Error('Backup must be a persisted Luy Khnom JSON envelope');
  }

  return { version: parsed.version, state: parsed.state as T };
}
