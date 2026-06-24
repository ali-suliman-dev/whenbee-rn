// ──────────────────────────────────────────────────────────────────────────────
// niceAxis — pick a clean, discrete y-axis for a small chart.
//
// Given the raw data and a fixed step (0.1× for multiplier, 5% for accuracy), it
// rounds the domain OUT to whole steps, adds a little headroom so the top point
// never sits glued to the top gridline, and widens (symmetrically, hi-then-lo) to
// a minimum span so a flat series reads as a calm line inside a real range rather
// than a slab hugging its own data. Bounds clamp (e.g. 0–100%). Pure: no React,
// no clock — unit-tested in __tests__/chartAxis.test.ts.
// ──────────────────────────────────────────────────────────────────────────────

export interface NiceAxis {
  /** Bottom of the axis (a multiple of `step`). */
  min: number;
  /** Top of the axis (a multiple of `step`). */
  max: number;
  step: number;
  /** Ascending tick values from `min` to `max`, evenly spaced by `step`. */
  ticks: number[];
}

export interface NiceAxisOpts {
  /** Distance between gridlines, in data units (0.1, 5, 20…). */
  step: number;
  /** Hard floor for the axis (e.g. 0 for a percentage). Default: none. */
  clampMin?: number;
  /** Hard ceiling for the axis (e.g. 100 for a percentage). Default: none. */
  clampMax?: number;
  /** Minimum number of steps the axis must span — gives flat data breathing room. */
  minSpanSteps?: number;
  /** A value the domain must include (e.g. the 1.0× ideal baseline). */
  anchorValue?: number;
}

const EPS = 1e-9;

export function niceAxis(values: number[], opts: NiceAxisOpts): NiceAxis {
  const { step } = opts;
  const clampMin = opts.clampMin ?? -Infinity;
  const clampMax = opts.clampMax ?? Infinity;
  const minSpanSteps = Math.max(1, opts.minSpanSteps ?? 1);

  const pool = opts.anchorValue != null ? [...values, opts.anchorValue] : values.slice();
  if (pool.length === 0) pool.push(0);
  const dataMin = Math.min(...pool);
  const dataMax = Math.max(...pool);

  // Everything below is in integer step-units to avoid float dust.
  const toU = (v: number) => v / step;
  let loU = Math.floor(toU(dataMin) + EPS);
  let hiU = Math.ceil(toU(dataMax) - EPS);
  // Headroom: never let the highest point land exactly on the top gridline.
  if (hiU - toU(dataMax) < EPS) hiU += 1;
  if (hiU <= loU) hiU = loU + 1;

  const clampLoU = clampMin === -Infinity ? -Infinity : Math.round(toU(clampMin));
  const clampHiU = clampMax === Infinity ? Infinity : Math.round(toU(clampMax));

  // Widen toward the minimum span, alternating up/down so the data stays centred.
  let growUp = true;
  let guard = 0;
  while (hiU - loU < minSpanSteps && guard++ < 1000) {
    const canUp = hiU + 1 <= clampHiU;
    const canDown = loU - 1 >= clampLoU;
    if (growUp && canUp) hiU += 1;
    else if (!growUp && canDown) loU -= 1;
    else if (canUp) hiU += 1;
    else if (canDown) loU -= 1;
    else break;
    growUp = !growUp;
  }

  if (loU < clampLoU) loU = clampLoU;
  if (hiU > clampHiU) hiU = clampHiU;
  if (hiU <= loU) hiU = loU + 1;

  const at = (u: number) => Number((u * step).toFixed(6));
  const ticks: number[] = [];
  for (let u = loU; u <= hiU + EPS; u++) ticks.push(at(u));
  return { min: at(loU), max: at(hiU), step, ticks };
}
