import { withLock } from '@/src/lib/asyncLock';

/** Deferred promise helper — lets a test control exactly when a task resolves. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('withLock', () => {
  it('serializes two calls on the SAME key — never interleaves', async () => {
    const events: string[] = [];
    const d1 = deferred<void>();
    const d2 = deferred<void>();

    const p1 = withLock('k', async () => {
      events.push('1start');
      await d1.promise;
      events.push('1end');
    });
    const p2 = withLock('k', async () => {
      events.push('2start');
      await d2.promise;
      events.push('2end');
    });

    // Let microtasks flush — only task 1 should have started.
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['1start']);

    d1.resolve();
    await p1;
    // After task 1 settles, task 2 should now have started (and possibly finished
    // if we let its deferred resolve too).
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['1start', '1end', '2start']);

    d2.resolve();
    await p2;
    expect(events).toEqual(['1start', '1end', '2start', '2end']);
  });

  it('a rejecting task does not block or skip the next task on the same key', async () => {
    const events: string[] = [];

    const p1 = withLock('k2', async () => {
      events.push('1');
      throw new Error('boom');
    });
    const p2 = withLock('k2', async () => {
      events.push('2');
      return 'ok';
    });

    await expect(p1).rejects.toThrow('boom');
    await expect(p2).resolves.toBe('ok');
    expect(events).toEqual(['1', '2']);
  });

  it('different keys run concurrently (do not serialize across keys)', async () => {
    const events: string[] = [];
    const dA = deferred<void>();

    const pA = withLock('a', async () => {
      events.push('Astart');
      await dA.promise;
      events.push('Aend');
    });
    const pB = withLock('b', async () => {
      events.push('Bstart');
      events.push('Bend');
    });

    await pB;
    // B (a different key) should have completed WITHOUT waiting for A, which is
    // still blocked on its deferred.
    expect(events).toEqual(['Astart', 'Bstart', 'Bend']);

    dA.resolve();
    await pA;
    expect(events).toEqual(['Astart', 'Bstart', 'Bend', 'Aend']);
  });

  it('surfaces the resolved value to the caller', async () => {
    const result = await withLock('v', async () => 42);
    expect(result).toBe(42);
  });

  it('propagates the rejection to the caller', async () => {
    await expect(
      withLock('e', async () => {
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');
  });
});
