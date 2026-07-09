import { useEffect, useRef } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';

// ──────────────────────────────────────────────────────────────────────────────
// FocusGateRow — one rung of the focus-unlock ladder. Presentational, tokens only.
//
//   done      success-tinted marker + ✓ glyph, value in success, muted sub. No pips.
//   active    indigo marker (soft fill + ring + centre dot), value as have/need
//             (num ink, den faint), a pip row, and the amber "N to go" sub.
//   upcoming  sunken marker, muted label + value + sub, no pips.
//
// Rows are separated by a 1px hairline top border (all but the first).
//
// MOTION (Task 3, per the app's no-tacky-motion rule — opacity/scale/SVG-draw only):
//   • Pip settle  — a pip that flips unfilled→filled fades + settles scale 0.9→1.0
//     (withTiming, Easing.out(cubic), motion.base). No overshoot, no travel. Only
//     the NEWLY filled pip animates; the rest sit at their final state.
//   • Check draw  — the done marker's ✓ is an inline SVG stroke that draws itself in
//     via strokeDashoffset over the path's real (over-estimated) length, once, when
//     the row becomes done. (react-native-svg ignores pathLength — we dash by length.)
//   Reduced motion → both jump straight to the final state, zero travel.
// ──────────────────────────────────────────────────────────────────────────────

export type FocusGateState = 'done' | 'active' | 'upcoming';

export interface FocusGateRowProps {
  state: FocusGateState;
  label: string;
  valueText: string;
  sub: string;
  /** Progress dots for the active row (filled indigo, rest sunken). */
  pips?: { filled: number; total: number };
  /** The first row omits its top divider so the ladder reads as one block. */
  first?: boolean;
}

const AView = Animated.createAnimatedComponent(View);
const APath = Animated.createAnimatedComponent(Path);

// Check glyph drawn on a 16-box. Real path length ≈ 12.4; over-estimate so the
// tail never stays hidden at rest (a too-short dash leaves a permanent gap).
const CHECK_BOX = 16;
const CHECK_LEN = 16;
const CHECK_PATH = 'M4 8.5 L7 11.5 L12.5 5.5';

// One progress pip. Detects its own unfilled→filled transition and settles in;
// unfilled and already-filled pips rest at their final state (no mount cascade).
function Pip({ filled }: { filled: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const settle = useSharedValue(1);
  const wasFilled = useRef(filled);

  useEffect(() => {
    const becameFilled = filled && !wasFilled.current;
    wasFilled.current = filled;
    if (!becameFilled || reduced) return;
    settle.set(0);
    settle.set(withTiming(1, { duration: t.motion.base, easing: Easing.out(Easing.cubic) }));
  }, [filled, reduced, settle, t.motion.base]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + settle.get() * 0.6,
    transform: [{ scale: 0.9 + settle.get() * 0.1 }],
  }));

  const base: ViewStyle = {
    width: t.focusLadder.dot,
    height: t.focusLadder.dot,
    borderRadius: t.radii.full,
    backgroundColor: filled ? t.colors.primary : t.colors.surfaceSunken,
  };
  return <AView style={[base, animatedStyle]} />;
}

// The done marker's ✓ — an SVG stroke that draws itself in once on mount (the
// moment the row became done), then rests fully drawn.
function DrawCheck({ size, color }: { size: number; color: string }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const draw = useSharedValue(reduced ? 1 : 0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (reduced) {
      draw.set(1);
      return;
    }
    draw.set(0);
    draw.set(withTiming(1, { duration: t.motion.base, easing: Easing.out(Easing.cubic) }));
  }, [reduced, draw, t.motion.base]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - draw.get()) }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${CHECK_BOX} ${CHECK_BOX}`}>
      <APath
        d={CHECK_PATH}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={CHECK_LEN}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

export function FocusGateRow({ state, label, valueText, sub, pips, first = false }: FocusGateRowProps) {
  const t = useTheme();
  const { marker, markerIcon, ring, dot } = t.focusLadder;

  const done = state === 'done';
  const active = state === 'active';

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space[3],
    paddingVertical: t.space[3],
    ...(first ? null : { borderTopWidth: t.borderWidth.share, borderTopColor: t.colors.hairline }),
  };

  const markerBase: ViewStyle = {
    width: marker,
    height: marker,
    borderRadius: t.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const markerStyle: ViewStyle = done
    ? { ...markerBase, backgroundColor: t.colors.successSoft }
    : active
      ? { ...markerBase, backgroundColor: t.colors.primarySoft, borderWidth: ring, borderColor: t.colors.primary }
      : { ...markerBase, backgroundColor: t.colors.surfaceSunken };

  const content: ViewStyle = { flex: 1, gap: t.space[1.5] };
  const headRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space[2],
  };

  const labelStyle: TextStyle = {
    ...(type.bodySmBold as unknown as TextStyle),
    color: active || done ? t.colors.ink : t.colors.inkFaint,
  };
  const subStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: active ? t.colors.amberText : t.colors.inkFaint,
  };

  // Active value two-tones the fraction: numerator ink, "/need" faint.
  const slash = valueText.indexOf('/');
  const numText = slash >= 0 ? valueText.slice(0, slash) : valueText;
  const denText = slash >= 0 ? valueText.slice(slash) : '';

  const valueNode = done ? (
    <AppText style={{ ...(type.bodySmBold as unknown as TextStyle), color: t.colors.success }}>{valueText}</AppText>
  ) : active ? (
    <AppText>
      <AppText style={{ ...(type.numCaption as unknown as TextStyle), color: t.colors.ink }}>{numText}</AppText>
      {denText ? (
        <AppText style={{ ...(type.numCaption as unknown as TextStyle), color: t.colors.inkFaint }}>{denText}</AppText>
      ) : null}
    </AppText>
  ) : (
    <AppText style={{ ...(type.numCaption as unknown as TextStyle), color: t.colors.inkFaint }}>{valueText}</AppText>
  );

  const markerDot: ViewStyle = {
    width: dot,
    height: dot,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primary,
  };

  return (
    <View style={row}>
      <View style={markerStyle}>
        {done ? <DrawCheck size={markerIcon} color={t.colors.success} /> : null}
        {active ? <View style={markerDot} /> : null}
      </View>
      <View style={content}>
        <View style={headRow}>
          <AppText style={labelStyle}>{label}</AppText>
          {valueNode}
        </View>
        {active && pips ? (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[1] }}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            {Array.from({ length: pips.total }, (_, i) => (
              <Pip key={i} filled={i < pips.filled} />
            ))}
          </View>
        ) : null}
        <AppText style={subStyle}>{sub}</AppText>
      </View>
    </View>
  );
}
