import { enqueue, readQueue, writeQueue, type SubmissionPayload } from '../queue';

jest.mock('@/src/lib/kv', () => {
  const store: Record<string, string> = {};
  return { kv: {
    set: (k: string, v: string) => { store[k] = v; },
    getString: (k: string) => (k in store ? store[k] : null),
  }};
});

const p = (body: string): SubmissionPayload => ({
  kind: 'idea', category: null, body, install_id: 'x',
  app_version: null, os: null, locale: null,
});

describe('offline queue', () => {
  it('enqueues and reads back in order', () => {
    enqueue(p('a')); enqueue(p('b'));
    expect(readQueue().map((x) => x.body)).toEqual(['a', 'b']);
  });
  it('writeQueue replaces contents', () => {
    writeQueue([p('c')]);
    expect(readQueue().map((x) => x.body)).toEqual(['c']);
  });
  it('empty when nothing stored', () => {
    writeQueue([]);
    expect(readQueue()).toEqual([]);
  });

  it('caps the queue at the most recent 50 entries', () => {
    writeQueue([]);
    for (let i = 0; i < 55; i++) enqueue(p(`item-${i}`));
    const bodies = readQueue().map((x) => x.body);
    expect(bodies).toHaveLength(50);
    expect(bodies[0]).toBe('item-5');
    expect(bodies[49]).toBe('item-54');
  });
});
