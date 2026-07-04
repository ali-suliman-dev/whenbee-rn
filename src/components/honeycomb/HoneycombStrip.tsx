import { useEffect } from 'react';
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polygon } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { TIERS, tierBandProgress } from '@/src/engine';
import type { HoneycombCell } from './Honeycomb';

// ──────────────────────────────────────────────────────────────────────────────
// HoneycombStrip — the persistent gamification HUD on Today.
//
// A single COMPACT row — a tier-progress comb, not a tall stat card:
//
//   ⬡ ⬡ ⬡ ⬡ ⬡   4 logs to Thickening                         ›
//
// The pips are the CURRENT tier band rendered one-hex-per-log (honest: the count
// comes from `tierBandProgress`, and the band never reads fully done while you're
// still inside it). Filled pips are amber honey, the next pip a darker wax edge,
// the rest faint — a left→right ripeness ramp. The line emphasises the small
// "logs to go" number (goal gradient) and the chevron invites the tap into the
// hub, where the full per-category comb lives. Aggregates on the LEAD (most-
// ripened) category — that's the tier the user is chasing. Amber is the sanctioned
// honey accent here. No guilt, ever: a pip can only ever light, never drain.
// ──────────────────────────────────────────────────────────────────────────────

/** Regular flat-top hexagon: height = width × √3/2. */
const HEX_RATIO = Math.sqrt(3) / 2;
/** Pips shown for the capped (Honest) comb — a quietly satisfied full row. */
const CAP_PIPS = 5;

/** Flat-top hexagon polygon points inside a `w`×`h` box (h = w × √3/2). */
function pipPoints(w: number, h: number): string {
  const q = w / 4;
  return `${q},0 ${w - q},0 ${w},${h / 2} ${w - q},${h} ${q},${h} 0,${h / 2}`;
}

type PipRole = 'full' | 'next' | 'empty';

/** One solid honey hexagon, settling up in a left→right cascade on mount. */
function Pip({ role, index, animate }: { role: PipRole; index: number; animate: boolean }) {
  const t = useTheme();
  const w = t.honeycomb.pip;
  const h = w * HEX_RATIO;
  const fill =
    role === 'full'
      ? t.colors.accent
      : role === 'next'
        ? t.colors.accentEdge
        : t.colors.accentSoft;

  // Honey-settle reveal — ease-out, no overshoot (monotonic). Reduced motion → static.
  const enter = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) {
      enter.set(1);
      return;
    }
    enter.set(
      withDelay(
        index * t.motion.stagger,
        withTiming(1, { duration: t.motion.base, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [animate, index, enter, t.motion.stagger, t.motion.base]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [{ scale: 0.9 + enter.get() * 0.1 }, { translateY: (1 - enter.get()) * 3 }],
  }));

  return (
    <Animated.View testID={`honey-pip-${role}`} style={style}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Polygon points={pipPoints(w, h)} fill={fill} />
      </Svg>
    </Animated.View>
  );
}

interface HoneycombStripProps {
  cells: HoneycombCell[];
  logs: number;
  onPress: () => void;
}

export function HoneycombStrip({ cells, logs, onPress }: HoneycombStripProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('common');
  const reducedMotion = useReducedMotion();

  // Lead = the most-ripened category; it drives the band + next-tier line.
  const lead = cells.reduce<HoneycombCell | null>(
    (best, c) => (best === null || c.sharpness > best.sharpness ? c : best),
    null,
  );
  const sharpness = lead?.sharpness ?? 0;
  const tier = lead?.tier ?? 'Raw';
  const tierIdx = TIERS.indexOf(tier);
  const nextTier = tierIdx >= 0 && tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1]! : null;
  const band = tierBandProgress(sharpness);
  const remaining = band.remaining;

  const pips: PipRole[] = nextTier
    ? Array.from({ length: band.total }, (_, i) =>
        i < band.done ? 'full' : i === band.done ? 'next' : 'empty',
      )
    : Array.from({ length: CAP_PIPS }, () => 'full');

  // Press feedback — visual + animated style on an inner Animated.View; the
  // Pressable stays a bare touch wrapper (function-form style on Pressable renders
  // nothing under reactCompiler + nativewind). Mirrors AppButton / FAB physics.
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const card: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingVertical: t.space[3],
    paddingHorizontal: t.space[4],
  };
  const pipRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const line: TextStyle = { flex: 1 };
  const countText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };
  const restText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const cappedText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
  };

  const a11y = nextTier
    ? `Your honeycomb — tier ${tier}, ${remaining} ${remaining === 1 ? 'log' : 'logs'} to ${nextTier}, ${logs} ${logs === 1 ? 'log' : 'logs'} logged`
    : `Your honeycomb — tier ${tier}, fully ripened, ${logs} ${logs === 1 ? 'log' : 'logs'} logged`;

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
      accessibilityLabel={a11y}
    >
      <Animated.View style={[card, pressStyle]}>
        <View style={pipRow}>
          {pips.map((role, i) => (
            <Pip key={`pip-${i}`} role={role} index={i} animate={!reducedMotion} />
          ))}
        </View>

        <Text style={line} numberOfLines={1}>
          {nextTier ? (
            <>
              <Text style={countText}>
                {remaining} {remaining === 1 ? 'log' : 'logs'}
              </Text>
              <Text style={restText}>{tr('toTier', { tier: nextTier })}</Text>
            </>
          ) : (
            <Text style={cappedText}>{tr('fullyRipened')}</Text>
          )}
        </Text>

        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
      </Animated.View>
    </Pressable>
  );
}
