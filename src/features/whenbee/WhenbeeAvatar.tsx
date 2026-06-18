import { useEffect } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { BeeMascot } from '@/src/components/BeeMascot';
import { BeeCoin } from '@/src/components/BeeCoin';
import { type } from '@/src/theme/typography';
import type { CompanionStage, DriftHealth } from '@/src/engine';

// Backdrop styles behind the ring bee. 'soft' = a neutral coin whose rim fades out
// (no glow, no hard edge — the chosen look, shared with the Today HUD via BeeCoin).
// 'disc' = a hard-edged flat coin; 'pool' = a soft amber bloom. The last two are
// kept as alternates.
type Backdrop = 'none' | 'soft' | 'disc' | 'pool';

// Flat backing disc: a solid raised coin with a clean hairline edge. No bloom, no
// shadow — figure/ground via a real surface (flat-tactical, the no-glow option).
function FlatDisc({
  size,
  bg,
  border,
  borderColor,
  radius,
}: {
  size: number;
  bg: string;
  border: number;
  borderColor: string;
  radius: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        borderWidth: border,
        borderColor,
      }}
    />
  );
}

// Soft honey-pool backdrop: a radial amber bloom that lifts the indigo bee off the
// dark ring interior (figure/ground) and fades to nothing before the ring arc. Flat,
// no border — a pool of warmth, not a second ring.
function HoneyPool({ size, color, opacity }: { size: number; color: string; opacity: number }) {
  const r = size / 2;
  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }} pointerEvents="none">
      <Defs>
        <RadialGradient id="beePool" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="62%" stopColor={color} stopOpacity={opacity * 0.5} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill="url(#beePool)" />
    </Svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// WhenbeeAvatar — the companion, now stage-driven (Part 2 Group E). It renders the
// ONE base BeeMascot art and lets the 6-stage growth speak through motion + glow:
//
//   • Mount: a Playful spring LIFT whose amplitude scales with stage (a higher hop
//     for a more-present bee), then a calm sine FLOAT bob at the same per-stage
//     amplitude (companion.floatLift token). Joy, never urgency.
//   • driftHealth 'curious' ONLY adds a tiny rotational wobble — a gentle "worth a
//     re-check" wave, never a sad/wilt state (positive-only invariant).
//   • REDUCE-MOTION: collapse to a plain fade-in, no travel (matches CoinBadge).
//
// Art + motion only (plus an optional name). No caption line — the ring badge and
// the labeled zones below carry the words.
// ──────────────────────────────────────────────────────────────────────────────

export function WhenbeeAvatar({
  stage,
  seed,
  driftHealth = 'settled',
  name,
  glow = true,
  size,
  animated = false,
  backdrop = 'none',
}: {
  stage: CompanionStage;
  seed: number;
  driftHealth?: DriftHealth;
  name?: string;
  /** Forwarded to BeeMascot. When false, the amber/drift glow halo is not rendered.
   *  Pass glow={false} when the avatar sits inside HoneyRing where the ring arc
   *  provides the visual focus and a glow halo would add clutter. */
  glow?: boolean;
  /** Bee art size (px). Defaults to the hero burst size; the hub ring passes the
   *  smaller `companion.ringBee` so the ring breathes around it. */
  size?: number;
  /** Forward the looping wing-flutter / blink / glance micro-life to BeeMascot. */
  animated?: boolean;
  /** Backing behind the bee (hub ring only). 'disc' = flat coin (no glow, default
   *  choice); 'pool' = soft amber bloom; 'none' = nothing. */
  backdrop?: Backdrop;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const curious = driftHealth === 'curious';

  // noUncheckedIndexedAccess: floatLift may be undefined-at-index → fall back to the
  // gentlest amplitude so a bad stage still breathes calmly rather than going still.
  const lift = t.companion.floatLift[stage - 1] ?? t.companion.floatLift[0] ?? 2;

  const appear = useSharedValue(reducedMotion ? 1 : 0);
  const bob = useSharedValue(0);
  const wobble = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    // Mount lift: spring up + fade in (Playful, a touch of overshoot → joy).
    appear.set(withSpring(1, t.motion.spring));
    // Ambient float: calm sine, ± lift px, phased after the lift lands.
    bob.set(
      withDelay(
        t.motion.reveal,
        withRepeat(withTiming(1, { duration: t.motion.float, easing: t.motion.easing.calm }), -1, true),
      ),
    );
    // Curious wobble: a slow, tiny rotational sway — a friendly wave, not distress.
    if (curious) {
      wobble.set(
        withRepeat(withTiming(1, { duration: t.motion.float, easing: t.motion.easing.calm }), -1, true),
      );
    }
  }, [
    reducedMotion,
    curious,
    appear,
    bob,
    wobble,
    t.motion.spring,
    t.motion.reveal,
    t.motion.float,
    t.motion.easing.calm,
  ]);

  const beeStyle = useAnimatedStyle(() => {
    const a = appear.get();
    return {
      opacity: a,
      transform: [
        // Mount lift collapses as `appear` settles; ambient bob rides ± lift px.
        { translateY: (1 - a) * lift - bob.get() * lift },
        // Curious wobble: ±2° gentle sway, only when curious (wobble stays 0 otherwise).
        { rotate: `${(wobble.get() * 2 - 1) * 2}deg` },
      ],
    };
  });

  const beeSize = size ?? t.burst.bee;
  const backdropSize =
    backdrop === 'soft'
      ? t.companion.softSize
      : backdrop === 'pool'
        ? t.companion.poolSize
        : backdrop === 'disc'
          ? t.companion.discSize
          : 0;
  const boxSize = Math.max(beeSize, backdropSize);

  // In the ring (backdrop set), the bee box is the ONLY flow child so HoneyRing keeps
  // the bee centred; the name is overlaid absolutely at the bottom of the box so it
  // can't push the bee off-centre. Outside the ring (naming modal) the name flows
  // beneath the bee with the usual gap.
  const inRing = backdrop !== 'none';
  const wrap: ViewStyle = inRing ? { alignItems: 'center' } : { alignItems: 'center', gap: t.space[2] };
  const beeBox: ViewStyle = {
    width: boxSize,
    height: boxSize,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const nameStyle: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const nameOverlay: TextStyle = {
    position: 'absolute',
    bottom: t.space[0],
    left: 0,
    right: 0,
    textAlign: 'center',
  };

  return (
    <View style={wrap}>
      <View style={beeBox}>
        {backdrop === 'soft' ? (
          <BeeCoin size={t.companion.softSize} color={t.colors.companionCoin} />
        ) : null}
        {backdrop === 'disc' ? (
          <FlatDisc
            size={t.companion.discSize}
            bg={t.colors.surfaceRaised}
            border={t.companion.discBorder}
            borderColor={t.colors.border}
            radius={t.radii.full}
          />
        ) : null}
        {backdrop === 'pool' ? (
          <HoneyPool
            size={t.companion.poolSize}
            color={t.colors.accent}
            opacity={t.companion.poolOpacity}
          />
        ) : null}
        <Animated.View style={beeStyle}>
          <BeeMascot
            size={beeSize}
            variant={`stage-${stage}`}
            seed={seed}
            glow={glow}
            animated={animated}
          />
        </Animated.View>
        {inRing && name ? <AppText style={[nameStyle, nameOverlay]}>{name}</AppText> : null}
      </View>
      {!inRing && name ? <AppText style={nameStyle}>{name}</AppText> : null}
    </View>
  );
}
