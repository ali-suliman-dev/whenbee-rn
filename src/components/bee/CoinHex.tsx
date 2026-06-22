import { View, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';

// ──────────────────────────────────────────────────────────────────────────────
// CoinHex — a small gold "coin" hexagon seal. A tactile honey coin: a gradient
// amber FACE sitting on a darker `accentEdge` bottom EDGE that peeks below (the
// coin-edge depth borrowed from CoinBadge / AppButton), with a `✦` mark centred.
//
// Built with react-native-svg: TWO flat-top hexes (the `hexPath` from Honeycomb).
// The darker edge hex is offset DOWN by the coin-edge depth; the gradient face hex
// (lit honey → `accent`) sits on top. The mark rides in an absolute overlay so it
// stays crisp text in `onAmber`. Display-only — never pressable, no border.
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

export function CoinHex({ size, mark = '✦' }: { size?: number; mark?: string }) {
  const t = useTheme();

  const w = size ?? t.reveal.coinHex;
  const h = w * HEX_RATIO;
  const edge = t.reveal.coinEdge;
  const path = hexPath(w, h);
  const gradId = 'coinHexFace';

  // The coin reads as a face hex lifted off a darker edge hex peeking below it.
  // Total drawing height = face height + the edge depth poking past the bottom.
  const wrapper: ViewStyle = { width: w, height: h + edge };

  const markStyle: TextStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: w,
    height: h,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: h,
    fontSize: w * 0.42,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.onAmber,
  };

  return (
    <View style={wrapper} accessibilityRole="image" accessibilityLabel="Honey coin seal">
      <Svg width={w} height={h + edge}>
        <Defs>
          {/* Lit honey at the top settling to the amber accent at the foot — a coin
              catching light, not a flat disc. */}
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.brand.honeyFill} />
            <Stop offset="1" stopColor={t.colors.accent} />
          </LinearGradient>
        </Defs>

        {/* Edge hex — darker, offset straight down so it reads as the coin's rim. */}
        <G y={edge}>
          <Path d={path} fill={t.colors.accentEdge} />
        </G>

        {/* Face hex — the lit honey gradient, on top. */}
        <Path d={path} fill={`url(#${gradId})`} />
      </Svg>

      {/* Mark — crisp text centred on the face (not the edge). */}
      <AppText style={markStyle}>{mark}</AppText>
    </View>
  );
}
