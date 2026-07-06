import { describe, expect, it } from 'vitest';
import { backupFileName, parsePersistedBackup, stringifyPersistedBackup } from '../src/db/appBackup';
import { PERSISTED_APP_STATE_VERSION } from '../src/db/persistedState';

describe('app JSON backups', () => {
  it('writes a persisted envelope and reads it back', () => {
    const state = { salary: 1200, expenses: [{ id: 'expense-1', amount: 5 }] };
    const raw = stringifyPersistedBackup(state);
    const backup = parsePersistedBackup<typeof state>(raw);

    expect(backup).toEqual({ version: PERSISTED_APP_STATE_VERSION, state });
  });

  it('rejects non-JSON input', () => {
    expect(() => parsePersistedBackup('not json')).toThrow('Backup file is not valid JSON');
  });

  it('rejects JSON without a numeric version and object state', () => {
    expect(() => parsePersistedBackup('{"version":"1","state":{}}')).toThrow('persisted Luy Khnom JSON envelope');
    expect(() => parsePersistedBackup('{"version":1,"state":[]}')).toThrow('persisted Luy Khnom JSON envelope');
  });

  it('creates a share-safe JSON file name', () => {
    expect(backupFileName(new Date('2026-07-06T01:02:03.004Z'))).toBe('luy-khnom-backup-2026-07-06T01-02-03-004Z.json');
  });
});
