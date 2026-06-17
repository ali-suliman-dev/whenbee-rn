import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// Honey ring around the bee. Track + amber fill arc to `sharpness%` (clamped,
// with the endowed-sliver floor so Raw is never a cold empty circle). Centered
// children (the bee slot). When sealed, a flat wax-seal hex overlays the bee.
// No glow — flat-tactical only.
export function HoneyRing({
  sharpness,
  sealed,
  children,
}: {
  sharpness: number;
  sealed: boolean;
  children: ReactNode;
}) {
  const t = useTheme();
  const S = t.ring.size;
  const sw = t.ring.stroke;
  const r = (S - sw) / 2;
  const cx = S / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(t.ring.endowedPct, Math.min(100, sharpness));
  const dashoffset = circumference * (1 - pct / 100);

  const wrap: ViewStyle = {
    width: S,
    height: S,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const svgAbsolute: ViewStyle = { position: 'absolute' };

  return (
    <View style={wrap}>
      <View style={svgAbsolute} pointerEvents="none">
        <Svg width={S} height={S}>
          <Defs>
            <LinearGradient id="honeyGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={t.brand.bee.stripe} />
              <Stop offset="1" stopColor={t.colors.accent} />
            </LinearGradient>
          </Defs>
          {/* rotate -90° so the fill arc starts at 12 o'clock */}
          <G rotation={-90} origin={`${cx}, ${cx}`}>
            <Circle
              cx={cx}
              cy={cx}
              r={r}
              stroke={t.colors.ringTrack}
              strokeWidth={sw}
              fill="none"
            />
            <Circle
              cx={cx}
              cy={cx}
              r={r}
              stroke="url(#honeyGrad)"
              strokeWidth={sw}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashoffset}
            />
          </G>
          {sealed ? <SealHex cx={cx} size={t.seal.size} color={t.colors.accent} /> : null}
        </Svg>
      </View>
      {children}
    </View>
  );
}

// Flat-top hexagon stamped over the bee centre when the cap is sealed.
// Rendered as an SVG Polygon — no RN View, no glow, flat-tactical.
function SealHex({ cx, size, color }: { cx: number; size: number; color: string }) {
  const w = size;
  const h = size * 1.1;
  const x = cx - w / 2;
  const y = cx - h / 2;
  // Flat-top hexagon vertices (clockwise from top-left shoulder):
  const points = [
    [x + w * 0.5, y],
    [x + w, y + h * 0.25],
    [x + w, y + h * 0.75],
    [x + w * 0.5, y + h],
    [x, y + h * 0.75],
    [x, y + h * 0.25],
  ]
    .map((p) => p.join(','))
    .join(' ');

  return <Polygon points={points} fill={color} opacity={0.95} />;
}
