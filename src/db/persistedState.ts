export type PersistedEnvelope<T> = Readonly<{
  version: number;
  state: T;
}>;

export const PERSISTED_APP_STATE_VERSION = 1;
