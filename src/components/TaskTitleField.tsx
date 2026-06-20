// Shared task-title input with an attached on-device voice affordance. Controlled
// like a plain TextInput (value/onChangeText), so each screen keeps its own store
// wiring; voice simply produces a cleaned title and pushes it through onChangeText,
// reusing the app's category-guess + honest-estimate cascade. Two visual variants
// match the existing screens (boxed: add-task/retro; underline: planner composer).

import { useState } from 'react';
import { TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import { MicButton } from '@/src/components/voice/MicButton';
import { ListeningSheet } from '@/src/components/voice/ListeningSheet';
import { useVoiceCapture } from '@/src/features/voice/useVoiceCapture';
import { useTheme } from '@/src/theme/useTheme';
import type { ParsedTaskDraft } from '@/src/domain/types';

interface TaskTitleFieldProps {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  variant?: 'boxed' | 'underline';
  autoFocus?: boolean;
  returnKeyType?: 'done' | 'default';
  onSubmitEditing?: () => void;
  accessibilityLabel?: string;
}

export const TaskTitleField = ({
  value,
  onChangeText,
  placeholder,
  variant = 'boxed',
  autoFocus,
  returnKeyType = 'default',
  onSubmitEditing,
  accessibilityLabel,
}: TaskTitleFieldProps) => {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  const voice = useVoiceCapture((draft: ParsedTaskDraft) => onChangeText(draft.title));

  const text: TextStyle = {
    flex: 1,
    fontFamily: 'Jakarta-Regular',
    fontSize: t.fontSize.base,
    color: t.colors.ink,
  };

  const boxed: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: focused ? t.colors.primary : t.colors.hairline,
    borderRadius: t.radii.md,
    paddingHorizontal: t.space[4],
    minHeight: t.size.control.md,
  };

  const underline: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    borderBottomWidth: t.borderWidth.thin,
    borderColor: focused ? t.colors.primary : t.colors.hairline,
    paddingVertical: t.space[2],
  };

  return (
    <>
      <View style={variant === 'boxed' ? boxed : underline}>
        <TextInput
          style={text}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.colors.inkFaint}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect
          autoCapitalize="sentences"
          accessibilityLabel={accessibilityLabel}
        />
        <MicButton status={voice.status} onPress={voice.start} />
      </View>
      <ListeningSheet visible={voice.status === 'listening'} partial={voice.partial} onStop={voice.stop} />
    </>
  );
};
