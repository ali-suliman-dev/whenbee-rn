// Trailing mic affordance for a task-title field. Bare Pressable wrapper (the
// reactCompiler + nativewind gotcha drops function-form styles), all visuals on
// an inner Animated.View. Idle = mic, listening = filled mic in primary. Voice is
// always optional — never required.
//
// The glyph is platform-split on purpose: `SymbolView` renders SF Symbols, which
// exist ONLY on iOS. With no fallback it drew nothing on Android — an invisible,
// still-tappable 34pt box beside every task-title field, which read as "this app
// has no voice input". Ionicons is the set the rest of the app already uses, so
// the Android glyph matches its neighbours rather than approximating the iOS one.

import { Platform, Pressable } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';
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
  const tint = active ? t.colors.primary : t.colors.inkSoft;

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
        {Platform.OS === 'ios' ? (
          <SymbolView name={active ? 'mic.fill' : 'mic'} size={t.iconSize.md} tintColor={tint} />
        ) : (
          <Ionicons name={active ? 'mic' : 'mic-outline'} size={t.iconSize.md} color={tint} />
        )}
      </Animated.View>
    </Pressable>
  );
};
