import { describe, expect, it } from 'vitest';
import { backupFileName, deriveRestorePreview, parsePersistedBackup, stringifyPersistedBackup } from '../src/db/appBackup';
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

  it('derives restore preview counts and backup date from a parsed envelope', () => {
    const state = {
      lastActiveDay: '2026-07-07',
      categories: [{ key: 'food' }, { key: 'transport' }],
      expenses: [{ id: 'expense-1', date: '2026-07-06' }, { id: 'expense-2', date: '2026-07-07' }],
      goals: [{ id: 'goal-1' }],
      ious: [],
    };
    const backup = parsePersistedBackup<typeof state>(stringifyPersistedBackup(state));

    expect(deriveRestorePreview(backup)).toEqual({
      backupDate: '2026-07-07',
      counts: {
        categories: 2,
        expenses: 2,
        goals: 1,
        ious: 0,
      },
    });
  });

  it('falls back to latest expense date and zeroes missing preview collections', () => {
    const backup = parsePersistedBackup<{ expenses: { date?: unknown }[] }>(stringifyPersistedBackup({
      expenses: [
        { date: '2026-07-05' },
        { date: 'not-a-day' },
        { date: '2026-07-08' },
      ],
    }));

    expect(deriveRestorePreview(backup)).toEqual({
      backupDate: '2026-07-08',
      counts: {
        categories: 0,
        expenses: 3,
        goals: 0,
        ious: 0,
      },
    });
  });

  it('ignores impossible backup dates and non-object expense rows in restore preview', () => {
    const backup = parsePersistedBackup<{
      lastActiveDay: string;
      expenses: unknown[];
      goals: string;
    }>(stringifyPersistedBackup({
      lastActiveDay: '2026-02-30',
      expenses: [
        { date: '2026-02-28' },
        'not an expense',
        { date: '2026-02-31' },
      ],
      goals: 'not an array',
    }));

    expect(deriveRestorePreview(backup)).toEqual({
      backupDate: '2026-02-28',
      counts: {
        categories: 0,
        expenses: 3,
        goals: 0,
        ious: 0,
      },
    });
  });

  it('refuses to preview envelopes whose state is not an object', () => {
    expect(deriveRestorePreview({ version: PERSISTED_APP_STATE_VERSION, state: [] })).toBeNull();
  });

  it('creates a share-safe JSON file name', () => {
    expect(backupFileName(new Date('2026-07-06T01:02:03.004Z'))).toBe('luy-khnom-backup-2026-07-06T01-02-03-004Z.json');
  });
});
