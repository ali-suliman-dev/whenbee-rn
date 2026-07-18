import { useCallback, useEffect } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect, Circle, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Companion micro-life geometry (viewBox units, art-internal like the paths) ──
// The two eyes are 50×100 ink rects centred on y≈937. Blink collapses each to a
// thin slit about that centre; a slow glance slides both a shared amount sideways.
const EYE_OPEN = 100; // open eye height
const EYE_SLIT = 8; // closed eye height (a calm slit, never fully gone)
const EYE_MID_Y = 937; // vertical centre the slit collapses toward
const LOOK_SHIFT = 70; // ± eye glance travel (viewBox units — the pupils lead the look)
const WING_FOLD = 0.05; // ± wing scaleX flutter (small + slow = a calm settle, not a buzz)
// Body follows the glance: a small lean (fraction of render size) + a gentle tilt the
// same way, so the WHOLE bee reads as turning to look left/right — not just its eyes.
const BODY_LEAN = 0.035; // ± horizontal lean as a fraction of size (≈5px at 140)
const BODY_TILT = 2; // ± degrees of turn toward the look direction

// ── "Proud seal" celebrate entrance (Pro-drawer, plays once on mount) ──────────
// A distinctly bigger wing fold than the calm ambient hum (buzz, not a hover),
// and a small once-only antenna rotate. Origin sits between the two antenna
// bases so the whole cluster perks as one unit.
const WING_BUZZ_FOLD = 0.22; // ± wing scaleX during the one-shot entrance buzz
const ANTENNA_PERK_DEG = 7; // ± degrees of the once-only antenna perk
const ANTENNA_ORIGIN_X = 1160;
const ANTENNA_ORIGIN_Y = 430;

// ──────────────────────────────────────────────────────────────────────────────
// BeeMascot — the brand Whenbee, a hand-authored react-native-svg translation of
// website-2.0/assets/bee.svg (source kept at src/assets/illustrations/bee.svg).
// Same approach as WhenbeeAvatar's SVG — no svg-transformer dependency.
//
// ONE base artwork at every stage (no per-variant asset). The 6-stage companion
// "expression" is layered ON the base via a single input:
//   • stage 1..6 → a soft amber GLOW halo whose radius grows with presence
//     (companion.glow token; stages 1–2 have none — a young bee is plain).
//
// Colors are token-sourced from `brand.bee` (fixed, mode-independent — a mascot
// reads as the same bee in light and dark, like a logo) — with ONE exception: the
// WING. The pale cream wing (`wing`) dissolves on the light ground, so light mode
// uses the deeper `wingLight`; dark keeps `wing`. Every other color stays fixed.
// The bee's YELLOWS are the fixed honey tokens at ALL times — never recolored.
// (An earlier per-install seed
// hue-shift could drift the head shadow toward red-orange and flashed reddish on
// first render when the real seed loaded; honey-always removes both problems.)
// ──────────────────────────────────────────────────────────────────────────────

export type BeeVariant =
  | 'stage-1'
  | 'stage-2'
  | 'stage-3'
  | 'stage-4'
  | 'stage-5'
  | 'stage-6'
  | 'default';

/** Parse the 1..6 stage out of a `stage-N` variant; `default` → 1 (plainest bee). */
function stageOf(variant: BeeVariant): number {
  if (variant === 'default') return 1;
  const n = Number(variant.slice('stage-'.length));
  return Number.isFinite(n) ? Math.max(1, Math.min(6, n)) : 1;
}

