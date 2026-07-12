import { useEffect } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { confidenceLabel } from '@/src/features/patterns/focusCopy';
import type { FocusConfidenceTier } from '@/src/domain/types';

export interface FocusConfidenceMeterProps {
  tier: FocusConfidenceTier;
  fill: number; // 0–1
}

export function FocusConfidenceMeter({ tier, fill }: FocusConfidenceMeterProps) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, fill));
  const w = useSharedValue(reduced ? clamped : 0);

  useEffect(() => {
    if (reduced) {
      w.set(clamped);
      return;
    }
    w.set(withTiming(clamped, { duration: t.motion.honeyFill, easing: Easing.out(Easing.cubic) }));
  }, [clamped, reduced, w, t.motion.honeyFill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${w.get() * 100}%` }));

  const label: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: tier === 'steady' ? t.colors.amberText : t.colors.inkSoft,
    fontWeight: tier === 'steady' ? (t.fontWeight.semibold as TextStyle['fontWeight']) : undefined,
  };
  const track: ViewStyle = {
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const bar: ViewStyle = { height: '100%', borderRadius: t.radii.full, backgroundColor: t.colors.accent };

  return (
    <View style={{ gap: t.space[1.5] }}>
      <AppText style={label}>{confidenceLabel(tier)}</AppText>
      <View style={track}>
        <Animated.View style={[bar, fillStyle]} />
      </View>
    </View>
  );
}
