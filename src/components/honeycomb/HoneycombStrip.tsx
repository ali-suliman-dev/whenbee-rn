import { useEffect } from 'react';
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { TIERS, logsToNextTier } from '@/src/engine';
import type { Tier } from '@/src/domain/types';
import { Honeycomb, type HoneycombCell } from './Honeycomb';

// ──────────────────────────────────────────────────────────────────────────────
// HoneycombStrip — the persistent gamification HUD on Today (real, not placeholder).
//
// Tappable Card → Whenbee hub. A VERTICAL stack so the comb row and the readout
// never compete for width (the old side-by-side layout let an unbounded comb row
// squeeze the text out of bounds past 3 combs):
//
//   Your honeycomb                 [tier pill]   ← header (title yields, pill fixed)
//   ⬡ ⬡ ⬡ ⬡ ⬡  +3                              ← bounded comb row + "+N" tail
//   ▓▓▓▓▓▓▓░░░░░  67%                            ← honey progress bar → sharpness%
//   4 logs to Thickening →                       ← next-tier line (only when one exists)
//
// The pill / bar / next-line read the LEAD (most-ripened) category — that's the
// tier the user is chasing. Amber is the sanctioned honey accent here (ripeness).
// ──────────────────────────────────────────────────────────────────────────────

interface AggregateHoney {
  pct: number;
  tier: Tier;
  nextTier: Tier | null;
  logsToNext: number;
}

/** Lead = the most-ripened category; it drives the pill + bar + next-tier line. */
function aggregate(cells: HoneycombCell[]): AggregateHoney {
  const lead = cells.reduce<HoneycombCell | null>(
    (best, c) => (best === null || c.sharpness > best.sharpness ? c : best),
    null,
  );
  const sharpness = lead?.sharpness ?? 0;
  const tier = lead?.tier ?? 'Raw';
  const tierIdx = TIERS.indexOf(tier);
  const nextTier = tierIdx >= 0 && tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1]! : null;
  return { pct: Math.round(sharpness), tier, nextTier, logsToNext: logsToNextTier(sharpness) };
}

interface HoneycombStripProps {
  cells: HoneycombCell[];
  logs: number;
  onPress: () => void;
}

export function HoneycombStrip({ cells, logs, onPress }: HoneycombStripProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const { pct, tier, nextTier, logsToNext } = aggregate(cells);

  // Bounded comb row — stable order (no sort) so combs never jump between logs.
  const max = t.honeycomb.stripMax;
  const shown = cells.slice(0, max);
  const extra = cells.length - shown.length;

  // Press feedback — visual + animated style live on an inner Animated.View; the
  // Pressable stays a bare touch wrapper (function-form style on Pressable renders
  // nothing under reactCompiler + nativewind). Mirrors AppButton / FAB physics.
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  // Honey-settle reveal — the bar fills to `pct` with the same calm ease-out the
  // Honeycomb cells use for their bottom-up honey rise. Reduced motion → final width.
  const fill = useSharedValue(reducedMotion ? pct : 0);
  useEffect(() => {
    if (reducedMotion) {
      fill.set(pct);
      return;
    }
    fill.set(withTiming(pct, { duration: t.motion.reveal, easing: Easing.out(Easing.cubic) }));
  }, [pct, reducedMotion, fill, t.motion.reveal]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get()}%` }));

  const card: ViewStyle = {
    flexDirection: 'column',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
  };
  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space[2],
  };
  const heading: TextStyle = {
    ...(type.heading as unknown as TextStyle),
    color: t.colors.ink,
    flexShrink: 1,
  };
  const pill: ViewStyle = {
    flexShrink: 0,
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[0.5],
  };
  const pillText: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    color: t.colors.amberText,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };
  const combRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const barRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const track: ViewStyle = {
    flex: 1,
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const barFill: ViewStyle = {
    height: '100%',
    backgroundColor: t.colors.accent,
    borderRadius: t.radii.full,
  };
  const pctText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const overflowText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  const nextLine: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };
  const nextTail: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    fontWeight: t.fontWeight.regular as TextStyle['fontWeight'],
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!reducedMotion) scale.set(withTiming(0.98, { duration: t.motion.press }));
      }}
      onPressOut={() => {
        if (!reducedMotion) scale.set(withSpring(1, t.motion.spring));
      }}
      accessibilityRole="button"
      accessibilityLabel={`Your honeycomb — ${pct}% honey, tier ${tier}, ${logs} ${logs === 1 ? 'log' : 'logs'}`}
    >
      <Animated.View style={[card, pressStyle]}>
        <View style={header}>
          <Text style={heading} numberOfLines={1}>
            Your honeycomb
          </Text>
          <View style={pill}>
            <Text style={pillText}>{tier}</Text>
          </View>
        </View>

        {shown.length > 0 ? (
          <View style={combRow}>
            <Honeycomb size="strip" cells={shown} />
            {extra > 0 ? <Text style={overflowText}>+{extra}</Text> : null}
          </View>
        ) : null}

        <View style={barRow}>
          <View style={track}>
            <Animated.View style={[barFill, fillStyle]} />
          </View>
          <Text style={pctText}>{pct}%</Text>
        </View>

        {nextTier ? (
          <Text style={nextLine}>
            {logsToNext} {logsToNext === 1 ? 'log' : 'logs'} to {nextTier}{' '}
            <Text style={{ color: t.colors.amberText }}>→</Text>
            <Text style={nextTail}>
              {'  ·  '}
              {logs} {logs === 1 ? 'log' : 'logs'}
            </Text>
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
