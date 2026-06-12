import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

export default function Paywall() {
  const setPro = useEntitlement((s) => s.setPro);
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <AppText variant="display">Go Pro</AppText>
        <Card><AppText variant="body">Unlock everything. Real purchases run in a dev/EAS build.</AppText></Card>
        {isExpoGo ? <AppText variant="caption">Running in Expo Go — purchases are stubbed.</AppText> : null}
      </View>
      <AppButton
        label={isExpoGo ? 'Simulate unlock (Expo Go)' : 'Start free trial'}
        onPress={() => { if (isExpoGo) setPro(true); router.back(); }}
      />
      <View style={{ height: 16 }} />
    </Screen>
  );
}
