import { View, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// HonestSuggestionCard — the live calibration payoff (Add Task / live banners).
//
// The honest number is the app's whole point, so it gets its OWN colour identity:
// amber (the honey / ripen accent) — not the indigo the CTA + selections already
// own. That split is what stops the screen reading as an indigo mush and gives it
// a clean focal order: type → pick → see the honest number → act.
//
// One simple line: [honey disc] "Honestly ~10m · +5m more". Type is held to a
// single 12 (sm) step — the number reads as the hero through weight + colour,
// not size. The delta is shown only when honest > guess (the
// optimism-bias case). No border (the app runs flat, fills carry hierarchy).
// ──────────────────────────────────────────────────────────────────────────────

export function HonestSuggestionCard({
  honestMinutes,
  guessMinutes,
  confidence,
  range,
  reasonNote,
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
}) {
  const t = useTheme();
  const delta = honestMinutes - guessMinutes;
  // Only show the band when the caller supplied both a learning confidence and a
  // range. Live-guess hooks pass neither, so the banner keeps its current shape.
  const showRange = confidence !== undefined && confidence !== 'honest' && range != null;

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

  // Soft honey disc — a faint amber tint, the arrow drawn in solid amber on top.
  const coin: ViewStyle = {
    width: t.space[8],
    height: t.space[8],
    borderRadius: t.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.accentCoin,
  };

  // Content column: the honest line, then the optional quiet B15 note beneath it.
  const content: ViewStyle = { flex: 1, gap: t.space[0.5] };
  const line: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const noteText: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkSoft };
  const lead: TextStyle = {
    fontSize: t.fontSize.sm, // 12 — uniform line; hierarchy via weight + colour
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.inkSoft,
    marginRight: t.space[1],
  };
  const num: TextStyle = {
    fontSize: t.fontSize.sm, // 12 — hero via weight + colour, not size
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.accent,
  };
  const unit: TextStyle = {
    fontSize: t.fontSize.sm, // 12
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    color: t.colors.inkSoft,
  };
  const dot: TextStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkFaint,
    marginHorizontal: t.space[1],
  };
  const more: TextStyle = {
    fontSize: t.fontSize.sm, // 12
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.accent,
  };
  const moreMuted: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkSoft };
  const learningSuffix: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkSoft };

  const a11yLabel =
    showRange && range
      ? `Honest range ${range.lowMinutes} to ${range.highMinutes} minutes, still learning`
      : delta > 0
        ? `Honest estimate about ${honestMinutes} minutes, ${delta} more than your guess`
        : `Honest estimate about ${honestMinutes} minutes`;

  return (
    <View style={card} accessibilityLabel={a11yLabel}>
      <View style={coin}>
        <Ionicons name="trending-up" size={t.iconSize.sm} color={t.colors.accent} />
      </View>
      <View style={content}>
        <View style={line}>
          <AppText style={lead}>Honestly</AppText>
          {showRange && range ? (
            <>
              <AppText style={num}>
                {range.lowMinutes}–{range.highMinutes}
              </AppText>
              <AppText style={unit}>m</AppText>
              <AppText style={dot}>·</AppText>
              <AppText style={learningSuffix}>still learning</AppText>
            </>
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
            </>
          )}
        </View>
        {reasonNote ? <AppText style={noteText}>{reasonNote}</AppText> : null}
      </View>
    </View>
  );
}
