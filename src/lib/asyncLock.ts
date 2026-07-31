// Serialize async tasks per string key: two withLock(key, ...) calls for the
// SAME key run one-after-another (the 2nd starts only after the 1st settles);
// different keys run concurrently. Used to make notification cancel→schedule
// atomic so overlapping calls can't orphan an OS-scheduled id.
const tails = new Map<string, Promise<unknown>>();

export function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  // Run `task` after `prev` SETTLES, whether it resolved or rejected, so one
  // failed task never blocks the queue and never skips the next task.
  const run = prev.then(() => task(), () => task());
  // Keep the chain alive but swallow settlement so stored tail never rejects.
  tails.set(key, run.then(() => undefined, () => undefined));
  return run;
}
