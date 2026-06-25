/**
 * Focus-aware task ordering — pure helper (no Date / IO).
 *
 * When a focus window is defined (both bounds non-null), returns a stable
 * partition that surfaces "deep" (high-bias) tasks first so the backward
 * scheduler tends to land them inside the learned focus band:
 *
 *   [deep₁, deep₂, …] ++ [light₁, light₂, …]
 *
 * Each group preserves its original relative order (stable sort).
 * When either focus-window bound is null, returns a copy in the original
 * order (identity — no reorder). Never mutates the input array.
 */
export function orderForFocus<T>(
  tasks: readonly T[],
  opts: {
    focusWindowStartMin: number | null;
    focusWindowEndMin: number | null;
    isDeep: (t: T) => boolean;
  },
): T[] {
  const { focusWindowStartMin, focusWindowEndMin, isDeep } = opts;

  // No focus window → identity copy
  if (focusWindowStartMin === null || focusWindowEndMin === null) {
    return tasks.slice();
  }

  // Stable partition: deep tasks first, then light, each group in original order
  const deep: T[] = [];
  const light: T[] = [];

  for (const task of tasks) {
    if (isDeep(task)) {
      deep.push(task);
    } else {
      light.push(task);
    }
  }

  return [...deep, ...light];
}
