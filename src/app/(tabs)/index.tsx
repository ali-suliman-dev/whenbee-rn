import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';

export default function Home() {
  return (
    <Screen>
      <View style={{ gap: 12, paddingTop: 16 }}>
        <AppText variant="display">Home</AppText>
        <Card><AppText variant="body">Your first screen. Replace with real content.</AppText></Card>
        <AppButton label="Open example sheet" variant="secondary" onPress={() => router.push('/(modals)/example-sheet')} />
        <AppButton label="See Pro paywall" onPress={() => router.push('/(modals)/paywall')} />
      </View>
    </Screen>
  );
}
