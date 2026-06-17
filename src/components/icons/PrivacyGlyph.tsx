import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// PrivacyGlyph — refined two-tone SVG set for the Privacy cards.
//
// Same family as ReasonGlyph: 24-box, 1.6px strokes + rounded joins, brand indigo
// body (with a soft-indigo fill) + an amber accent that carries the meaning:
//   phone    → device, amber data-bar safe on screen   (settles in — "locks on")
//   person   → head + amber shoulders, anonymous        (rises in — calm)
//   bug      → indigo body, amber legs + antennae        (wiggles — scuttles)
//   calendar → month grid, amber "today" cell            (cell pings — on request)
//
// The ICON animates, not the card — a one-shot mount flourish, staggered down the
// list by index, mapped to the glyph's meaning. Reduced-motion guarded to a still
// final state (rest transform, full opacity).
// ──────────────────────────────────────────────────────────────────────────────

export type PrivacyGlyphKind = 'phone' | 'person' | 'bug' | 'calendar';

const BOX = 24;
const SW = 1.6;

export function PrivacyGlyph({
  kind,
  index = 0,
  size = 22,
}: {
  kind: PrivacyGlyphKind;
  index?: number;
  size?: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();

  const indigo = t.colors.primary;
  const indigoSoft = t.colors.primarySoft;
  const amber = t.colors.accent;

  // One shared value per axis; each kind drives only the ones it needs.
  const opacity = useSharedValue(reduced ? 1 : 0);
  const scale = useSharedValue(1);
  const rot = useSharedValue(0);
  const ty = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      opacity.set(1);
      scale.set(1);
      rot.set(0);
      ty.set(0);
      return;
    }
    // Cascade down the list; whole flourish stays inside the motion budget.
    const delay = t.motion.stagger * index;
    const spring = t.motion.spring;
    const pop = t.motion.press;

    opacity.set(withDelay(delay, withTiming(1, { duration: t.motion.base })));
    switch (kind) {
      case 'phone':
        scale.set(0.78);
        scale.set(withDelay(delay, withSpring(1, spring)));
        break;
      case 'person':
        ty.set(6);
        ty.set(withDelay(delay, withSpring(0, spring)));
        break;
      case 'bug':
        rot.set(
          withDelay(
            delay,
            withSequence(
              withTiming(-12, { duration: 80 }),
              withTiming(10, { duration: 100 }),
              withTiming(-5, { duration: 80 }),
              withSpring(0, spring),
            ),
          ),
        );
        break;
      case 'calendar':
        scale.set(withDelay(delay, withSequence(withTiming(1.2, { duration: pop }), withSpring(1, spring))));
        break;
    }
    // Mount-only: run the cascade once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: ty.get() }, { rotate: `${rot.get()}deg` }, { scale: scale.get() }],
  }));

  return (
    <Animated.View style={anim}>
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
        {kind === 'phone' ? (
          <>
            <Rect x={6} y={2.5} width={12} height={19} rx={2.6} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
            <Line x1={10.4} y1={18.4} x2={13.6} y2={18.4} stroke={amber} strokeWidth={1.8} strokeLinecap="round" />
          </>
        ) : null}

        {kind === 'person' ? (
          <>
            <Circle cx={12} cy={8} r={3.6} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
            <Path
              d="M5.5 20a6.5 6.5 0 0 1 13 0"
              fill="none"
              stroke={amber}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </>
        ) : null}

        {kind === 'bug' ? (
          <>
            <Rect x={8} y={7.5} width={8} height={10} rx={4} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
            <Path d="M9 7a3 3 0 0 1 6 0" fill="none" stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
            <Line x1={12} y1={9.5} x2={12} y2={17} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
            <Path
              d="M8 11 4.6 9.6 M8 14 H4.2 M8 17 4.8 18.8 M16 11 19.4 9.6 M16 14 H19.8 M16 17 19.2 18.8"
              fill="none"
              stroke={amber}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M10.4 4.6 9.2 3 M13.6 4.6 14.8 3"
              fill="none"
              stroke={amber}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </>
        ) : null}

        {kind === 'calendar' ? (
          <>
            <Rect x={4} y={5} width={16} height={15} rx={2.4} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
            <Line x1={4} y1={9.5} x2={20} y2={9.5} stroke={indigo} strokeWidth={SW} />
            <Line x1={8.5} y1={3} x2={8.5} y2={6.5} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
            <Line x1={15.5} y1={3} x2={15.5} y2={6.5} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
            <Rect x={10.4} y={12} width={3.6} height={3.6} rx={0.9} fill={amber} />
          </>
        ) : null}
      </Svg>
    </Animated.View>
  );
}
