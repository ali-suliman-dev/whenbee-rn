import { View, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';

// ──────────────────────────────────────────────────────────────────────────────
// CoinHex — a small gold "coin" seal. A tactile honey coin: a gradient amber round
// FACE sitting on a darker `accentEdge` round EDGE that peeks below (the coin-edge
// depth borrowed from CoinBadge / AppButton), with a `✦` mark centred.
//
// Built with react-native-svg: TWO circles. The darker edge circle is offset DOWN
// by the coin-edge depth; the gradient face circle (lit honey → `accent`) sits on
// top. The mark rides in an absolute overlay so it stays crisp text in `onAmber`.
// Display-only — never pressable, no border.
// ──────────────────────────────────────────────────────────────────────────────

export function CoinHex({ size, mark = '✦' }: { size?: number; mark?: string }) {
  const t = useTheme();

  const w = size ?? t.reveal.coinHex;
  const r = w / 2;
  const edge = t.reveal.coinEdge;
  const gradId = 'coinFace';

  // The coin reads as a face disc lifted off a darker edge disc peeking below it.
  // Total drawing height = diameter + the edge depth poking past the bottom.
  const wrapper: ViewStyle = { width: w, height: w + edge };

  const markStyle: TextStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: w,
    height: w,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: w,
    // Larger fraction so the ✦ keeps its size as the disc shrinks (the mark must
    // not scale down with a smaller coin).
    fontSize: w * 0.48,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.onAmber,
  };

  return (
    <View style={wrapper} accessibilityRole="image" accessibilityLabel="Honey coin seal">
      <Svg width={w} height={w + edge}>
        <Defs>
          {/* Lit honey at the top settling to the amber accent at the foot — a coin
              catching light, not a flat disc. */}
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.brand.honeyFill} />
            <Stop offset="1" stopColor={t.colors.accent} />
          </LinearGradient>
        </Defs>

        {/* Edge disc — darker, offset straight down so it reads as the coin's rim. */}
        <Circle cx={r} cy={r + edge} r={r} fill={t.colors.accentEdge} />

        {/* Face disc — the lit honey gradient, on top. */}
        <Circle cx={r} cy={r} r={r} fill={`url(#${gradId})`} />
      </Svg>

      {/* Mark — crisp text centred on the face (not the edge). */}
      <AppText style={markStyle}>{mark}</AppText>
    </View>
  );
}
