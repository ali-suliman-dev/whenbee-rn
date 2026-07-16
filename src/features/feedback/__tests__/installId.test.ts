import { getInstallId } from '../installId';
import { kv } from '@/src/lib/kv';

jest.mock('@/src/lib/kv', () => {
  const store: Record<string, string> = {};
  return {
    kv: {
      set: (k: string, v: string) => { store[k] = v; },
      getString: (k: string) => (k in store ? store[k] : null),
    },
  };
});

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('getInstallId', () => {
  it('mints once and is stable across calls', () => {
    const a = getInstallId();
    const b = getInstallId();
    expect(a).toMatch(UUID_V4_RE);
    expect(a).toBe(b);
    expect(kv.getString('feedback.installId')).toBe(a);
  });
});