export function BeeMascot({
  size = 88,
  variant = 'default',
  animated = false,
  glow = true,
  celebrate = false,
  sleepy = false,
}: {
  size?: number;
  variant?: BeeVariant;
  /**
   * Retained for caller compatibility only — the bee's yellows are fixed honey and
   * no longer recolored, so the seed has no visual effect. Safe to stop passing.
   */
  seed?: number;
  /** Opt-in in-place wing flutter (onboarding companion). Off everywhere else. */
  animated?: boolean;
  /** When false, the amber/drift glow halo is not rendered. Default true. */
  glow?: boolean;
  /**
   * One-shot "Proud seal" entrance for the Pro-drawer bee (BeeBurst's `upgrade`
   * variant only): wings buzz + antennae perk once on mount, a honey glow blooms,
   * then both eyes blink continuously forever (no wink — both together). Independent
   * of `animated`/`look` — do not combine with `animated` on the same instance.
   * Reduced-motion → final static state (open eyes, wings at rest, glow settled).
   */
  celebrate?: boolean;
  /**
   * Dozing expression for empty/resting states (e.g. What's New with nothing to
   * show): swaps the two open-eye rects for short downward-arc closed-eye paths.
   * Purely static — never combine with `animated`/`celebrate`; when true it always
   * wins and renders the calm resting artwork regardless of those props.
   */
  sleepy?: boolean;
}) {
  const t = useTheme();
  const c = t.brand.bee;
  const reduced = useReducedMotion();

  const stage = stageOf(variant);
  // noUncheckedIndexedAccess: glow array may be undefined-at-index — fall back to 0.
  const glowRadius = t.companion.glow[stage - 1] ?? 0;
  // Celebrate always shows a full honey-glow bloom regardless of companion stage
  // (the Pro-drawer bee isn't tied to the hub's presence-stage glow ladder) —
  // reuses the existing top-of-ladder token rather than inventing a new one.
  const celebrateGlowRadius = t.companion.glow[t.companion.glow.length - 1] ?? 0;
  const effectiveGlowRadius = celebrate ? celebrateGlowRadius : glowRadius;
  const showCelebrateMotion = celebrate && !reduced;

  // The bee's yellows are the fixed honey tokens at ALL times (band + head-shadow).
  const stripe = c.stripe;
  const stripeLo = c.stripeLo;
  // Wing is the one mode-aware bee color: the pale cream `wing` vanishes on the
  // light ground, so light mode uses the deeper `wingLight`; dark keeps `wing`.
  const wing = t.mode === 'dark' ? c.wing : c.wingLight;

  // ── Three calm, looping layers of life (premium, never busy) ──────────────────
  //   • flutter — wings buzz in place: small + fast = an insect hum, not a bird flap
  //   • blink   — a single eyelid close/open every few seconds (long calm rest between)
  //   • look    — eyes glance slowly right, dwell, glance left, dwell, recentre
  // All start on mount and loop forever; reduced-motion holds every layer still.
  const flutter = useSharedValue(0);
  const blink = useSharedValue(0);
  const look = useSharedValue(0);

  const m = t.motion;
  useAmbientMotion(
    Boolean(animated) && !reduced,
    useCallback(() => {
      flutter.set(withRepeat(withTiming(1, { duration: m.beeWingBuzz, easing: m.easing.calm }), -1, true));
      blink.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: m.beeBlink, easing: m.easing.calm }),
            withTiming(0, { duration: m.beeBlink, easing: m.easing.calm }),
            withDelay(m.beeBlinkGap, withTiming(0, { duration: 0 })),
          ),
          -1,
        ),
      );
      look.set(
        withRepeat(
          withSequence(
            withDelay(m.beeLookHold, withTiming(1, { duration: m.beeLook, easing: m.easing.calm })),
            withDelay(m.beeLookHold, withTiming(-1, { duration: m.beeLook, easing: m.easing.calm })),
            withDelay(m.beeLookHold, withTiming(0, { duration: m.beeLook, easing: m.easing.calm })),
          ),
          -1,
        ),
      );
      return () => {
        cancelAnimation(flutter);
        cancelAnimation(blink);
        cancelAnimation(look);
        flutter.set(0);
        blink.set(0);
        look.set(0);
      };
    }, [flutter, blink, look, m]),
  );

  // ── Celebrate: the one-shot "Proud seal" entrance (independent of the ambient
  // hub loop above — never combined with `animated` on the same instance). Ray
  // shimmer + seal scale-in + glow bloom live in RayBurst/CoinBadge/here; this
  // effect owns the wing buzz, the once-only antenna perk, and — once the wings
  // settle — kicks off the same continuous both-eye blink shape the hub uses.
  const antennaPerk = useSharedValue(0);
  const glowBloom = useSharedValue(0);
  useEffect(() => {
    if (!showCelebrateMotion) return undefined;
    const buzzLeg = m.beeWingBuzz / 2;
    flutter.set(
      withSequence(
        withTiming(1, { duration: buzzLeg, easing: m.easing.standard }),
        withTiming(0, { duration: buzzLeg, easing: m.easing.standard }),
        withTiming(1, { duration: buzzLeg, easing: m.easing.standard }),
        withTiming(0, { duration: buzzLeg, easing: m.easing.out }),
      ),
    );
    antennaPerk.set(
      withDelay(
        m.beeWingBuzz,
        withSequence(
          withTiming(-1, { duration: m.fast, easing: m.easing.out }),
          withTiming(0.4, { duration: m.fast, easing: m.easing.out }),
          withTiming(0, { duration: m.fast, easing: m.easing.out }),
        ),
      ),
    );
    glowBloom.set(
      withSequence(
        withTiming(1, { duration: m.reveal, easing: m.easing.out }),
        withTiming(0.82, { duration: m.slow, easing: m.easing.out }),
      ),
    );
    // Both eyes blink together (never a wink), starting only after the wings
    // and antennae have settled, then looping forever — same shape as the
    // ambient hub blink above.
    const blinkStart = m.beeWingBuzz * 2 + m.fast * 3;
    blink.set(
      withDelay(
        blinkStart,
        withRepeat(
          withSequence(
            withTiming(1, { duration: m.beeBlink, easing: m.easing.calm }),
            withTiming(0, { duration: m.beeBlink, easing: m.easing.calm }),
            withDelay(m.beeBlinkGap, withTiming(0, { duration: 0 })),
          ),
          -1,
        ),
      ),
    );
    return () => {
      cancelAnimation(flutter);
      cancelAnimation(antennaPerk);
      cancelAnimation(glowBloom);
      cancelAnimation(blink);
      flutter.set(0);
      antennaPerk.set(0);
      glowBloom.set(0);
      blink.set(0);
    };
  }, [showCelebrateMotion, flutter, antennaPerk, glowBloom, blink, m]);

  const wingFoldAmount = celebrate ? WING_BUZZ_FOLD : WING_FOLD;
  const wingStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 - wingFoldAmount * flutter.get() }],
  }));

  const antennaProps = useAnimatedProps(() => ({
    rotation: antennaPerk.get() * ANTENNA_PERK_DEG,
  }));

  const glowAnimatedProps = useAnimatedProps(() => ({
    opacity: glowBloom.get(),
  }));

  // Each eye: height collapses to a slit toward EYE_MID_Y (blink), x slides with the
  // glance. Kept as two calls (not a loop/helper) to honour the rules of hooks; both
  // ink rects move together so it reads as one pair of eyes blinking and glancing.
  const leftEyeProps = useAnimatedProps(() => {
    const height = EYE_OPEN - blink.get() * (EYE_OPEN - EYE_SLIT);
    return { x: 995 + look.get() * LOOK_SHIFT, y: EYE_MID_Y - height / 2, height };
  });
  const rightEyeProps = useAnimatedProps(() => {
    const height = EYE_OPEN - blink.get() * (EYE_OPEN - EYE_SLIT);
    return { x: 1355 + look.get() * LOOK_SHIFT, y: EYE_MID_Y - height / 2, height };
  });

  // Body-lean: the whole bee leans + tilts toward the glance, so a left/right look
  // reads as a turn of the body, not just the eyes sliding. Secondary to the eyes.
  const bodyLeanStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: look.get() * BODY_LEAN * size },
      { rotate: `${look.get() * BODY_TILT}deg` },
    ],
  }));

  // Clamp the halo radius to the viewBox half (1200): the Svg canvas is square and
  // clips anything past its bounds, so a circle larger than 1200 gets cropped to a
  // BOX. Keeping the transparent rim at exactly the edge renders a clean circle.
  const haloRadius = Math.min(1100 + effectiveGlowRadius * 40, 1200);
  const glowHalo =
    glow && effectiveGlowRadius > 0 ? (
      <>
        <Defs>
          <RadialGradient id="beeGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={stripe} stopOpacity={0.5} />
            <Stop offset="100%" stopColor={stripe} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {showCelebrateMotion ? (
          <AnimatedCircle cx={1200} cy={1200} r={haloRadius} fill="url(#beeGlow)" animatedProps={glowAnimatedProps} />
        ) : (
          <Circle cx={1200} cy={1200} r={haloRadius} fill="url(#beeGlow)" />
        )}
      </>
    ) : null;

  const wings = (
    <>
      <Path
        d="M1310 1195.19C1310 1080.48 1388.07 980.481 1499.37 952.658L1799.37 877.658C1957.15 838.212 2110 957.551 2110 1120.19V1279.81C2110 1442.45 1957.15 1561.79 1799.37 1522.34L1499.37 1447.34C1388.07 1419.52 1310 1319.52 1310 1204.81V1195.19Z"
        fill={wing}
      />
      <Path
        d="M290 1120.19C290 957.551 442.847 838.212 600.634 877.658L900.634 952.658C1011.93 980.481 1090 1081.46 1090 1196.18C1090 1309.81 1013.38 1410.11 903.475 1438.96L603.474 1517.71C444.989 1559.32 290 1439.76 290 1275.91V1120.19Z"
        fill={wing}
      />
    </>
  );

  // Antennae — static pair (shared/reduced usage) vs. celebrate pair, which rides
  // an added one-shot perk rotation (AnimatedG) on top of the artwork's own
  // static ±15° tilt. The perk origin sits between the two antenna bases.
  const antennaeContent = (
    <>
      {/* Right antenna (rotation via originX/originY props — the proven RN-SVG path) */}
      <Rect x={1320.26} y={426.085} width={50} height={200} rotation={15} originX={1320.26} originY={426.085} fill={c.antenna} />
      <Rect x={1309.06} y={371.318} width={100} height={100} rx={40} rotation={15} originX={1309.06} originY={371.318} fill={c.antenna} />
      <Path
        d="M1328.34 395.912C1329.77 390.578 1335.25 387.412 1340.59 388.841L1371.59 397.148C1376.92 398.577 1380.09 404.06 1378.66 409.395C1377.23 414.729 1371.75 417.895 1366.41 416.466L1335.41 408.16C1330.08 406.73 1326.91 401.247 1328.34 395.912Z"
        fill={c.antennaHi}
      />

      {/* Left antenna */}
      <Rect x={1031.44} y={439.025} width={50} height={200} rotation={-15} originX={1031.44} originY={439.025} fill={c.antenna} />
      <Rect x={994.352} y={397.201} width={100} height={100} rx={40} rotation={-15} originX={994.352} originY={397.201} fill={c.antenna} />
      <Path
        d="M1058.41 389.803C1063.75 388.374 1069.23 391.54 1070.66 396.874C1072.09 402.209 1068.92 407.692 1063.59 409.121L1033.59 417.16C1028.25 418.589 1022.77 415.424 1021.34 410.089C1019.91 404.755 1023.08 399.271 1028.41 397.841L1058.41 389.803Z"
        fill={c.antennaHi}
      />
    </>
  );

  // Dozing mouth — a small content/closed arc replacing the awake smile, so the
  // resting face reads as dozing rather than "eyes shut at attention". Matches
  // the approved mock's mouth path exactly. Defined ahead of `front` (below)
  // since it's referenced there.
  const sleepyMouth = <Path d="M1150 1090 q50 26 100 0" stroke={c.ink} strokeWidth={22} fill="none" strokeLinecap="round" />;

  // Everything that sits on TOP of the wings (drawn after them in z-order).
  const front = (
    <>
      {/* Stinger (behind the body) */}
      <Rect x={1100} y={1700} width={200} height={200} rx={80} fill={c.ink} />

      {showCelebrateMotion ? (
        <AnimatedG originX={ANTENNA_ORIGIN_X} originY={ANTENNA_ORIGIN_Y} animatedProps={antennaProps}>
          {antennaeContent}
        </AnimatedG>
      ) : (
        antennaeContent
      )}

      {/* Body */}
      <Path
        d="M690 1000C690 751.472 891.472 550 1140 550H1260C1508.53 550 1710 751.472 1710 1000V1340C1710 1621.67 1481.67 1850 1200 1850V1850C918.335 1850 690 1621.67 690 1340V1000Z"
        fill={c.body}
      />
      {/* Body top highlight */}
      <Path
        d="M1200 593C1265.78 593 1312.52 593.502 1375.85 614.444C1388.96 618.78 1396.07 632.921 1391.74 646.029C1387.4 659.138 1373.26 666.251 1360.15 661.916C1305.08 643.704 1265.4 643 1200 643C1134.6 643 1094.92 643.704 1039.85 661.916C1026.74 666.251 1012.6 659.138 1008.26 646.029C1003.93 632.921 1011.04 618.78 1024.15 614.444C1087.48 593.502 1134.22 593 1200 593Z"
        fill={c.bodyHi}
      />
      {/* Body bottom shade */}
      <Path
        d="M1710 1340C1710 1621.67 1481.67 1850 1200 1850C918.335 1850 690 1621.67 690 1340V1265C690 1546.67 918.335 1775 1200 1775C1481.67 1775 1710 1546.67 1710 1265V1340Z"
        fill={c.bodyLo}
      />

      {/* Amber stripes — seed-recolored within the amber family */}
      <Path d="M1710 1340C1710 1374.23 1706.63 1407.66 1700.2 1440H699.802C693.373 1407.66 690 1374.23 690 1340V1300H1710V1340Z" fill={stripe} />
      <Path d="M1669.29 1540C1647.27 1591.59 1617 1638.81 1580.13 1680H819.863C782.995 1638.81 752.725 1591.59 730.711 1540H1669.29Z" fill={stripe} />

      {/* Head band + shadow */}
      <Path
        d="M1350 697C1484.72 697 1594.55 803.565 1599.8 937H1600V980C1600 1101.5 1501.5 1200 1380 1200H1020C898.497 1200 800 1101.5 800 980V937H800.197C805.446 803.565 915.278 697 1050 697C1106.28 697 1158.22 715.598 1200 746.982C1241.78 715.598 1293.72 697 1350 697Z"
        fill={stripe}
      />
      <Path
        d="M1599.25 927.505C1599.49 930.654 1599.68 933.819 1599.8 937H1600V980C1600 1101.5 1501.5 1200 1380 1200H1020C898.497 1200 800 1101.5 800 980V937H800.197C800.322 933.819 800.506 930.654 800.749 927.505C810.7 1056.46 918.493 1158 1050 1158H1350C1481.51 1158 1589.3 1056.46 1599.25 927.505Z"
        fill={stripeLo}
      />

      {/* Mouth: the awake smile, or (sleepy) the mock's content/closed dozing
          arc — swapped so the resting face reads as dozing, not "eyes shut at
          attention" (eyes are drawn separately so they can blink/glance). */}
      {sleepy ? (
        sleepyMouth
      ) : (
        <Path
          d="M1245.64 1084.39C1253.16 1083.14 1260 1088.94 1260 1096.55C1260 1102.58 1255.64 1107.73 1249.7 1108.72L1241.5 1110.08C1214.02 1114.66 1185.98 1114.66 1158.5 1110.08L1150.3 1108.72C1144.36 1107.73 1140 1102.58 1140 1096.55C1140 1088.94 1146.84 1083.14 1154.36 1084.39L1162.99 1085.83C1187.5 1089.92 1212.5 1089.92 1237.01 1085.83L1245.64 1084.39Z"
          fill={c.ink}
        />
      )}
    </>
  );

  // Eyes — static pair (shared/reduced usage) vs. animated pair (hub micro-life).
  const staticEyes = (
    <>
      <Rect x={1355} y={887} width={50} height={100} rx={25} fill={c.ink} />
      <Rect x={995} y={887} width={50} height={100} rx={25} fill={c.ink} />
    </>
  );
  // Dozing eyes — short downward-arc closed lids, centred on the same eye
  // positions as the open rects above (rect centre x=1020/1380 → arc spans
  // ±45 either side). Stroke, not fill, so it reads as a closed lid crease.
  const sleepyEyes = (
    <>
      <Path d="M1315 930 q45 34 90 0" stroke={c.ink} strokeWidth={26} fill="none" strokeLinecap="round" />
      <Path d="M955 930 q45 34 90 0" stroke={c.ink} strokeWidth={26} fill="none" strokeLinecap="round" />
    </>
  );
  const animatedEyes = (
    <>
      <AnimatedRect width={50} rx={25} fill={c.ink} animatedProps={rightEyeProps} />
      <AnimatedRect width={50} rx={25} fill={c.ink} animatedProps={leftEyeProps} />
    </>
  );

  const a11y = {
    accessibilityRole: 'image' as const,
    accessibilityLabel: 'Your Whenbee companion',
  };

  // Static path (every shared usage, and celebrate under reduced-motion): one
  // Svg, original z-order preserved — final state, no motion. `sleepy` always
  // wins (dozing is a static resting expression, never animated).
  if (sleepy || !(animated || celebrate) || reduced) {
    // Dozing gets a slight head tilt (mirrors the approved mock's
    // `rotate(8 1200 1200)`) so the resting pose reads as relaxed rather than
    // upright-with-eyes-shut. Only the art rotates — the glow halo is a circle
    // centred on the same rotation origin, so it is visually unaffected either
    // way; keep it outside the group for clarity.
    const art = (
      <>
        {wings}
        {front}
        {sleepy ? sleepyEyes : staticEyes}
      </>
    );
    return (
      <Svg width={size} height={size} viewBox="0 0 2400 2400" {...a11y}>
        {glowHalo}
        {sleepy ? (
          <G rotation={8} originX={1200} originY={1200}>
            {art}
          </G>
        ) : (
          art
        )}
      </Svg>
    );
  }

  // Animated: the whole bee leans with the glance (bodyLeanStyle); inside, wings get
  // their own flutter layer (behind), body/face ride on top, and the eyes (top-most)
  // blink + glance on their own animated props.
  return (
    <Animated.View style={[{ width: size, height: size }, bodyLeanStyle]} {...a11y}>
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0, transformOrigin: 'center' }, wingStyle]}
      >
        <Svg width={size} height={size} viewBox="0 0 2400 2400">
          {glowHalo}
          {wings}
        </Svg>
      </Animated.View>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 2400 2400"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {front}
        {animatedEyes}
      </Svg>
    </Animated.View>
  );
}
