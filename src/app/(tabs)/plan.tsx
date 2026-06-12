import { View } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';

export default function Plan() {
  return (
    <Screen>
      <View style={{ gap: 12, paddingTop: 16 }}>
        <AppText variant="display">Plan</AppText>
        <AppText variant="body">Your weekly planning view lives here.</AppText>
      </View>
    </Screen>
  );
}
