import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import type { DiscoveryDirection } from './discoveryDisplay';

// Flat-top honey hexagon (viewBox 30×30) with a centered sign:
//   longer → amber outline + amber "+"   (runs longer than you guess)
//   faster → green outline + green "−"    (runs faster — good news)
const HEX = 'M15 1.5 27 8.25v13.5L15 28.5 3 21.75V8.25z';
const PLUS = 'M15 10v10 M10 15h10';
const MINUS = 'M10 15h10';

export function DiscoveryHex({
  direction,
  size,
}: {
  direction: DiscoveryDirection;
  size: number;
}) {
  const t = useTheme();
  const longer = direction === 'longer';
  const stroke = longer ? t.colors.accent : t.colors.success;
  const fill = longer ? t.colors.accentSoft : t.colors.successSoft;
  const sign = longer ? PLUS : MINUS;

  return (
    <Svg width={size} height={size} viewBox="0 0 30 30">
      <Path d={HEX} fill={fill} stroke={stroke} strokeWidth={1.4} />
      <Path d={sign} stroke={stroke} strokeWidth={2.3} strokeLinecap="round" />
    </Svg>
  );
}
