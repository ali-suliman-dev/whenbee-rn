import { View } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';

export default function Patterns() {
  return (
    <Screen>
      <View style={{ gap: 12, paddingTop: 16 }}>
        <AppText variant="display">Patterns</AppText>
        <AppText variant="body">Your habit and trend insights live here.</AppText>
      </View>
    </Screen>
  );
}
