import Svg, { Polygon } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// HoneyHex — a small flat-top honey cell, the app's honeycomb unit used as a honey
// marker (the category tier pill, the honest-number seal). Shares the flat-top
// geometry of HoneyPips / Honeycomb so every honey cell in the app reads as one.
// ──────────────────────────────────────────────────────────────────────────────

export function HoneyHex({ size = 12, color }: { size?: number; color?: string }) {
  const t = useTheme();
  const s = size;
  // flat-top hexagon inscribed in an s×s box (same as HoneyPips)
  const points = `${s * 0.25},0 ${s * 0.75},0 ${s},${s * 0.5} ${s * 0.75},${s} ${s * 0.25},${s} 0,${s * 0.5}`;
  return (
    <Svg width={s} height={s}>
      <Polygon points={points} fill={color ?? t.brand.honeyFill} />
    </Svg>
  );
}
