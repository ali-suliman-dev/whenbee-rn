import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Path, Rect, ClipPath, Defs, G } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import type { Tier } from '@/src/domain/types';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// ──────────────────────────────────────────────────────────────────────────────
// Honeycomb — "mastery made visible". One regular flat-top hexagon per tracked
// category, packed in a row. Each cell is amber (`accent`) honey filling from the
// BOTTOM up to its `sharpness%`; the unripe remainder is a flat `hairline` hex
// outline (NO blur / shadow — RN 0.81 Fabric renders boxShadow as a hard line).
// At full ripeness (sharpness ≥ CAP_AT) the cell earns a `accentEdge` wax-cap rim.
//
// MONOTONIC by design: the fill is driven purely from the stored `sharpness`, and
// `sharpness` only ever rises (engine invariant) — so a cell can never drain. The
// fill animates up with a calm `motion.honeyFill` ease-out (honey settling, not a
// bounce); reduced motion sets the final height instantly.
//
// Reused at three sizes (strip / hub / detail) — geometry comes from tokens, never
// inlined. This is a pure presentational component: it reads cells + size, nothing
// from stores.
// ──────────────────────────────────────────────────────────────────────────────

/** Sharpness at which a cell is "Honest" / fully capped (engine tier threshold). */
const CAP_AT = 93;
/** Regular flat-top hexagon: height = width × √3/2. */
const HEX_RATIO = Math.sqrt(3) / 2;
/** Gap between packed cells, as a fraction of cell width. */
const GAP_RATIO = 0.18;

export interface HoneycombCell {
  categoryId: string;
  label: string;
  sharpness: number;
  tier: Tier;
}

export type HoneycombSize = 'strip' | 'hub' | 'detail';

interface HoneycombProps {
  cells: HoneycombCell[];
  size: HoneycombSize;
}

/** Flat-top regular hexagon path inside a `w`×`h` box (h = w × √3/2). */
function hexPath(w: number, h: number): string {
  const qx = w / 4;
  return [
    `M${qx},0`,
    `L${w - qx},0`,
    `L${w},${h / 2}`,
    `L${w - qx},${h}`,
    `L${qx},${h}`,
    `L0,${h / 2}`,
    'Z',
  ].join(' ');
}

interface CellProps {
  cell: HoneycombCell;
  w: number;
  h: number;
  capRim: number;
}

function HoneycombCellSvg({ cell, w, h, capRim }: CellProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const pct = Math.max(0, Math.min(100, cell.sharpness));
  const capped = cell.sharpness >= CAP_AT;
  const clipId = `hc-${cell.categoryId}`;

  // The fill is a bottom-anchored rect clipped to the hex. We animate its TOP edge
  // (`y`) down from empty → the honey line; height fills the gap to the baseline.
  const targetY = useSharedValue(reducedMotion ? h * (1 - pct / 100) : h);

  useEffect(() => {
    const next = h * (1 - pct / 100);
    if (reducedMotion) {
      targetY.set(next);
      return;
    }
    // Calm honey settle — ease-out, no overshoot (monotonic, never bounces back).
    targetY.set(withTiming(next, { duration: t.motion.honeyFill, easing: Easing.out(Easing.cubic) }));
  }, [pct, h, reducedMotion, targetY, t.motion.honeyFill]);

  const fillProps = useAnimatedProps(() => ({
    y: targetY.get(),
    height: h - targetY.get(),
  }));

  const path = hexPath(w, h);

  return (
    <G
      testID={`honeycomb-cell-${cell.categoryId}`}
      accessibilityRole="image"
      accessibilityLabel={`${cell.label} cell — ${Math.round(cell.sharpness)}% honey, tier ${cell.tier}`}
      accessibilityState={{ selected: capped }}
    >
      <Defs>
        <ClipPath id={clipId}>
          <Path d={path} />
        </ClipPath>
      </Defs>

      {/* Honey fill — amber, clipped to the hex, rising from the bottom. */}
      <AnimatedRect
        x={0}
        width={w}
        fill={t.colors.accent}
        clipPath={`url(#${clipId})`}
        animatedProps={fillProps}
      />

      {/* Unripe outline — flat hairline hex wall (no blur). The wax cap, once
          earned, swaps to the darker `accentEdge` rim (and exposes a testID so the
          capped state is assertable without depending on SVG a11y prop forwarding). */}
      <Path
        testID={capped ? `honeycomb-cap-${cell.categoryId}` : undefined}
        d={path}
        fill="none"
        stroke={capped ? t.colors.accentEdge : t.colors.hairline}
        strokeWidth={capped ? capRim : t.borderWidth.hairline}
        strokeLinejoin="round"
      />
    </G>
  );
}

export function Honeycomb({ cells, size }: HoneycombProps) {
  const t = useTheme();

  const w = t.honeycomb[size];
  const h = w * HEX_RATIO;
  const gap = w * GAP_RATIO;
  const capRim = t.honeycomb.capRim;

  if (cells.length === 0) return null;

  const totalW = cells.length * w + (cells.length - 1) * gap;

  const row: ViewStyle = { flexDirection: 'row' };

  return (
    <View style={row}>
      <Svg width={totalW} height={h}>
        {cells.map((cell, i) => (
          <G key={cell.categoryId} x={i * (w + gap)}>
            <HoneycombCellSvg cell={cell} w={w} h={h} capRim={capRim} />
          </G>
        ))}
      </Svg>
    </View>
  );
}
