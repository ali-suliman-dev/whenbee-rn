import type { CalendarEvent } from '@/src/services/calendar';

// ──────────────────────────────────────────────────────────────────────────────
// buildHonestDay — PURE. No IO, no clock-from-inside (nowMs + day bounds are
// passed in). Maps each event title → a tracked category, inflates each block by
// that category's effective multiplier M, cascades later blocks forward so an
// overrun never overlaps the next one, and reports the day-end shift + whether
// the honest day overflows the day-end bound.
//
// "Honest" here is the same honest number the rest of the app shows: planned
// duration × M. We never shrink a block (M < 1 is rare but allowed); we never
// pull a later event earlier than the user scheduled it — only push it later.
// ──────────────────────────────────────────────────────────────────────────────

const MS_PER_MIN = 60_000;

/** A scheduled block in either the planned (before) or honest (after) timeline. */
export interface HonestBlock {
  id: string;
  title: string;
  /** Resolved category id, or null when the title matched no keyword. */
  categoryId: string | null;
  startMs: number;
  endMs: number;
  durationMin: number;
}

export interface HonestDayResult {
  before: HonestBlock[];
  after: HonestBlock[];
  /** Minutes from local midnight to the planned last block's end (null if empty). */
  dayEndBeforeMin: number | null;
  /** Minutes from local midnight to the honest last block's end (null if empty). */
  dayEndAfterMin: number | null;
  /** True when the honest day runs past the realistic day-end bound. */
  overflowsDay: boolean;
}

interface BuildHonestDayOpts {
  /** Current time (epoch ms). Reserved for callers; the math is clock-free. */
  nowMs: number;
  /** Realistic day-end bound (epoch ms). Past this, the day "won't fit". */
  dayEndMs: number;
  /** Multiplier for unknown titles / categories without a learned stat. */
  defaultMultiplier: number;
}

/** Category id → ordered title keywords. First match wins (specific before broad). */
const CATEGORY_KEYWORDS: readonly (readonly [string, readonly string[]])[] = [
  ['commute', ['commute', 'drive', 'travel', 'transit']],
  ['calls', ['call', 'meeting', 'standup', 'sync', '1:1', 'interview']],
  ['email', ['email', 'inbox', 'reply', 'respond']],
  ['writing', ['write', 'writing', 'draft', 'doc', 'proposal', 'report', 'spec', 'blog']],
  ['creative', ['design', 'creative', 'sketch', 'edit', 'brainstorm']],
  ['admin', ['admin', 'invoice', 'expense', 'paperwork', 'taxes', 'form']],
  ['cooking', ['cook', 'cooking', 'meal', 'dinner', 'lunch', 'prep']],
  ['cleaning', ['clean', 'cleaning', 'tidy', 'laundry', 'dishes', 'chores']],
  ['getting_ready', ['get ready', 'getting ready', 'shower', 'dress', 'morning routine']],
  ['errands', ['errand', 'shop', 'grocery', 'pick up', 'pickup', 'store']],
];

/**
 * Resolve a category id from an event title by keyword, case-insensitively.
 * Returns null when nothing matches (caller falls back to the default M).
 */
export function categoryForTitle(title: string): string | null {
  const haystack = title.toLowerCase();
  for (const [categoryId, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) return categoryId;
  }
  return null;
}

/** Minutes between two epoch-ms timestamps (never negative). */
function durationMinFrom(startMs: number, endMs: number): number {
  return Math.max(0, Math.round((endMs - startMs) / MS_PER_MIN));
}

/** Effective multiplier for one event: learned stat → else the default M. */
function multiplierFor(
  categoryId: string | null,
  statsByCategory: Record<string, { mEffective: number }>,
  defaultMultiplier: number,
): number {
  if (categoryId === null) return defaultMultiplier;
  return statsByCategory[categoryId]?.mEffective ?? defaultMultiplier;
}

/** Minutes from local midnight to `ms` (the day-end readout the UI shows). */
function minutesFromMidnight(ms: number): number {
  const midnight = new Date(ms);
  midnight.setHours(0, 0, 0, 0);
  return Math.round((ms - midnight.getTime()) / MS_PER_MIN);
}

function toBeforeBlock(
  event: CalendarEvent,
  statsByCategory: Record<string, { mEffective: number }>,
): HonestBlock {
  const categoryId = categoryForTitle(event.title);
  return {
    id: event.id,
    title: event.title,
    categoryId,
    startMs: event.startMs,
    endMs: event.endMs,
    durationMin: durationMinFrom(event.startMs, event.endMs),
  };
}

export function buildHonestDay(
  events: readonly CalendarEvent[],
  statsByCategory: Record<string, { mEffective: number }>,
  opts: BuildHonestDayOpts,
): HonestDayResult {
  // Sort a COPY by start time so the cascade is order-correct and inputs aren't mutated.
  const sorted = [...events].sort((a, b) => a.startMs - b.startMs);

  const before = sorted.map((e) => toBeforeBlock(e, statsByCategory));

  // Cascade forward: each honest block starts no earlier than the previous honest
  // block's end, but keeps its own original start when there's a real gap.
  let cursorMs = -Infinity;
  const after: HonestBlock[] = before.map((block) => {
    const m = multiplierFor(block.categoryId, statsByCategory, opts.defaultMultiplier);
    const honestDurationMin = Math.round(block.durationMin * m);
    const startMs = Math.max(block.startMs, cursorMs);
    const endMs = startMs + honestDurationMin * MS_PER_MIN;
    cursorMs = endMs;
    return { ...block, startMs, endMs, durationMin: honestDurationMin };
  });

  const lastBefore = before[before.length - 1];
  const lastAfter = after[after.length - 1];
  const dayEndBeforeMin = lastBefore ? minutesFromMidnight(lastBefore.endMs) : null;
  const dayEndAfterMin = lastAfter ? minutesFromMidnight(lastAfter.endMs) : null;

  const overflowsDay = lastAfter ? lastAfter.endMs > opts.dayEndMs : false;

  return { before, after, dayEndBeforeMin, dayEndAfterMin, overflowsDay };
}
