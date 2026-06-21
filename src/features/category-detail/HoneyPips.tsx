import Svg, { Polygon } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// Flat-top hexagon honey cells in a single row. One SVG (not one per pip) keeps
// it cheap. Filled cells = honey, remaining = the raised surface (a quiet ghost).
export function HoneyPips({ filled, total }: { filled: number; total: number }) {
  const t = useTheme();
  const s = t.honeycomb.pip; // cell box (square); hexagon inscribed
  const gap = t.space[1.5];
  const w = total * s + (total - 1) * gap;
  // flat-top hexagon points within an s×s box
  const hex = (x: number) =>
    `${x + s * 0.25},0 ${x + s * 0.75},0 ${x + s},${s * 0.5} ${x + s * 0.75},${s} ${x + s * 0.25},${s} ${x},${s * 0.5}`;
  return (
    <Svg width={w} height={s}>
      {Array.from({ length: total }, (_, i) => (
        <Polygon
          key={i}
          points={hex(i * (s + gap))}
          fill={i < filled ? t.brand.honeyFill : t.colors.surfaceRaised}
        />
      ))}
    </Svg>
  );
}
