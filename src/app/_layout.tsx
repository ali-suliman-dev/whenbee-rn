import '../global.css';
import { Stack } from 'expo-router';
import { AppProviders } from '@/src/providers/AppProviders';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
      </Stack>
    </AppProviders>
  );
}
