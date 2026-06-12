import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';

export default function Today() {
  return (
    <Screen>
      <View style={{ gap: 12, paddingTop: 16 }}>
        <AppText variant="display">Today</AppText>
        <AppText variant="body">Your daily schedule lives here.</AppText>
        <AppButton label="Start (temp)" onPress={() => router.push('/(modals)/timer')} />
      </View>
    </Screen>
  );
}
