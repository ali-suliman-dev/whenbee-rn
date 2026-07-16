import { kv } from '@/src/lib/kv';

const KEY = 'feedback.installId';

/**
 * A v4-shaped UUID string built from `Math.random()` — no `crypto.randomUUID()`
 * (unavailable on the Hermes/device runtime; `react-native-get-random-values`
 * only shims `getRandomValues`, not `randomUUID`) and no uuid dependency.
 * Collision-resistant enough for an anonymous install id, and matches the
 * Postgres `uuid` column shape the feedback tables expect.
 */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Mints an anonymous install id once, persisted in kv, stable across calls. */
export function getInstallId(): string {
  const existing = kv.getString(KEY);
  if (existing) return existing;
  const id = uuid();
  kv.set(KEY, id);
  return id;
}
