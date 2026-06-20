import { useEffect, useRef } from 'react';
import { View, Pressable, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppText } from '@/src/components/AppText';
import { HonestBand } from '@/src/components/HonestBand';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useTheme } from '@/src/theme/useTheme';
import { analytics } from '@/src/services/analytics';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// HonestSuggestionCard — the live calibration payoff (Add Task / live banners).
//
// The honest number is the app's whole point, so it gets its OWN colour identity:
// amber (the honey / ripen accent) — not the indigo the CTA + selections already
// own. That split is what stops the screen reading as an indigo mush and gives it
// a clean focal order: type → pick → see the honest number → act.
//
// Free users see the single honest POINT number (the core loop is never fogged).
// Pro unlocks the RANGE the task tends to land in, drawn as a slim band that
// narrows as the model learns them. Free users see a quiet locked-bracket
// affordance that shows the SHAPE of the range without revealing their numbers.
// ──────────────────────────────────────────────────────────────────────────────

export function HonestSuggestionCard({
  honestMinutes,
  guessMinutes,
  confidence,
  range,
  reasonNote,
  preEstimate,
}: {
  honestMinutes: number;
  guessMinutes: number;
  /** OPTIONAL. When omitted (live-guess banners), the tight line renders as before. */
  confidence?: CalibrationConfidence;
  /** OPTIONAL band. Shown only with a non-honest confidence; else degrade to tight. */
  range?: HonestRange | null;
  /** OPTIONAL Pro-only B15 note. Display-only — a quiet second line under the
   *  honest line; never changes the honest number or delta. */
  reasonNote?: string;
  /** OPTIONAL. When true and no reasonNote, shows the pre-estimate label. */
  preEstimate?: boolean;
}) {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);
  const delta = honestMinutes - guessMinutes;

  // A learning surface (Add Task / live banner) passes a confidence; bare live-guess
  // banners pass neither confidence nor range and keep their original shape.
  const isLearningSurface = confidence !== undefined && range != null;
  const hasBand = isLearningSurface && confidence !== 'honest';
  // The drawn band track is Pro-only and shown once past the raw state (raw shows a
  // "roughly" caption instead of a track, per the spec's states table).
  const showProBand = hasBand && isPro && confidence !== 'raw';
  const showRoughly = hasBand && isPro && confidence === 'raw';

  // Fire honest_range_shown once per distinct band the user looks at (debounced so
  // guess-dialing doesn't spam). Fire-and-forget; never throws into the loop.
  const lastShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hasBand || range == null || confidence === undefined) return;
    const width = range.highMinutes - range.lowMinutes;
    const key = `${confidence}|${range.lowMinutes}|${range.highMinutes}|${isPro}`;
    if (lastShownRef.current === key) return;
    lastShownRef.current = key;
    analytics.capture('honest_range_shown', {
      surface: 'add_task',
      confidence,
      width_min: Math.round(width / 5) * 5,
      is_pro: isPro,
    });
  }, [hasBand, range, confidence, isPro]);

  const openPaywall = () => {
    analytics.capture('honest_range_locked_tap', { surface: 'add_task' });
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'honest_range' } });
  };

  const card: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[2],
  };
  const coin: ViewStyle = {
    width: t.space[8],
    height: t.space[8],
    borderRadius: t.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.accentCoin,
  };
  const content: ViewStyle = { flex: 1, gap: t.space[0.5] };
  const line: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const noteText: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkSoft };
  const lead: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.inkSoft,
    marginRight: t.space[1],
  };
  const num: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.accent,
  };
  const unit: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    color: t.colors.inkSoft,
  };
  const dot: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkFaint, marginHorizontal: t.space[1] };
  const more: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.accent,
  };
  const moreMuted: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkSoft };
  const learningSuffix: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkSoft };
  const roughly: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkSoft };
  // The locked bracket affordance — a faint bracket glyph + "Range" micro label.
  // It communicates "there's a range here" without drawing the user's numbers.
  const lockRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[0.5], marginLeft: t.space[1] };
  const lockLabel: TextStyle = { fontSize: t.fontSize.xs, color: t.colors.inkFaint };
  const bandRow: ViewStyle = { marginTop: t.space[1], paddingHorizontal: t.space[2] };

  const a11yLabel = (() => {
    if (showProBand && range) {
      return `Honest range ${range.lowMinutes} to ${range.highMinutes} minutes${confidence === 'setting' ? ', still learning' : ''}.`;
    }
    if (showRoughly && range) {
      return `Still learning. Roughly ${range.lowMinutes} to ${range.highMinutes} minutes.`;
    }
    const base =
      delta > 0
        ? `Honest estimate about ${honestMinutes} minutes, ${delta} more than your guess`
        : `Honest estimate about ${honestMinutes} minutes`;
    if (preEstimate && !hasBand) {
      return `${base}, starting estimate, sharpens as you log`;
    }
    return base;
  })();

  return (
    <View style={card} accessibilityLabel={a11yLabel}>
      <View style={coin}>
        <Ionicons name="trending-up" size={t.iconSize.sm} color={t.colors.accent} />
      </View>
      <View style={content}>
        <View style={line}>
          <AppText style={lead}>Honestly</AppText>
          {showProBand && range ? (
            <>
              <AppText style={num}>
                {range.lowMinutes}–{range.highMinutes}
              </AppText>
              <AppText style={unit}>m</AppText>
              {confidence === 'setting' ? (
                <>
                  <AppText style={dot}>·</AppText>
                  <AppText style={learningSuffix}>still learning</AppText>
                </>
              ) : null}
            </>
          ) : showRoughly && range ? (
            <AppText style={roughly}>
              Still learning — roughly {range.lowMinutes}–{range.highMinutes}m
            </AppText>
          ) : (
            <>
              <AppText style={num}>~{honestMinutes}</AppText>
              <AppText style={unit}>m</AppText>
              {delta > 0 ? (
                <>
                  <AppText style={dot}>·</AppText>
                  <AppText style={more}>+{delta}m</AppText>
                  <AppText style={moreMuted}> more</AppText>
                </>
              ) : null}
              {/* Free, learning surface: the locked-bracket teaser (no real numbers). */}
              {hasBand && !isPro ? (
                <Pressable
                  onPress={openPaywall}
                  accessibilityRole="button"
                  accessibilityLabel="Unlock the honest range with Pro."
                >
                  <View style={lockRow}>
                    <Ionicons name="code-outline" size={t.iconSize.xs} color={t.colors.inkFaint} />
                    <AppText style={lockLabel}>Range</AppText>
                  </View>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
        {showProBand && range ? (
          <View style={bandRow}>
            <HonestBand
              range={range}
              point={honestMinutes}
              confidence={confidence ?? 'setting'}
              height={t.progress.track}
            />
          </View>
        ) : null}
        {reasonNote ? (
          <AppText style={noteText}>{reasonNote}</AppText>
        ) : preEstimate ? (
          <AppText style={noteText}>Starting estimate · sharpens as you log</AppText>
        ) : null}
      </View>
    </View>
  );
}
