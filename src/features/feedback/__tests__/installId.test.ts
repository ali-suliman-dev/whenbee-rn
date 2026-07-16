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

describe('getInstallId', () => {
  it('mints once and is stable across calls', () => {
    const a = getInstallId();
    const b = getInstallId();
    expect(a).toMatch(/^[0-9a-f-]{36}$/i);
    expect(a).toBe(b);
    expect(kv.getString('feedback.installId')).toBe(a);
  });
});
