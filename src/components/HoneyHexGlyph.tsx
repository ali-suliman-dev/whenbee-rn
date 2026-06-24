import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// HoneyHexGlyph — ONE minimal honey-filled flat-top hexagon. The small header
// glyph on the Patterns archetype stat-sheet (replaces the bee). No border, no
// blur — just a single clean hex with a top-down honey gradient (lit honey at the
// top settling to the amber accent / edge at the bottom).
//
// Pure presentational: it reads only `size` + tokens, nothing from stores. A
// regular flat-top hexagon (height = width × √3/2), so it stays geometrically
// true at any size.
// ──────────────────────────────────────────────────────────────────────────────

/** Regular flat-top hexagon: height = width × √3/2. */
const HEX_RATIO = Math.sqrt(3) / 2;

interface HoneyHexGlyphProps {
  /** Hexagon WIDTH in points (point-to-point across the flats). */
  size?: number;
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

export function HoneyHexGlyph({ size }: HoneyHexGlyphProps) {
  const t = useTheme();

  const w = size ?? t.honeyGlyph.w;
  const h = w * HEX_RATIO;
  const path = hexPath(w, h);

  return (
    <Svg width={w} height={h} accessibilityRole="image" accessibilityLabel="Honey">
      <Defs>
        {/* Top-down honey gradient: lit honey crest → amber accent → darker edge. */}
        <LinearGradient id="honeyHexFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.brand.honeyFill} />
          <Stop offset="0.55" stopColor={t.colors.accent} />
          <Stop offset="1" stopColor={t.colors.accentEdge} />
        </LinearGradient>
      </Defs>

      <Path d={path} fill="url(#honeyHexFill)" />
    </Svg>
  );
}
