import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';

export default function Timer() {
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <AppText variant="display">Timer</AppText>
        <AppText variant="body">Task timer session lives here.</AppText>
      </View>
      <AppButton label="Close" variant="secondary" onPress={() => router.dismiss()} />
      <View style={{ height: 16 }} />
    </Screen>
  );
}
