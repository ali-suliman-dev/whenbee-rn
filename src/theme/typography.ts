import { tokens } from './tokens';

/**
 * Whenbee typography role scale.
 *
 * Text roles → Plus Jakarta Sans (Jakarta-*)
 * Numeric roles → Inter tabular (Inter-*)
 *
 * Sizes are derived from `tokens.fontSize` (the single numeric scale) so the type
 * ramp is editable in one place — this layer only assigns role → family / size /
 * line-height / tracking.
 */
const fs = tokens.fontSize;

export const type = {
  display: { fontFamily: 'Jakarta-ExtraBold', fontSize: fs['2xl'], lineHeight: 33, letterSpacing: -0.75 },
  title: { fontFamily: 'Jakarta-ExtraBold', fontSize: fs.title, lineHeight: 31, letterSpacing: -0.6 },
  titleSm: { fontFamily: 'Jakarta-ExtraBold', fontSize: fs.titleSm, lineHeight: 23, letterSpacing: -0.3 },
  subtitle: { fontFamily: 'Jakarta-Bold', fontSize: fs.subtitle, lineHeight: 27, letterSpacing: -0.2 },
  heading: { fontFamily: 'Jakarta-Bold', fontSize: fs.base, lineHeight: 22 },
  bodyLg: { fontFamily: 'Jakarta-Bold', fontSize: fs.bodyLg, lineHeight: 22 },
  body: { fontFamily: 'Jakarta-Regular', fontSize: fs.base, lineHeight: 23 },
  bodySm: { fontFamily: 'Jakarta-Medium', fontSize: fs.caption, lineHeight: 20 },
  bodySmBold: { fontFamily: 'Jakarta-Bold', fontSize: fs.bodySm, lineHeight: 20 },
  // Semibold sibling of `bodySmBold` — the option-row label weight the reward
  // context questions want (semibold, not the heavier bold).
  bodySmSemibold: { fontFamily: 'Jakarta-SemiBold', fontSize: fs.bodySm, lineHeight: 20 },
  caption: { fontFamily: 'Jakarta-Medium', fontSize: fs.caption, lineHeight: 18 },
  captionBold: { fontFamily: 'Jakarta-Bold', fontSize: fs.caption, lineHeight: 18 },
  micro: { fontFamily: 'Jakarta-Regular', fontSize: fs.micro, lineHeight: 16 },
  eyebrow: { fontFamily: 'Jakarta-Bold', fontSize: fs.xs, lineHeight: 14, letterSpacing: 2, textTransform: 'uppercase' as const },
  // One step smaller than `eyebrow` — the Today screen's four section labels
  // (TASKS, DONE TODAY, Calendar, TODAY'S ROUTINES). Tracking is tightened
  // (not kept at eyebrow's 2px) because wide letter-spacing at a smaller size
  // inflates perceived size back toward eyebrow's footprint.
  eyebrowSm: { fontFamily: 'Jakarta-Bold', fontSize: fs.crumb, lineHeight: 13, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  // Tiny (10px) word-part label — the rail/histogram axis + plan/goal/guess
  // labels ("planned", "guess", "38m"/"73m" axis ends). Semibold for legibility
  // at this size against the faint numeric neighbour it usually sits beside.
  labelXs: { fontFamily: 'Jakarta-SemiBold', fontSize: fs.xs, lineHeight: 14 },
  // Tiny (10px) tabular numeral — the bold number embedded inside a `labelXs`
  // span (e.g. the "38" in "38m planned", the "+30" in "+30m").
  numMicro: { fontFamily: 'Inter-Bold', fontSize: fs.xs, lineHeight: 14, letterSpacing: 0, fontVariant: ['tabular-nums'] as const },
  // Caption-sized (12px) tabular numeral — the bold number embedded inside a
  // `caption`/`bodySm` span (e.g. "1.8×" in the ratio chip, "64" in "64 logs").
  numCaption: { fontFamily: 'Inter-Bold', fontSize: fs.caption, lineHeight: 18, letterSpacing: -0.2, fontVariant: ['tabular-nums'] as const },
  // Base-sized (14px) tabular numeral — the value in the Live-Timer info-row
  // ledger ("5m → ~5m", "13:50"). SemiBold so clocks/durations read as data and
  // stay column-aligned against their muted `labelXs` row label.
  numLedger: { fontFamily: 'Inter-SemiBold', fontSize: fs.base, lineHeight: 18, letterSpacing: -0.2, fontVariant: ['tabular-nums'] as const },
  timerNumeral: { fontFamily: 'Inter-SemiBold', fontSize: fs.timer, lineHeight: 78, letterSpacing: -2.3, fontVariant: ['tabular-nums'] as const },
  timerClock: { fontFamily: 'Inter-SemiBold', fontSize: fs.timerClock, lineHeight: 70, letterSpacing: -1.5, fontVariant: ['tabular-nums'] as const },
  honestNumberLg: { fontFamily: 'Inter-Bold', fontSize: fs.honestLg, lineHeight: 38, letterSpacing: -0.9, fontVariant: ['tabular-nums'] as const },
  honestNumberXl: { fontFamily: 'Inter-Bold', fontSize: fs.honest, lineHeight: 42, letterSpacing: -1.0, fontVariant: ['tabular-nums'] as const },
  honestNumberHero: { fontFamily: 'Inter-Bold', fontSize: fs.honestHero, lineHeight: 48, letterSpacing: -1.2, fontVariant: ['tabular-nums'] as const },
  bigNumber: { fontFamily: 'Inter-Bold', fontSize: fs.lg, lineHeight: 24, letterSpacing: -0.4, fontVariant: ['tabular-nums'] as const },
  honestNumberMd: { fontFamily: 'Inter-Bold', fontSize: fs.xl, lineHeight: 28, letterSpacing: -0.5, fontVariant: ['tabular-nums'] as const },
  multiplier: { fontFamily: 'Inter-Bold', fontSize: fs.subtitle, lineHeight: 24, letterSpacing: -0.4, fontVariant: ['tabular-nums'] as const },
} as const;
