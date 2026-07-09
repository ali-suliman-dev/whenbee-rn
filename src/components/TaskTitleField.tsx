// Shared task-title input with an attached on-device voice affordance. Controlled
// like a plain TextInput (value/onChangeText), so each screen keeps its own store
// wiring; voice simply produces a cleaned title and pushes it through onChangeText,
// reusing the app's category-guess + honest-estimate cascade. Two visual variants
// match the existing screens (boxed: add-task/retro; underline: planner composer).

import { useEffect, useRef, useState } from 'react';
import { Platform, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import { useNavigation } from 'expo-router';
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
  /** Optional style merged onto the inner TextInput — use to override font/size/color. */
  textStyle?: TextStyle;
  /** Optional style merged onto the field container — use to override bg/border (e.g. a sunken field on a surface sheet). */
  containerStyle?: ViewStyle;
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
  textStyle,
  containerStyle,
}: TaskTitleFieldProps) => {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const navigation = useNavigation();

  // Android formSheet IME quirk: focusing DURING the sheet's slide-up animation
  // sets the cursor but the soft keyboard never rises — the sheet window isn't the
  // active IME target yet, so the show-keyboard request is dropped. `autoFocus`
  // (fires at mount) and any fixed timer both land mid-transition. The reliable
  // signal is the screen's `transitionEnd` (native onAppear → the sheet has settled);
  // focus there and the keyboard comes up. A timeout backs it up for any host that
  // doesn't emit the event. iOS raises the keyboard from `autoFocus` alone.
  useEffect(() => {
    if (!autoFocus || Platform.OS !== 'android') return;
    let done = false;
    const focusNow = () => {
      if (done) return;
      done = true;
      inputRef.current?.focus();
    };
    const nav = navigation as unknown as {
      addListener: (type: string, cb: (e?: { data?: { closing?: boolean } }) => void) => () => void;
    };
    const unsub = nav.addListener('transitionEnd', (e) => {
      if (!e?.data?.closing) focusNow();
    });
    const fallback = setTimeout(focusNow, 550);
    return () => {
      unsub();
      clearTimeout(fallback);
    };
  }, [autoFocus, navigation]);

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
    borderCurve: 'continuous',
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
      <View style={[variant === 'boxed' ? boxed : underline, containerStyle]}>
        <TextInput
          ref={inputRef}
          style={[text, textStyle]}
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
