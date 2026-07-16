import 'react-native-get-random-values';
import { kv } from '@/src/lib/kv';

const KEY = 'feedback.installId';

function uuid(): string {
  // crypto.randomUUID is available via react-native-get-random-values polyfill.
  return (globalThis.crypto as Crypto).randomUUID();
}

export function getInstallId(): string {
  const existing = kv.getString(KEY);
  if (existing) return existing;
  const id = uuid();
  kv.set(KEY, id);
  return id;
}
