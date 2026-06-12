import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { StepProgress } from '@/src/features/onboarding/StepProgress';
import { PromiseChip } from '@/src/features/onboarding/PromiseChip';
import { BrandLockup } from '@/src/features/onboarding/BrandLockup';

export default function Welcome() {
  const t = useTheme();
  return (
    <Screen>
      <StepProgress current={0} />
      <View style={{ flex: 1, justifyContent: 'center', gap: t.space[4] }}>
        <BrandLockup />
        <AppText
          style={{
            fontSize: t.fontSize['2xl'],
            lineHeight: t.fontSize['2xl'] * 1.1,
            fontWeight: t.fontWeight.bold as '700',
            color: t.colors.ink,
            letterSpacing: -0.75,
          }}
        >
          You&apos;re not lazy. You&apos;re a{' '}
          <AppText
            style={{
              fontSize: t.fontSize['2xl'],
              lineHeight: t.fontSize['2xl'] * 1.1,
              fontWeight: t.fontWeight.bold as '700',
              color: t.colors.primary,
              letterSpacing: -0.75,
            }}
          >
            time optimist.
          </AppText>
        </AppText>
        <AppText
          variant="body"
          style={{ color: t.colors.inkSoft, lineHeight: t.fontSize.base * 1.5 }}
        >
          Whenbee learns how long things really take you — then makes your plans
          honest. Every log fills your honeycomb.
        </AppText>
        <PromiseChip glyph="lock">
          No account, no email. Everything stays on your phone.
        </PromiseChip>
      </View>
      <AppButton
        label="Get started →"
        fullWidth
        onPress={() => router.push('/(onboarding)/categories')}
      />
      <View style={{ height: t.space[4] }} />
    </Screen>
  );
}
