import { View, type ViewStyle } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { BeeMascot } from '@/src/components/BeeMascot';
import { CoinHex } from '@/src/components/bee/CoinHex';

// ──────────────────────────────────────────────────────────────────────────────
// ArchetypeCrest — the hero "collectible crest" for the onboarding reveal. A
// symmetric regular flat-top hexagon (no stroke) filled with a FAINT top-down
// honey gradient, the brand `BeeMascot` resting large inside it, and the `CoinHex`
// seal stamped at the hexagon's TOP-RIGHT corner (near the bee, inside the crest's
// proximity — not the card corner). Pure presentational. Spec: section 2.
// ──────────────────────────────────────────────────────────────────────────────

/** Regular flat-top hexagon: height = width × √3/2 (matches Honeycomb). */
const HEX_RATIO = Math.sqrt(3) / 2;

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

export function ArchetypeCrest({ beeSize }: { beeSize?: number }) {
  const t = useTheme();

  const w = t.reveal.crestW;
  const h = w * HEX_RATIO;
  const bee = beeSize ?? t.reveal.bee;
  const coin = t.reveal.coinHex;
  const path = hexPath(w, h);
  const gradId = 'crestHoney';

  // The flat-top hex's top-right vertex sits at (3w/4, 0). Nudge the coin so its
  // centre lands a touch outside that corner, framing the bee rather than covering
  // it. The coin's own drawing is `coin` wide × (coin × √3/2 + edge) tall.
  const coinH = coin * HEX_RATIO + t.reveal.coinEdge;
  const coinRight = -coin * 0.28;
  const coinTop = -coinH * 0.32;

  const container: ViewStyle = {
    width: w,
    height: h,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const hexFill: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
  const coinSlot: ViewStyle = { position: 'absolute', top: coinTop, right: coinRight };

  return (
    <View style={container} accessibilityRole="image" accessibilityLabel="Your time-personality crest">
      {/* (1) Crest hex — faint top-down honey gradient, NO stroke. */}
      <Svg width={w} height={h} style={hexFill}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.colors.accent} stopOpacity={0.22} />
            <Stop offset="1" stopColor={t.colors.accent} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        <Path d={path} fill={`url(#${gradId})`} />
      </Svg>

      {/* (2) The bee, large, resting inside the crest. Its own backdrop is the hex
          gradient, so the mascot's halo is suppressed (glow={false}). */}
      <BeeMascot size={bee} animated glow={false} />

      {/* (3) Coin-hex seal at the hex's top-right corner, near the bee. */}
      <View style={coinSlot} pointerEvents="none">
        <CoinHex size={coin} />
      </View>
    </View>
  );
}
