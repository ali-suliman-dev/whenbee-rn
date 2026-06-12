import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useOnboarding } from '@/src/features/onboarding/useOnboarding';

export default function Ready() {
  const { complete } = useOnboarding();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <AppText variant="title">You&apos;re set</AppText>
        <AppText variant="body">Jump in — you can change everything later in Settings.</AppText>
      </View>
      <AppButton label="Enter the app" onPress={() => { complete(); router.replace('/(tabs)'); }} />
      <View style={{ height: 16 }} />
    </Screen>
  );
}
