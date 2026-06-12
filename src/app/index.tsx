import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useOnboarding } from '@/src/features/onboarding/useOnboarding';

export default function Index() {
  const { completed, hydrated } = useOnboarding();
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={completed ? '/(tabs)' : '/(onboarding)/welcome'} />;
}
