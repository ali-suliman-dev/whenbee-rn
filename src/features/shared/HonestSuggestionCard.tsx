import { useEffect, useRef } from 'react';
import { StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';
import { AppText } from '@/src/components/AppText';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useTheme } from '@/src/theme/useTheme';
import { analytics } from '@/src/services/analytics';
import { formatHonestMinutes } from '@/src/lib/time';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// HonestSuggestionCard — the live calibration read (Add Task / live banners).
//
// This is a FORECAST, not a target. The honest number used to read as "set your
// wheel to this", so users dragged their own guess up to match it and the number
// chased them higher (15 → 30 → 60 …). The fix is presentation: a calm, read-only,
// past-tense description of what tasks like this tend to run — decoupled from the
// guess, with no arrow, no "+X more", no upsell.
//
// Sentence-first (2026-07-23 redesign): no display number. The value sits inline
// in one quiet sentence as an amber semibold span — the one honest thing on the
// sheet — with a hairline-divided footer carrying the behavioral reminder
// (pre-data: don't pad your guess; trained: not a target).
//
// Pre-data (a cold category on the population prior) shows a soft RANGE so it can
// never look like a precise 2× target. Once the model has data, free users see the
// single point; the tightening range stays a Pro payoff.
// ──────────────────────────────────────────────────────────────────────────────

// Keeps the value + unit ("25 min", "20–45 min") wrapping as one token.
const NBSP = ' ';

export function HonestSuggestionCard({
  honestMinutes,
  guessMinutes,
  confidence,
  range,
  reasonNote,
  preEstimate,
  categoryName,
}: {
  honestMinutes: number;
  guessMinutes: number;
  /** OPTIONAL. Earned-Readiness of the category; drives the Pro range. */
  confidence?: CalibrationConfidence;
  /** OPTIONAL band the task tends to land in (low/high minutes). */
  range?: HonestRange | null;
  /** OPTIONAL Pro-only B15 note. Display-only — a quiet extra line; never changes
   *  the honest number. */
  reasonNote?: string;
  /** OPTIONAL. True while the estimate is still the population prior (cold category). */
  preEstimate?: boolean;
  /** OPTIONAL category name — grounds the sentence ("your last few X tasks"). */
  categoryName?: string;
}) {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);

  // Pre-data everyone sees a soft range (never a precise target); post-data the
  // tightening range is a Pro payoff, free sees the point. A settled ('honest')
  // category resolves to a point for everyone.
  const showRange =
    range != null &&
    (preEstimate || (isPro && confidence !== undefined && confidence !== 'honest'));

  // Fire honest_range_shown once per distinct range the user looks at (debounced so
  // guess-dialing doesn't spam). Fire-and-forget; never throws into the loop.
  const lastShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showRange || range == null) return;
    const width = range.highMinutes - range.lowMinutes;
    const key = `${confidence ?? 'raw'}|${range.lowMinutes}|${range.highMinutes}|${isPro}`;
    if (lastShownRef.current === key) return;
    lastShownRef.current = key;
    analytics.capture('honest_range_shown', {
      surface: 'add_task',
      confidence: confidence ?? 'raw',
      width_min: Math.round(width / 5) * 5,
      is_pro: isPro,
    });
  }, [showRange, range, confidence, isPro]);

  // ── styles ──
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[4],
    gap: t.space[2],
  };
  const topRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  };
  const eyebrow: TextStyle = {
    fontSize: t.fontSize.xs,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    letterSpacing: t.letterSpacing.wide,
    textTransform: 'uppercase',
    color: t.colors.inkSoft,
  };
  const guessNote: TextStyle = { fontSize: t.fontSize.xs, color: t.colors.inkFaint };
  const sentence: TextStyle = {
    fontSize: t.fontSize.md,
    fontWeight: t.fontWeight.regular as TextStyle['fontWeight'],
    color: t.colors.ink,
    lineHeight: t.fontSize.md * t.lineHeight.normal,
  };
  const sentenceValue: TextStyle = {
    fontSize: t.fontSize.md,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.amberText,
    fontVariant: ['tabular-nums'],
  };
  const noteText: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkSoft };
  const footer: TextStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
    lineHeight: t.fontSize.sm * t.lineHeight.normal,
    marginTop: t.space[3],
    paddingTop: t.space[2.5],
    // A divider hairline (not a card border) — the borderWidth.hairline token is 0
    // in this borderless-card system, so use the platform hairline like InfoRow.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.hairline,
  };

  const formatted = formatHonestMinutes(honestMinutes);
  const pointValue = formatted.unit
    ? `${formatted.value}${NBSP}${formatted.unit}`
    : formatted.value;
  const valueText =
    showRange && range ? `${range.lowMinutes}–${range.highMinutes}${NBSP}min` : pointValue;

  const categoryLabel = categoryName?.toLowerCase() ?? 'similar';
  const sentenceLead = preEstimate
    ? 'Tasks like this usually land around '
    : `Your last few ${categoryLabel} tasks landed around `;
  const footerText = preEstimate
    ? 'No need to pad your guess. This range does it for you. Sharpens as you log.'
    : 'Not a target, just what usually happens. Keep guessing with your gut.';

  const spokenValue =
    showRange && range
      ? `${range.lowMinutes} to ${range.highMinutes} minutes`
      : `${honestMinutes} minutes`;
  const a11yLabel = preEstimate
    ? `Tasks like this usually land around ${spokenValue}. No need to pad your guess — this range does it for you.`
    : `Your last few ${categoryLabel} tasks usually land around ${spokenValue}. Not a target, just what usually happens.`;

  return (
    <View style={card} accessibilityLabel={a11yLabel}>
      <View style={topRow}>
        <AppText style={eyebrow}>{preEstimate ? 'A starting hunch' : 'Usually, for you'}</AppText>
        <AppText style={guessNote}>you guessed {guessMinutes}m</AppText>
      </View>

      <AppText style={sentence}>
        {sentenceLead}
        <AppText style={sentenceValue}>{valueText}</AppText>.
      </AppText>

      {reasonNote ? <AppText style={noteText}>{reasonNote}</AppText> : null}

      <AppText style={footer}>{footerText}</AppText>
    </View>
  );
}
