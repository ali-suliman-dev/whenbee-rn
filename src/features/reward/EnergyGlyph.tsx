import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';

/** Whatever `withTiming`'s `easing` accepts — a plain fn or a bezier factory. */
type Ease = EasingFunction | EasingFunctionFactory;

// ──────────────────────────────────────────────────────────────────────────────
// EnergyGlyph — the leading illustration for the Reward EnergyChips (Low / OK /
// High), a sibling to ReasonGlyph. A small charge-meter battery: an indigo body
// with amber segment cells (1 / 2 / 3), drawn from Views (not SVG) so each part
// animates independently.
//
// On select, each state plays a ONE-SHOT press animation whose ENERGY maps to the
// label — the cells "charge" up and amber streaks fly off the battery:
//   low  → heavy: the body sinks, the single cell struggles up, streaks fall DOWN
//   ok   → balanced: two cells bounce in, a small jump, a few streaks rise
//   high → energetic: three cells cascade, the whole glyph jumps, the terminal
//          pops, and a full fan of streaks sprays UP
//
// Every part is driven by a single 0→1 progress shared value; `interpolate` bakes
// the keyframe shape (overshoot, hesitation, flicker) so the motion is faithful
// and reduced-motion just renders the final charged battery (no motion, no
// streaks). Geometry is a 24-unit box scaled by `size`; all colors are tokens.
// ──────────────────────────────────────────────────────────────────────────────

export type EnergyKind = 'low' | 'ok' | 'high';

const BOX = 24;
const SEG_X = [5.4, 9.0, 12.6] as const; // segment left edges in the 24-box

const TIRED: Ease = Easing.bezier(0.45, 0.05, 0.55, 1); // low: heavy, no bounce
const SETTLE: Ease = Easing.out(Easing.cubic); // mid/high: lands with the overshoot baked into the keyframes

interface ShardCfg {
  dx: number;
  dy: number;
  r: number;
}
interface KindCfg {
  cells: number;
  barDur: number;
  barDelay: number[]; // per-cell stagger
  barEasing: Ease;
  barIn: number[];
  barScaleY: number[]; // keyframe scaleY (origin bottom) — overshoot lives here
  bodyDur: number;
  bodyP: number[];
  bodySX: number[];
  bodySY: number[];
  bodyEasing: Ease;
  jumpDur: number;
  jumpDelay: number;
  jumpTY: number[]; // translateY keyframe (− up, + down)
  jumpP: number[];
  jumpEasing: Ease;
  nubDur: number;
  nubDelay: number;
  nubP: number[];
  nubS: number[];
  surge: boolean; // high only — the cells surge once after the cascade
  surgeDur: number;
  surgeDelay: number;
  shardDur: number;
  shardDelay: number;
  shardEmitY: number; // emit centre Y in the 24-box (top for up, floor for down)
  shardOpP: number[];
  shardOpV: number[];
  shardEasing: Ease;
  shards: ShardCfg[];
}

// Choreography table (literal durations, as in ReasonGlyph). Energy escalates:
// low is slow + falls, high is fast + sprays up.
const CFG: Record<EnergyKind, KindCfg> = {
  low: {
    cells: 1,
    barDur: 700, barDelay: [0], barEasing: TIRED,
    barIn: [0, 0.5, 0.66, 0.86, 1], barScaleY: [0.2, 0.86, 0.72, 1.04, 1],
    bodyDur: 700, bodyP: [0, 0.46, 1], bodySX: [1, 1, 1], bodySY: [1, 0.94, 1], bodyEasing: TIRED,
    jumpDur: 740, jumpDelay: 0, jumpP: [0, 0.44, 1], jumpTY: [0, 1.4, 0], jumpEasing: TIRED, // sinks DOWN
    nubDur: 640, nubDelay: 140, nubP: [0, 0.45, 1], nubS: [1, 1.16, 1],
    surge: false, surgeDur: 0, surgeDelay: 0,
    shardDur: 920, shardDelay: 200, shardEmitY: 16.6,
    shardOpP: [0, 0.22, 0.54, 0.66, 1], shardOpV: [0, 1, 0.55, 1, 0], shardEasing: TIRED,
    shards: [{ dx: -5, dy: 9, r: 20 }, { dx: 0, dy: 10, r: 0 }, { dx: 5, dy: 9, r: -20 }], // same streaks, splay DOWN
  },
  ok: {
    cells: 2,
    barDur: 540, barDelay: [0, 100], barEasing: SETTLE,
    barIn: [0, 0.58, 0.78, 1], barScaleY: [0.2, 1.13, 0.95, 1],
    bodyDur: 560, bodyP: [0, 0.24, 0.54, 1], bodySX: [1, 1.05, 0.98, 1], bodySY: [1, 0.94, 1.04, 1], bodyEasing: SETTLE,
    jumpDur: 560, jumpDelay: 120, jumpP: [0, 0.44, 1], jumpTY: [0, -1.3, 0], jumpEasing: SETTLE, // small hop up
    nubDur: 500, nubDelay: 170, nubP: [0, 0.44, 1], nubS: [1, 1.32, 1],
    surge: false, surgeDur: 0, surgeDelay: 0,
    shardDur: 640, shardDelay: 190, shardEmitY: 7,
    shardOpP: [0, 0.22, 0.52, 0.64, 1], shardOpV: [0, 1, 0.6, 1, 0], shardEasing: SETTLE,
    shards: [{ dx: -5, dy: -8, r: -28 }, { dx: 0, dy: -9, r: 0 }, { dx: 5, dy: -8, r: 28 }],
  },
  high: {
    cells: 3,
    barDur: 420, barDelay: [55, 120, 185], barEasing: SETTLE,
    barIn: [0, 0.56, 0.78, 1], barScaleY: [0.25, 1.18, 0.93, 1],
    bodyDur: 760, bodyP: [0, 0.14, 0.42, 0.7, 1], bodySX: [1, 1.06, 0.95, 1.02, 1], bodySY: [1, 0.9, 1.1, 0.98, 1], bodyEasing: SETTLE,
    jumpDur: 720, jumpDelay: 180, jumpP: [0, 0.42, 1], jumpTY: [0, -2, 0], jumpEasing: SETTLE, // a real jump up
    nubDur: 480, nubDelay: 310, nubP: [0, 0.42, 1], nubS: [1, 1.55, 1],
    surge: true, surgeDur: 440, surgeDelay: 320,
    shardDur: 700, shardDelay: 305, shardEmitY: 7,
    shardOpP: [0, 0.18, 0.48, 0.62, 1], shardOpV: [0, 1, 0.5, 1, 0], shardEasing: SETTLE,
    shards: [
      { dx: -9, dy: -7, r: -52 }, { dx: -4, dy: -10, r: -22 }, { dx: 0, dy: -11, r: 0 },
      { dx: 4, dy: -10, r: 22 }, { dx: 9, dy: -7, r: 52 },
    ],
  },
};

