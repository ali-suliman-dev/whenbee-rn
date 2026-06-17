import { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, G } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import type { ColorModePref } from '@/src/stores/settingsStore';

// ──────────────────────────────────────────────────────────────────────────────
// AppearanceGlyph — two-tone SVG set for the system / light / dark picker.
//
// Same family as ReasonGlyph / PrivacyGlyph (24-box, 1.6px strokes, rounded
// joins), but each glyph wears the hue that fits its meaning:
//   light  — warm amber sun (amber core + rays)
//   dark   — cool indigo crescent + a small amber star
//   system — the split disc: amber "light" half + indigo "dark" half (it follows
//            the device, so it carries both)
//
// Colour is fixed per kind — the chip border + tint carry the selected state, so
// the glyph never has to recolour. On a fresh pick it plays ONE meaning-mapped
// flourish (sun shines, moon tilts, disc turns), reduced-motion guarded to rest.
// ──────────────────────────────────────────────────────────────────────────────

const BOX = 24;
const C = 12;
const SW = 1.6;
const SUN_CORE = 3.4;
const RAY_IN = 6.4;
const RAY_OUT = 9;
const RAY_COUNT = 8;

// Eight ray endpoints, pre-computed (Math allowed at module load; no clock/random).
const RAYS = Array.from({ length: RAY_COUNT }, (_, i) => {
  const a = (i / RAY_COUNT) * Math.PI * 2;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return {
    x1: C + cos * RAY_IN,
    y1: C + sin * RAY_IN,
    x2: C + cos * RAY_OUT,
    y2: C + sin * RAY_OUT,
  };
});

export function AppearanceGlyph({
  kind,
  selected,
  size = 18,
}: {
  kind: ColorModePref;
  selected: boolean;
  size?: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();

  const indigo = t.colors.primary;
  const indigoSoft = t.colors.primarySoft;
  const amber = t.colors.accent;
  const amberEdge = t.colors.accentEdge;
  const amberSoft = t.colors.accentSoft;

  const scale = useSharedValue(1);
  const rot = useSharedValue(0);

  // One-shot flourish on false→true only (never on mount), like ReasonGlyph.
  const wasSelected = useRef(selected);
  useEffect(() => {
    const justSelected = selected && !wasSelected.current;
    wasSelected.current = selected;
    if (!justSelected || reduced) return;

    const spring = t.motion.spring;
    const pop = t.motion.press;
    scale.set(withSequence(withTiming(1.16, { duration: pop }), withSpring(1, spring)));
    if (kind === 'light') {
      rot.set(withSequence(withTiming(-22, { duration: 90 }), withSpring(0, spring)));
    } else if (kind === 'dark') {
      rot.set(withSequence(withTiming(16, { duration: 100 }), withSpring(0, spring)));
    } else {
      rot.set(withSequence(withTiming(-14, { duration: 100 }), withSpring(0, spring)));
    }
  }, [selected, reduced, kind, scale, rot, t.motion]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.get()}deg` }, { scale: scale.get() }],
  }));

  return (
    <Animated.View style={anim}>
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`} fill="none">
        {kind === 'light' ? (
          <>
            <Circle cx={C} cy={C} r={SUN_CORE} fill={amberSoft} stroke={amber} strokeWidth={SW} />
            <G stroke={amber} strokeWidth={SW} strokeLinecap="round">
              {RAYS.map((r, i) => (
                <Line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
              ))}
            </G>
          </>
        ) : null}

        {kind === 'dark' ? (
          <>
            <Path
              d="M20.5 13.2A8.2 8.2 0 1 1 10.8 3.5 6.4 6.4 0 0 0 20.5 13.2z"
              fill={indigoSoft}
              stroke={indigo}
              strokeWidth={SW}
              strokeLinejoin="round"
            />
            {/* Amber star — the warm spark of a night sky. */}
            <Path
              d="M18 4 19 5.9 20.9 6.9 19 7.9 18 9.8 17 7.9 15.1 6.9 17 5.9 Z"
              fill={amber}
              stroke={amberEdge}
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {kind === 'system' ? (
          <>
            {/* Left half = amber (light), right half = indigo (dark). */}
            <Path d="M12 3.4a8.6 8.6 0 0 0 0 17.2z" fill={amberSoft} />
            <Path d="M12 3.4a8.6 8.6 0 0 1 0 17.2z" fill={indigoSoft} />
            <Line x1={12} y1={3.4} x2={12} y2={20.6} stroke={indigo} strokeWidth={SW} />
            <Circle cx={C} cy={C} r={8.6} fill="none" stroke={indigo} strokeWidth={SW} />
          </>
        ) : null}
      </Svg>
    </Animated.View>
  );
}
