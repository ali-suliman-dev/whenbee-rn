import { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// DataResetGlyph — Danger-zone member of the 24-box / 1.6-stroke glyph family
// (sibling of ReasonGlyph / AppearanceGlyph). Two kinds:
//   progress — amber counter-clockwise refresh arc around an indigo seed dot
//              ("start the growing over"). One-shot CCW spin on confirm.
//   erase    — danger sweep strokes inside an indigo bin ("clear it all out").
//              One-shot left nudge on confirm.
// `active` false→true triggers the one-shot; reduced-motion holds the rest state.
// erase uses the danger token (never amber) so the two states never read alike.
// ──────────────────────────────────────────────────────────────────────────────

const BOX = 24;
const SW = 1.6;

export function DataResetGlyph({
  kind,
  active = false,
  size = 22,
}: {
  kind: 'progress' | 'erase';
  active?: boolean;
  size?: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();

  const indigo = t.colors.primary;
  const amber = t.colors.accent;
  const danger = t.colors.danger;

  const rot = useSharedValue(0);
  const tx = useSharedValue(0);

  const wasActive = useRef(active);
  useEffect(() => {
    const justActivated = active && !wasActive.current;
    wasActive.current = active;
    if (!justActivated || reduced) return;
    const spring = t.motion.spring;
    if (kind === 'progress') {
      rot.set(withSequence(withTiming(-300, { duration: 520 }), withSpring(0, spring)));
    } else {
      tx.set(withSequence(withTiming(-3, { duration: 90 }), withSpring(0, spring)));
    }
  }, [active, reduced, kind, rot, tx, t.motion.spring]);

  const anim = useAnimatedStyle(() => ({
    transform: kind === 'progress' ? [{ rotate: `${rot.get()}deg` }] : [{ translateX: tx.get() }],
  }));

  return (
    <Animated.View style={anim}>
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`} fill="none">
        {kind === 'progress' ? (
          <>
            {/* indigo seed at the centre */}
            <Circle cx={12} cy={12} r={2.2} fill={indigo} />
            {/* amber CCW refresh arc with an arrowhead at its head */}
            <Path
              d="M18 8 A7 7 0 1 0 19 12"
              stroke={amber}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            <Path
              d="M18.4 4.6 L18 8 L14.7 7"
              stroke={amber}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            {/* indigo bin body */}
            <Path
              d="M7 8 H17 L16 19 a1.4 1.4 0 0 1 -1.4 1.3 H9.4 A1.4 1.4 0 0 1 8 19 Z"
              stroke={indigo}
              strokeWidth={SW}
              strokeLinejoin="round"
            />
            {/* bin lid + handle */}
            <Path d="M5.5 8 H18.5" stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
            <Path
              d="M10 8 V6 a1.2 1.2 0 0 1 1.2 -1.2 H12.8 A1.2 1.2 0 0 1 14 6 V8"
              stroke={indigo}
              strokeWidth={SW}
              strokeLinejoin="round"
            />
            {/* danger sweep accents inside the bin */}
            <Path
              d="M11 11.5 V16.5 M14 11.5 V16.5"
              stroke={danger}
              strokeWidth={SW}
              strokeLinecap="round"
            />
          </>
        )}
      </Svg>
    </Animated.View>
  );
}
