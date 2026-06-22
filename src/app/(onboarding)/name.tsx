import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { OnboardingBackdrop } from '@/src/components/OnboardingBackdrop';
import { useTheme } from '@/src/theme/useTheme';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { NameAsk } from '@/src/features/onboarding/NameAsk';
import { usePersonalize } from '@/src/features/onboarding/usePersonalize';

// Onboarding step 2 of 4 — the optional nickname. Continue/Skip both go on to the
// first quiz question; the quiz, reveal and ready are their own routes from here so
// swipe-back walks one step at a time and the progress reflects the real position.
export default function NameScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { trackShown, saveName } = usePersonalize();

  useEffect(() => {
    trackShown();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleContinue(name: string | undefined) {
    saveName(name);
    router.push('/(onboarding)/quiz/0');
  }

  return (
    <Screen backdrop={<OnboardingBackdrop />}>
      <StepProgress current={2} total={4} />
      <View style={{ flex: 1, paddingTop: t.space[2] }}>
        <NameAsk onContinue={handleContinue} bottomInset={insets.bottom} />
      </View>
    </Screen>
  );
}
