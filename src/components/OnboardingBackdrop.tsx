import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

export function OnboardingBackdrop() {
  const t = useTheme();
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="ob-top" cx="50%" cy="-8%" rx="115%" ry="52%">
          <Stop offset="0" stopColor={t.colors.primary} stopOpacity={t.gradients.backdropTop} />
          <Stop offset="0.58" stopColor={t.colors.primary} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="ob-corner" cx="10%" cy="108%" rx="90%" ry="48%">
          <Stop offset="0" stopColor={t.colors.primaryEdge} stopOpacity={t.gradients.backdropCorner} />
          <Stop offset="0.6" stopColor={t.colors.primaryEdge} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={t.colors.bg} />
      <Rect width="100%" height="100%" fill="url(#ob-top)" />
      <Rect width="100%" height="100%" fill="url(#ob-corner)" />
    </Svg>
  );
}
