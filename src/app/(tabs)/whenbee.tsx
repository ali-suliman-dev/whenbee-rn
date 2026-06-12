import { View } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';

export default function Whenbee() {
  return (
    <Screen>
      <View style={{ gap: 12, paddingTop: 16 }}>
        <AppText variant="display">Whenbee</AppText>
        <AppText variant="body">Your AI scheduling assistant lives here.</AppText>
      </View>
    </Screen>
  );
}
