import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';

export default function Welcome() {
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <AppText variant="display">Welcome</AppText>
        <AppText variant="body">A clean starting point for your next app.</AppText>
      </View>
      <AppButton label="Get started" onPress={() => router.push('/(onboarding)/highlights')} />
      <View style={{ height: 16 }} />
    </Screen>
  );
}
