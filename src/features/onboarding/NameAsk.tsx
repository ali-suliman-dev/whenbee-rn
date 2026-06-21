import { useState } from 'react';
import { View, TextInput } from 'react-native';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { MAX_CUSTOM_NAME } from '@/src/features/onboarding/categories';

// ──────────────────────────────────────────────────────────────────────────────
// NameAsk — optional nickname field in the onboarding flow.
// Passes the trimmed name on Continue, or undefined on Skip / empty Continue.
// ──────────────────────────────────────────────────────────────────────────────

export function NameAsk({
  onContinue,
}: {
  onContinue: (name: string | undefined) => void;
}): React.JSX.Element {
  const t = useTheme();
  const [value, setValue] = useState('');

  function handleContinue() {
    onContinue(value.trim() || undefined);
  }

  function handleSkip() {
    onContinue(undefined);
  }

  return (
    <View style={{ gap: t.space[6] }}>
      <View style={{ gap: t.space[2] }}>
        <AppText
          style={{
            fontSize: t.fontSize.xl,
            fontWeight: t.fontWeight.bold as '700',
            color: t.colors.ink,
            letterSpacing: -0.6,
          }}
        >
          What should I call you?
        </AppText>
        <AppText variant="body" style={{ color: t.colors.inkSoft }}>
          {"Totally optional — I'm happy with no name too."}
        </AppText>
      </View>

      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Your nickname"
        placeholderTextColor={t.colors.inkSoft}
        maxLength={MAX_CUSTOM_NAME}
        returnKeyType="done"
        accessibilityLabel="Your name"
        style={{
          fontSize: t.fontSize.md,
          color: t.colors.ink,
          borderWidth: t.borderWidth.chip,
          borderColor: t.colors.border,
          borderRadius: t.radii.sm,
          paddingHorizontal: t.space[4],
          paddingVertical: t.space[3],
        }}
      />

      <View style={{ gap: t.space[3] }}>
        <AppButton label="Continue" fullWidth onPress={handleContinue} />
        <AppButton label="Skip" variant="ghost" fullWidth onPress={handleSkip} />
      </View>
    </View>
  );
}