export function EnergyGlyph({
  kind,
  active,
  size = 24,
}: {
  kind: EnergyKind;
  active: boolean;
  size?: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const cfg = CFG[kind];
  const k = size / BOX;

  // Light theme washes the bright amber + pale indigo out against the near-white
  // chip, so the streaks and cells barely read. Deepen them: sparks + lit cells go
  // to the darker amber (accentEdge) and the battery body takes a stronger fill
  // (primarySoft2). Dark mode keeps the brighter palette — it reads fine there.
  const isLight = t.mode === 'light';
  const amber = isLight ? t.colors.accentEdge : t.colors.accent;
  const bodyFill = isLight ? t.colors.primarySoft2 : t.colors.primarySoft;

  // One progress per moving part. Rest values keep the battery shown CHARGED with
  // no streaks (bars=1 visible; body/jump/nub/surge identity; shards hidden).
  const bar0 = useSharedValue(1);
  const bar1 = useSharedValue(1);
  const bar2 = useSharedValue(1);
  const body = useSharedValue(1);
  const jump = useSharedValue(1);
  const nub = useSharedValue(1);
  const surge = useSharedValue(1);
  const s0 = useSharedValue(0);
  const s1 = useSharedValue(0);
  const s2 = useSharedValue(0);
  const s3 = useSharedValue(0);
  const s4 = useSharedValue(0);
  const bars = [bar0, bar1, bar2];
  const shardSv = [s0, s1, s2, s3, s4];

  useEffect(() => {
    if (!active || reduced) {
      // Rest / reduced: charged battery, no motion, no streaks.
      bars.forEach((b) => b.set(1));
      body.set(1);
      jump.set(1);
      nub.set(1);
      surge.set(1);
      shardSv.forEach((s) => s.set(0));
      return;
    }
    // Play the one-shot. Reset to start, then drive each progress 0→1.
    for (let i = 0; i < cfg.cells; i++) {
      bars[i]?.set(0);
      bars[i]?.set(
        withDelay(cfg.barDelay[i] ?? 0, withTiming(1, { duration: cfg.barDur, easing: cfg.barEasing })),
      );
    }
    body.set(0);
    body.set(withTiming(1, { duration: cfg.bodyDur, easing: cfg.bodyEasing }));
    jump.set(0);
    jump.set(withDelay(cfg.jumpDelay, withTiming(1, { duration: cfg.jumpDur, easing: cfg.jumpEasing })));
    nub.set(0);
    nub.set(withDelay(cfg.nubDelay, withTiming(1, { duration: cfg.nubDur, easing: SETTLE })));
    if (cfg.surge) {
      surge.set(0);
      surge.set(withDelay(cfg.surgeDelay, withTiming(1, { duration: cfg.surgeDur, easing: SETTLE })));
    } else {
      surge.set(1);
    }
    cfg.shards.forEach((_, i) => {
      shardSv[i]?.set(0);
      shardSv[i]?.set(
        withDelay(cfg.shardDelay, withTiming(1, { duration: cfg.shardDur, easing: cfg.shardEasing })),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced, kind]);

  // ── animated styles ──
  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(jump.get(), cfg.jumpP, cfg.jumpTY) * k }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(body.get(), cfg.bodyP, cfg.bodySX) },
      { scaleY: interpolate(body.get(), cfg.bodyP, cfg.bodySY) },
    ],
  }));
  const nubStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(nub.get(), cfg.nubP, cfg.nubS) }],
  }));
  const surgeStyle = useAnimatedStyle(() => ({
    transformOrigin: ['50%', 14 * k, 0], // pivot at the cells' floor, not the glyph's
    transform: [{ scaleY: interpolate(surge.get(), [0, 0.44, 1], [1, 1.07, 1]) }],
  }));
  const barStyle = (sv: typeof bar0) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({
      opacity: interpolate(sv.get(), [0, 0.3, 1], [0, 1, 1]),
      transform: [{ scaleY: interpolate(sv.get(), cfg.barIn, cfg.barScaleY) }],
    }));
  const bar0Style = barStyle(bar0);
  const bar1Style = barStyle(bar1);
  const bar2Style = barStyle(bar2);
  const barStyles = [bar0Style, bar1Style, bar2Style];

  const shardStyle = (sv: typeof s0, sc: ShardCfg) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const p = sv.get();
      return {
        opacity: interpolate(p, cfg.shardOpP, cfg.shardOpV),
        transform: [
          { translateX: interpolate(p, [0, 1], [0, sc.dx]) * k },
          { translateY: interpolate(p, [0, 1], [0, sc.dy]) * k },
          { scale: interpolate(p, [0, 1], [0.5, 0.7]) },
          { rotate: `${sc.r}deg` },
        ],
      };
    });
  const EMPTY: ShardCfg = { dx: 0, dy: 0, r: 0 };
  const sh0 = shardStyle(s0, cfg.shards[0] ?? EMPTY);
  const sh1 = shardStyle(s1, cfg.shards[1] ?? EMPTY);
  const sh2 = shardStyle(s2, cfg.shards[2] ?? EMPTY);
  const sh3 = shardStyle(s3, cfg.shards[3] ?? EMPTY);
  const sh4 = shardStyle(s4, cfg.shards[4] ?? EMPTY);
  const shardStyles = [sh0, sh1, sh2, sh3, sh4];

  // ── static geometry (token colors, 24-box × k) ──
  const fill = (left: number, top: number, w: number, h: number, radius: number): ViewStyle => ({
    position: 'absolute',
    left: left * k,
    top: top * k,
    width: w * k,
    height: h * k,
    borderRadius: radius * k,
  });
  const bodyBox: ViewStyle = {
    ...fill(3, 8, 16, 8, 2.2),
    borderWidth: Math.max(1.3, 1.6 * k),
    borderColor: t.colors.primary,
    backgroundColor: bodyFill,
  };
  const nubBox: ViewStyle = { ...fill(19.4, 10.4, 1.8, 3.2, 0.8), backgroundColor: t.colors.primary };
  const seg = (i: number, lit: boolean): ViewStyle => ({
    ...fill(SEG_X[i] ?? 0, 10, 3, 4, 0.9),
    backgroundColor: lit ? amber : t.colors.primarySoft,
    transformOrigin: 'bottom',
  });
  const shardBox: ViewStyle = {
    position: 'absolute',
    left: (11 - 0.7 / 2) * k,
    top: (cfg.shardEmitY - 2.8 / 2) * k,
    width: 0.7 * k,
    height: 2.8 * k,
    borderRadius: 0.35 * k,
    backgroundColor: amber,
  };

  return (
    <Animated.View
      style={[{ width: size, height: size }, glyphStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* battery outline + terminal — squashes as one; the terminal also pops on High */}
      <Animated.View style={[{ position: 'absolute', width: size, height: size, transformOrigin: 'center' }, bodyStyle]}>
        <View style={bodyBox} />
        <Animated.View style={[nubBox, nubStyle]} />
      </Animated.View>

      {/* unlit segments — static, faint, so the meter shape always reads */}
      {SEG_X.map((_, i) => (i >= cfg.cells ? <View key={`u${i}`} style={seg(i, false)} /> : null))}

      {/* lit cells — rise from the floor; grouped so High can surge them together */}
      <Animated.View style={[{ position: 'absolute', width: size, height: size, transformOrigin: 'bottom' }, surgeStyle]}>
        {SEG_X.map((_, i) =>
          i < cfg.cells ? (
            <Animated.View key={`l${i}`} style={[seg(i, true), barStyles[i]]} />
          ) : null,
        )}
      </Animated.View>

      {/* electric sparks — fly off the battery; direction conveys the energy */}
      {cfg.shards.map((_, i) => (
        <Animated.View key={`s${i}`} style={[shardBox, shardStyles[i]]} />
      ))}
    </Animated.View>
  );
}
