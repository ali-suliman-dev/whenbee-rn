import { useEffect, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Chip } from '@/src/components/Chip';
import { OnboardingBackdrop } from '@/src/components/OnboardingBackdrop';
import { OnboardingFooterCard } from '@/src/components/OnboardingFooterCard';
import { BeeGlyph } from '@/src/components/BeeGlyph';
import { useTheme } from '@/src/theme/useTheme';
import { useOnboarding } from '@/src/features/onboarding/useOnboarding';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { onboardingStepIndex, ONBOARDING_TOTAL } from '@/src/features/onboarding/onboardingFlow';
import { Reveal } from '@/src/features/onboarding/Reveal';
import { useOnce } from '@/src/lib/useOnce';
import { sinkCategoryFor, CATEGORY_NAMES } from '@/src/engine';
import {
  ONBOARDING_CATEGORIES,
  slugify,
  MAX_CUSTOM_NAME,
} from '@/src/features/onboarding/categories';

export default function Categories() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { picked, isPicked, togglePick, trackCategoriesCommitted } = useOnboarding();
  const sink = useOnboardingStore((s) => s.quizAnswers.sink);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  // The user already named this area on quiz/2 ("where does time run away from
  // you most"). Asking again here would be the same question twice — preselect
  // it and let them adjust. Mount-only: re-running would fight the user
  // un-picking it after they land on the screen.
  useEffect(() => {
    if (sink === undefined) return;
    const id = sinkCategoryFor(sink);
    if (!isPicked(id)) togglePick({ id, name: CATEGORY_NAMES[id] ?? id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = picked.length >= 1;

  const onContinue = useOnce(() => {
    trackCategoriesCommitted();
    router.push('/(onboarding)/ready');
  });

  // Count-aware nudge: encourage one or two more early, then affirm once there's
  // plenty — so "one more" never lingers after the grid is full.
  function pickedLine(n: number): string {
    if (n >= 3) return `${n} picked. That's plenty to learn from.`;
    const more = n === 1 ? 'A couple more' : 'One more';
    return `${n} picked. ${more} and I'll learn your pace faster.`;
  }

  function commitCustom() {
    const name = draft.trim();
    if (name.length === 0) {
      // Empty is a change of mind, not a mistake — close quietly.
      setDraft('');
      setCustomError(null);
      setAdding(false);
      return;
    }
    const id = slugify(name);
    if (id.length === 0) {
      setCustomError('Try letters or numbers');
      return;
    }
    if (isPicked(id)) {
      setCustomError('Already tracking that one');
      return;
    }
    togglePick({ id, name });
    setDraft('');
    setCustomError(null);
    setAdding(false);
  }

  // Custom picks that aren't part of the seed grid, so they render as their own chips.
  const seedIds = new Set(ONBOARDING_CATEGORIES.map((c) => c.id));
  const customPicks = picked.filter((p) => !seedIds.has(p.id));

  const inputChip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2],
    backgroundColor: t.colors.primarySoft,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.primary,
    minWidth: 120,
  };

  return (
    <Screen backdrop={<OnboardingBackdrop />}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <StepProgress current={onboardingStepIndex('categories')} total={ONBOARDING_TOTAL} />
      {/* Tapping anywhere outside the inline "+ New" input dismisses the keyboard. */}
      <Pressable
        accessible={false}
        onPress={Keyboard.dismiss}
        style={{ flex: 1, gap: t.space[4], paddingTop: t.space[2] }}
      >
        <Reveal index={0}>
          <AppText
            style={{
              fontSize: t.fontSize.xl,
              fontWeight: t.fontWeight.bold as '700',
              color: t.colors.ink,
              letterSpacing: -0.6,
            }}
          >
            Where does time slip most?
          </AppText>
        </Reveal>
        <Reveal index={1}>
          <AppText variant="body" style={{ color: t.colors.inkSoft }}>
            {"Pick a few. I'll sharpen your honest number here first."}
          </AppText>
        </Reveal>

        <Reveal index={2}>
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
                  onChangeText={(text) => {
                    setDraft(text);
                    if (customError) setCustomError(null);
                  }}
                  onSubmitEditing={commitCustom}
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
              <Chip
                label="Add your own"
                variant="add"
                onPress={() => {
                  setCustomError(null);
                  setAdding(true);
                }}
              />
            )}
          </View>
        </Reveal>
        {customError ? (
          <AppText style={{ fontSize: t.fontSize.sm, color: t.colors.amberText }}>
            {customError}
          </AppText>
        ) : null}
        <AppText style={{ fontSize: t.fontSize.sm, color: t.colors.inkFaint }}>
          Change or remove these any time in the Whenbee tab.
        </AppText>
        <View style={{ flex: 1 }} />
        {picked.length > 0 ? (
          <Reveal>
            <OnboardingFooterCard
              glyph={<BeeGlyph size={t.space[8]} animated />}
            >
              {pickedLine(picked.length)}
            </OnboardingFooterCard>
          </Reveal>
        ) : null}
      </Pressable>

      <Reveal index={3} style={{ paddingTop: t.space[4] }}>
        {!canContinue ? (
          <AppText
            style={{
              fontSize: t.fontSize.sm,
              color: t.colors.inkFaint,
              textAlign: 'center',
              marginBottom: t.space[2],
            }}
          >
            Pick at least one to continue
          </AppText>
        ) : null}
        <AppButton
          label="Continue →"
          fullWidth
          disabled={!canContinue}
          onPress={onContinue}
        />
      </Reveal>
      <View style={{ height: insets.bottom }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
