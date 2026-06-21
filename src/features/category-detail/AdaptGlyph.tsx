import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import type { AdaptSpeed } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// AdaptGlyph — the leading illustration for "Tune how I learn". A sibling to
// ReasonGlyph/EnergyGlyph: a 24-box, two-tone mark (indigo body + a single amber
// core, the "your pace" through-line) drawn at a calm 2px stroke.
//
// These are CHARACTERS, not stages — each conveys its mode, not a 1/2/3 rank:
//   steady    → the core held inside one calm ring (contained, slow to change)
//   balanced  → the core centred on a level beam between equal weights (equilibrium)
//   reactive  → the core pulsing outward in symmetric arcs (responds fast)
//
// Amber appears only when active (the true-accent rule); at rest the whole mark is
// one muted tone. On select it plays a single scaled-to-the-action pop —
// reduced-motion renders the still icon.
// ──────────────────────────────────────────────────────────────────────────────

const SW = 2; // stroke width

export function AdaptGlyph({
  kind,
  active,
  size = 17,
}: {
  kind: AdaptSpeed;
  active: boolean;
  size?: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active || reduced) {
      scale.set(1);
      return;
    }
    scale.set(withSequence(withTiming(1.14, { duration: t.motion.press }), withSpring(1, t.motion.spring)));
  }, [active, reduced, kind, scale, t.motion.press, t.motion.spring]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  // Indigo body when active, one muted tone at rest; amber core only when active.
  const body = active ? t.colors.primary : t.colors.inkSoft;
  const core = active ? t.colors.accent : t.colors.inkSoft;

  return (
    <Animated.View style={anim} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {kind === 'steady' ? (
          <>
            <Circle cx={12} cy={12} r={7} fill="none" stroke={body} strokeWidth={SW} />
            <Circle cx={12} cy={12} r={2.5} fill={core} />
          </>
        ) : null}

        {kind === 'balanced' ? (
          <>
            <Line x1={3.5} y1={12} x2={20.5} y2={12} stroke={body} strokeWidth={SW} strokeLinecap="round" />
            <Circle cx={4.5} cy={12} r={2.1} fill={body} />
            <Circle cx={19.5} cy={12} r={2.1} fill={body} />
            <Circle cx={12} cy={12} r={2.6} fill={core} />
          </>
        ) : null}

        {kind === 'reactive' ? (
          <>
            <Path d="M15 8.5 A4.5 4.5 0 0 1 15 15.5" fill="none" stroke={body} strokeWidth={SW} strokeLinecap="round" />
            <Path d="M18 6 A8 8 0 0 1 18 18" fill="none" stroke={body} strokeWidth={SW} strokeLinecap="round" opacity={0.55} />
            <Path d="M9 8.5 A4.5 4.5 0 0 0 9 15.5" fill="none" stroke={body} strokeWidth={SW} strokeLinecap="round" />
            <Path d="M6 6 A8 8 0 0 0 6 18" fill="none" stroke={body} strokeWidth={SW} strokeLinecap="round" opacity={0.55} />
            <Circle cx={12} cy={12} r={2.5} fill={core} />
          </>
        ) : null}
      </Svg>
    </Animated.View>
  );
}
