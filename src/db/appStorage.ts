import * as SQLite from 'expo-sqlite';
import { PERSISTED_APP_STATE_VERSION, type PersistedEnvelope } from './persistedState';

type StateRow = Readonly<{
  payload: string;
}>;

const DB_NAME = 'luy-khnom.db';
const STATE_ID = 'app';

let db: SQLite.SQLiteDatabase | null = null;

function database() {
  if (db) return db;
  db = SQLite.openDatabaseSync(DB_NAME);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

export function loadAppState<T>(): PersistedEnvelope<T> | null {
  const row = database().getFirstSync<StateRow>('SELECT payload FROM app_state WHERE id = ?', STATE_ID);
  if (!row) return null;
  const parsed = JSON.parse(row.payload) as PersistedEnvelope<T>;
  if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number' || !('state' in parsed)) {
    throw new Error('Persisted app state is invalid');
  }
  return parsed;
}

export function saveAppState<T>(state: T) {
  const envelope: PersistedEnvelope<T> = { version: PERSISTED_APP_STATE_VERSION, state };
  database().runSync(
    'INSERT OR REPLACE INTO app_state (id, payload, updated_at) VALUES (?, ?, ?)',
    STATE_ID,
    JSON.stringify(envelope),
    new Date().toISOString(),
  );
}
