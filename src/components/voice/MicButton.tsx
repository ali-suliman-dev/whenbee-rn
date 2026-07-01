// Trailing mic affordance for a task-title field. Bare Pressable wrapper (the
// reactCompiler + nativewind gotcha drops function-form styles), all visuals on
// an inner Animated.View. SF Symbol glyph for a native iOS feel. Idle = mic,
// listening = mic.fill in primary. Voice is always optional — never required.

import { Pressable } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import type { VoiceStatus } from '@/src/features/voice/useVoiceCapture';

interface MicButtonProps {
  status: VoiceStatus;
  onPress: () => void;
}

export const MicButton = ({ status, onPress }: MicButtonProps) => {
  const t = useTheme();
  const { t: tr } = useTranslation('voice');
  const scale = useSharedValue(1);
  const active = status === 'listening';

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => scale.set(withSpring(0.92, t.motion.spring))}
      onPressOut={() => scale.set(withSpring(1, t.motion.spring))}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={tr('micButton.speakA11y')}
    >
      <Animated.View
        style={[
          { alignItems: 'center', justifyContent: 'center', padding: t.space[3] },
          animStyle,
        ]}
      >
        <SymbolView
          name={active ? 'mic.fill' : 'mic'}
          size={t.iconSize.md}
          tintColor={active ? t.colors.primary : t.colors.inkSoft}
        />
      </Animated.View>
    </Pressable>
  );
};
