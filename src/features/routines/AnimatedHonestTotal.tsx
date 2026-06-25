import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { View, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { tokens } from '@/src/theme/tokens';

const ENTER = FadeIn.duration(tokens.motion.fast).reduceMotion(ReduceMotion.System);

export function AnimatedHonestTotal({ minutes }: { minutes: number }) {
  const t = useTheme();
  const num: TextStyle = { ...(type.honestNumberLg as unknown as TextStyle), color: t.colors.ink };
  const caption: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  return (
    <View style={{ gap: t.space[0.5] }}>
      {/* keyed so the number opacity-crossfades when the total changes; opacity only */}
      <Animated.View key={minutes} entering={ENTER}>
        <AppText style={num}>About {minutes} min</AppText>
      </Animated.View>
      <AppText style={caption}>including the in-between time</AppText>
    </View>
  );
}
