import { useState } from 'react';
import { View, TextInput, Pressable, Keyboard, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { useOnboarding } from '@/src/features/onboarding/useOnboarding';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import {
  ONBOARDING_CATEGORIES,
  slugify,
  MAX_CUSTOM_NAME,
} from '@/src/features/onboarding/categories';

export default function Categories() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { picked, isPicked, togglePick } = useOnboarding();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const canContinue = picked.length >= 1;

  function commitCustom() {
    const name = draft.trim();
    const id = slugify(name);
    if (name.length > 0 && id.length > 0 && !isPicked(id)) {
      togglePick({ id, name });
    }
    setDraft('');
    setAdding(false);
  }

  // Custom picks that aren't part of the seed grid, so they render as their own chips.
  const seedIds = new Set(ONBOARDING_CATEGORIES.map((c) => c.id));
  const customPicks = picked.filter((p) => !seedIds.has(p.id));

  const inputChip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: t.radii.pill,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2],
    backgroundColor: t.colors.primaryTint,
    borderWidth: 1.5,
    borderColor: t.colors.primary,
    minWidth: 120,
  };

  return (
    <Screen>
      <StepProgress current={1} />
      {/* Tapping anywhere outside the inline "+ New" input dismisses the keyboard. */}
      <Pressable
        accessible={false}
        onPress={Keyboard.dismiss}
        style={{ flex: 1, gap: t.space[4], paddingTop: t.space[2] }}
      >
        <AppText
          style={{
            fontSize: t.fontSize.xl,
            fontWeight: t.fontWeight.bold as '700',
            color: t.colors.ink,
            letterSpacing: -0.6,
          }}
        >
          What kinds of tasks make you late?
        </AppText>
        <AppText variant="body" style={{ color: t.colors.inkSoft }}>
          Pick 3–5 — or add your own. These get calibrated first.
        </AppText>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
          {ONBOARDING_CATEGORIES.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.name}
              selected={isPicked(cat.id)}
              onPress={() => togglePick(cat)}
            />
          ))}

          {customPicks.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.name}
              selected
              onPress={() => togglePick(cat)}
            />
          ))}

          {adding ? (
            <View style={inputChip}>
              <TextInput
                autoFocus
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={commitCustom}
                onBlur={commitCustom}
                placeholder="Name it…"
                placeholderTextColor={t.colors.inkSoft}
                maxLength={MAX_CUSTOM_NAME}
                returnKeyType="done"
                accessibilityLabel="New category name"
                style={{
                  flex: 1,
                  fontSize: t.fontSize.sm,
                  color: t.colors.ink,
                  padding: 0,
                }}
              />
            </View>
          ) : (
            <Chip label="+ New" variant="add" onPress={() => setAdding(true)} />
          )}
        </View>
      </Pressable>

      <AppButton
        label="Continue →"
        fullWidth
        disabled={!canContinue}
        onPress={() => router.push('/(onboarding)/ready')}
      />
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}
