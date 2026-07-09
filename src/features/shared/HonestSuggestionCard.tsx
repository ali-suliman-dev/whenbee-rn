import { useEffect, useRef } from 'react';
import { StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';
import { AppText } from '@/src/components/AppText';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useTheme } from '@/src/theme/useTheme';
import { analytics } from '@/src/services/analytics';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// HonestSuggestionCard — the live calibration read (Add Task / live banners).
//
// This is a FORECAST, not a target. The honest number used to read as "set your
// wheel to this", so users dragged their own guess up to match it and the number
// chased them higher (15 → 30 → 60 …). The fix is presentation: a calm, read-only,
// past-tense description of what tasks like this tend to run — decoupled from the
// guess, with no arrow, no "+X more", no upsell. The number wears amber (the honey
// accent) because it's the one honest thing on the sheet; everything around it is
// quiet ink so nothing reads as a call to action.
//
// Pre-data (a cold category on the population prior) shows a soft RANGE so it can
// never look like a precise 2× target. Once the model has data, free users see the
// single point; the tightening range stays a Pro payoff.
// ──────────────────────────────────────────────────────────────────────────────

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
  /** OPTIONAL category name — grounds the provenance line ("your last few X tasks"). */
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
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    letterSpacing: t.letterSpacing.wide,
    textTransform: 'uppercase',
    color: t.colors.inkSoft,
  };
  const guessNote: TextStyle = { fontSize: t.fontSize.xs, color: t.colors.inkFaint };
  const headline: TextStyle = {
    fontSize: t.fontSize.base,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.ink,
    lineHeight: t.fontSize.base * t.lineHeight.normal,
  };
  const numberRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[2] };
  const number: TextStyle = {
    fontSize: t.fontSize.honestCard,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    // amberText reads AA in BOTH modes; the raw `accent` fails contrast on light.
    color: t.colors.amberText,
    fontVariant: ['tabular-nums'],
    letterSpacing: t.letterSpacing.tight,
  };
  const unit: TextStyle = {
    fontSize: t.fontSize.md,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.inkSoft,
  };
  const provenance: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkSoft };
  const noteText: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkSoft };
  const notGoal: TextStyle = {
    fontSize: t.fontSize.xs,
    color: t.colors.inkFaint,
    lineHeight: t.fontSize.xs * t.lineHeight.normal,
    marginTop: t.space[2],
    paddingTop: t.space[2],
    // A divider hairline (not a card border) — the borderWidth.hairline token is 0
    // in this borderless-card system, so use the platform hairline like InfoRow.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.hairline,
  };

  const numberText = showRange && range
    ? `~${range.lowMinutes}–${range.highMinutes}`
    : `~${honestMinutes}`;

  const provenanceText = preEstimate
    ? 'a rough range from optimists like you · sharpens as you log'
    : `from your last few ${categoryName?.toLowerCase() ?? 'similar'} tasks`;

  const a11yLabel = showRange && range
    ? `Tasks like this usually take ${range.lowMinutes} to ${range.highMinutes} minutes.`
    : `Honest estimate about ${honestMinutes} minutes for tasks like this. Not a goal, just what tends to happen.`;

  return (
    <View style={card} accessibilityLabel={a11yLabel}>
      <View style={topRow}>
        <AppText style={eyebrow}>{preEstimate ? 'A starting hunch' : 'Usually, for you'}</AppText>
        <AppText style={guessNote}>you guessed {guessMinutes}m</AppText>
      </View>

      {preEstimate ? (
        <AppText style={headline}>Tasks like this often run a bit longer than they feel.</AppText>
      ) : null}

      <View style={numberRow}>
        <AppText style={number}>{numberText}</AppText>
        <AppText style={unit}>min</AppText>
      </View>

      <AppText style={provenance}>{provenanceText}</AppText>

      {reasonNote ? <AppText style={noteText}>{reasonNote}</AppText> : null}

      {/* The pre-data headline already carries the "not a goal" reframe, so the
          divider line only shows once the category is trained. */}
      {!preEstimate ? (
        <AppText style={notGoal}>
          Not a goal to hit — just what tends to happen. Keep guessing what feels right.
        </AppText>
      ) : null}
    </View>
  );
}
