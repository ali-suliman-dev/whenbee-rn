import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';

export default function Highlights() {
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <AppText variant="title">What&apos;s inside</AppText>
        <Card><AppText variant="body">Typed theme, analytics, and a paywall — ready to wire.</AppText></Card>
      </View>
      <AppButton label="Continue" onPress={() => router.push('/(onboarding)/ready')} />
      <View style={{ height: 16 }} />
    </Screen>
  );
}
