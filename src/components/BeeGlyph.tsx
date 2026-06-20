import { useCallback } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// BeeGlyph — line-art Whenbee for the onboarding footer cards.
//
// A sibling of LockGlyph/ReasonGlyph (NOT the brand BeeMascot): same 24-box,
// 1.6px stroke, rounded joins, indigo (primarySoft fill + primary stroke) body
// with amber (accent) stripes + antenna tips. It reads as one set with the lock
// and exit-arrow glyphs that share the footer-card slot on neighbouring steps.
//
// This is intentionally separate from BeeMascot: that component is the brand
// companion (6-stage glow + seed stripe-warmth) used across avatar/trail/lockup
// and must stay filled. This glyph only ever appears in the footer card.
//
// Motion is INTERNAL + CALM — the wings flutter in place on a continuous
// ease-in-out loop (reverse timing → no snap); the body never moves. Reduced
// motion → still.
// ──────────────────────────────────────────────────────────────────────────────

const BOX = 24;
// Padding baked into the viewBox so the bee sits a touch smaller inside its frame
// (more breathing room, reads less cramped than filling the box edge-to-edge).
const PAD = 2;
const VIEW_BOX = `${-PAD} ${-PAD} ${BOX + PAD * 2} ${BOX + PAD * 2}`;
// A hair lighter than the set's 1.6 — the bee carries more linework than the
// lock/door, so an equal weight reads chunky. 1.3 balances it against them.
const SW = 1.3;
// Subtle wing rise/fall (fraction of size) — a bee's quiet buzz, not a bird's
// big wing stroke. Kept small on purpose.
const WING_BOB = 0.04;

export function BeeGlyph({ size = 32, animated = true }: { size?: number; animated?: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();

  const indigo = t.colors.primary;
  const bodyFill = t.colors.glyphFill; // opaque — masks the wings behind the body
  const amber = t.colors.accent;

  // Wings flap: a gentle up-and-down bob, forever — smooth, no snap (reverse
  // timing). The loop is the entrance too; it just starts on mount.
  const flap = useSharedValue(0);
  useAmbientMotion(
    Boolean(animated) && !reduced,
    useCallback(() => {
      flap.set(
        withRepeat(
          withTiming(1, { duration: t.motion.honeyFill, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
      return () => {
        cancelAnimation(flap);
        flap.set(0);
      };
    }, [flap, t.motion.honeyFill]),
  );
  const wingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -size * WING_BOB * flap.get() }],
  }));

  // Wings — the amber accent: a wide pair centred on the body's middle. Drawn
  // BEHIND the body, whose opaque fill masks their inner half, so only the broad
  // outer wing reads (the bee/emoji silhouette) with no crossing lines. Carries
  // the flutter.
  const wings = (
    <>
      <Ellipse
        cx={8.3}
        cy={16}
        rx={3.4}
        ry={3.4}
        rotation={-18}
        originX={8.3}
        originY={16}
        fill="none"
        stroke={amber}
        strokeWidth={SW}
      />
      <Ellipse
        cx={15.7}
        cy={16}
        rx={3.4}
        ry={3.4}
        rotation={18}
        originX={15.7}
        originY={16}
        fill="none"
        stroke={amber}
        strokeWidth={SW}
      />
    </>
  );

  const body = (
    <>
      {/* Indigo teardrop abdomen — fat, rounded shoulders tapering to a point. The
          opaque fill is what hides the inner wings drawn behind it. */}
      <Path
        d="M12 8.5 C8.7 8.5 7.6 11.5 7.6 14.5 C7.6 18 9.5 21 12 21.8 C14.5 21 16.4 18 16.4 14.5 C16.4 11.5 15.3 8.5 12 8.5 Z"
        fill={bodyFill}
        stroke={indigo}
        strokeWidth={SW}
        strokeLinejoin="round"
      />

      {/* Amber stripes — arcs that follow the abdomen's narrowing */}
      <Path
        d="M9.05 13.6 Q12 14.7 14.95 13.6"
        fill="none"
        stroke={amber}
        strokeWidth={SW}
        strokeLinecap="round"
      />
      <Path
        d="M9.5 17 Q12 17.9 14.5 17"
        fill="none"
        stroke={amber}
        strokeWidth={SW}
        strokeLinecap="round"
      />

      {/* Antennae — indigo stems curving up off the head */}
      <Path
        d="M11.1 8.6 C10.5 6.6 10.4 5.9 10.2 5"
        fill="none"
        stroke={indigo}
        strokeWidth={SW}
        strokeLinecap="round"
      />
      <Path
        d="M12.9 8.6 C13.5 6.6 13.6 5.9 13.8 5"
        fill="none"
        stroke={indigo}
        strokeWidth={SW}
        strokeLinecap="round"
      />
    </>
  );

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel="Your Whenbee companion"
    >
      {/* Wings layer (behind) — flutters in place */}
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, transformOrigin: 'center' },
          wingStyle,
        ]}
      >
        <Svg width={size} height={size} viewBox={VIEW_BOX}>
          {wings}
        </Svg>
      </Animated.View>

      {/* Body layer (front) — static */}
      <Svg
        width={size}
        height={size}
        viewBox={VIEW_BOX}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {body}
      </Svg>
    </View>
  );
}
