import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// ReasonGlyph — refined two-tone SVG illustrations for the Reward reason chips.
//
// One coherent set, drawn on a 24-box with consistent 1.6px strokes + rounded
// joins, in the brand indigo (body) + amber (accent) palette:
//   interrupted → a bell           (rings/swings on tap)
//   bigger      → expand arrows     (pops larger)
//   pulled      → a door + exit arrow (nudges out)
//   zone        → a lightning bolt   (flashes bigger)
//   smaller     → contract arrows    (shrinks in)
//
// Each plays a ONE-SHOT delight animation when its chip is selected — feedback
// scaled to the "tag" action (a meaningful, infrequent pick), reduced-motion
// guarded to a still final state. The motion maps to the meaning (bigger grows,
// smaller shrinks, bell rings, arrow leaves) so it reads as illustration, not
// decoration.
// ──────────────────────────────────────────────────────────────────────────────

export type ReasonGlyphKind = 'interrupted' | 'bigger' | 'pulled' | 'zone' | 'smaller';

const BOX = 24;
const SW = 1.6; // stroke width

export function ReasonGlyph({
  kind,
  active,
  size = 22,
  ambient = false,
}: {
  kind: ReasonGlyphKind;
  active: boolean;
  size?: number;
  /** Looped in-place life (currently the 'pulled' exit arrow breathing). */
  ambient?: boolean;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();

  // Ambient: the 'pulled' exit arrow glides smoothly out the doorway and back,
  // forever — a clean "leaving / one-tap exit" motion (ease-in-out, no snap, the
  // arrow never disappears). It rides its own layer so only the arrow moves.
  const arrowAmbient = ambient && kind === 'pulled' && !reduced;
  // The arrow travels from just inside the doorway out to its resting spot, then
  // back — a clear "stepping out" loop. Kept entirely within the box (it sits at
  // the right edge already, so it glides LEFT→home, never clipping).
  const GLIDE = size * 0.2; // shallower tuck — barely dips into the doorway
  const GLIDE_MS = 1500; // slower, calmer step-out
  const glide = useSharedValue(1);
  useEffect(() => {
    if (!arrowAmbient) {
      glide.set(1);
      return;
    }
    glide.set(0); // begin tucked at the doorway
    glide.set(
      withRepeat(withTiming(1, { duration: GLIDE_MS, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [arrowAmbient, glide]);
  // glide 0 → arrow tucked at the doorway (translateX −GLIDE); glide 1 → resting.
  const arrowGlide = useAnimatedStyle(() => ({ transform: [{ translateX: GLIDE * (glide.get() - 1) }] }));

  const indigo = t.colors.primary;
  const indigoSoft = t.colors.primarySoft;
  const amber = t.colors.accent;
  const amberEdge = t.colors.accentEdge;

  // One shared transform per axis; only the axes a given kind needs get driven.
  const rot = useSharedValue(0);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) {
      rot.set(0);
      scale.set(1);
      tx.set(0);
      return;
    }
    const spring = t.motion.spring;
    const pop = t.motion.press;
    switch (kind) {
      case 'interrupted':
        rot.set(
          withSequence(
            withTiming(-15, { duration: 90 }),
            withTiming(12, { duration: 110 }),
            withTiming(-7, { duration: 90 }),
            withSpring(0, spring),
          ),
        );
        break;
      case 'bigger':
        scale.set(withSequence(withTiming(1.28, { duration: pop }), withSpring(1, spring)));
        break;
      case 'smaller':
        scale.set(withSequence(withTiming(0.68, { duration: pop }), withSpring(1, spring)));
        break;
      case 'zone':
        scale.set(withSequence(withTiming(1.35, { duration: 90 }), withSpring(1, spring)));
        break;
      case 'pulled':
        tx.set(withSequence(withTiming(4, { duration: pop }), withSpring(0, spring)));
        break;
    }
  }, [active, reduced, kind, rot, scale, tx, t.motion.press, t.motion.spring]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { rotate: `${rot.get()}deg` }, { scale: scale.get() }],
  }));

  const glyph = (
    <Animated.View style={anim}>
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
        {kind === 'interrupted' ? (
          <>
            <Path
              d="M12 4.6 C9 4.6 7.6 7 7.6 10.4 V13 L6.1 16 H17.9 L16.4 13 V10.4 C16.4 7 15 4.6 12 4.6 Z"
              fill={indigoSoft}
              stroke={indigo}
              strokeWidth={SW}
              strokeLinejoin="round"
            />
            <Circle cx={12} cy={3.5} r={1.1} fill={amber} />
            <Path
              d="M10.4 16.9 a1.6 1.6 0 0 0 3.2 0"
              fill="none"
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
          </>
        ) : null}

        {kind === 'bigger' ? (
          <>
            <Rect x={8.5} y={8.5} width={7} height={7} rx={1.6} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
            <Path
              d="M7 7 L4 4 M4 7.2 V4 H7.2 M17 7 L20 4 M16.8 4 H20 V7.2 M7 17 L4 20 M4 16.8 V20 H7.2 M17 17 L20 20 M16.8 20 H20 V16.8"
              fill="none"
              stroke={amber}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {kind === 'smaller' ? (
          <>
            <Rect x={8.5} y={8.5} width={7} height={7} rx={1.6} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
            <Path
              d="M4 4 L7 7 M4 7.2 H7.2 V4 M20 4 L17 7 M20 7.2 H16.8 V4 M4 20 L7 17 M4 16.8 H7.2 V20 M20 20 L17 17 M20 16.8 H16.8 V20"
              fill="none"
              stroke={amber}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {kind === 'pulled' ? (
          <>
            <Rect x={5} y={4} width={7.5} height={16} rx={1.4} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
            <Circle cx={10.3} cy={12} r={0.9} fill={indigo} />
            {/* Arrow lives in the static Svg unless it's gliding (then it's an
                overlay layer below, so only the arrow moves). */}
            {arrowAmbient ? null : (
              <Path
                d="M14 12 H20 M17 9 L20 12 L17 15"
                fill="none"
                stroke={amber}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </>
        ) : null}

        {kind === 'zone' ? (
          <Path
            d="M13.6 3 L7 13 H11 L10.4 21 L17 10.5 H12.6 Z"
            fill={amber}
            stroke={amberEdge}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
    </Animated.View>
  );

  if (!arrowAmbient) return glyph;

  // Gliding exit arrow rides its own layer over the static door.
  return (
    <View style={{ width: size, height: size }}>
      {glyph}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, arrowGlide]}>
        <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
          <Path
            d="M14 12 H20 M17 9 L20 12 L17 15"
            fill="none"
            stroke={amber}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
