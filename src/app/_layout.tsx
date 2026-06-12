import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AppProviders } from '@/src/providers/AppProviders';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Jakarta-Regular':   require('../assets/fonts/PlusJakartaSans-Regular.ttf'),
    'Jakarta-Medium':    require('../assets/fonts/PlusJakartaSans-Medium.ttf'),
    'Jakarta-SemiBold':  require('../assets/fonts/PlusJakartaSans-SemiBold.ttf'),
    'Jakarta-Bold':      require('../assets/fonts/PlusJakartaSans-Bold.ttf'),
    'Jakarta-ExtraBold': require('../assets/fonts/PlusJakartaSans-ExtraBold.ttf'),
    'Inter-Medium':      require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold':    require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold':        require('../assets/fonts/Inter-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="category/[category]" />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
      </Stack>
    </AppProviders>
  );
}
