import '../global.css';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AppProviders } from '@/src/providers/AppProviders';
import { useTheme } from '@/src/theme/useTheme';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { setClockHour12 } from '@/src/lib/time';
import { prefers24Hour } from '@/src/lib/clockPrefs';

// Match every clock readout (Started/Done, planner, calendar) to the device's
// "24-Hour Time" toggle. Read once at module load — it's a synchronous native const.
setClockHour12(!prefers24Hour());

SplashScreen.preventAutoHideAsync();

// Navigator lives in its own component so it can read the theme and apply it to
// the (otherwise native-default white) Settings header in dark mode. Swipe-back
// is enabled stack-wide so every pushed screen is dismissible by gesture.
function RootNavigator() {
  const t = useTheme();

  // Keep the NATIVE appearance trait in sync with the in-app preference. Theming
  // is otherwise JS-only (tokens), so native views — the SwiftUI guess wheel, and
  // the OS scheme that `useColorScheme()` reads for "system" — would drift from
  // what the app draws: on a light-mode device a dark-themed app rendered the
  // wheel's numbers near-black on the dark sheet (invisible), and "system" never
  // re-followed the OS. setColorScheme forces the override; null hands it back to
  // the OS so "system" tracks it live.
  const colorPref = useSettingsStore((s) => s.colorMode);
  useEffect(() => {
    Appearance.setColorScheme(colorPref === 'system' ? null : colorPref);
  }, [colorPref]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="category/[category]" />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: true,
          title: 'Settings',
          headerStyle: { backgroundColor: t.colors.bg },
          headerTitleStyle: { color: t.colors.ink },
          headerTintColor: t.colors.primary,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="categories"
        options={{
          headerShown: true,
          title: 'Categories',
          headerStyle: { backgroundColor: t.colors.bg },
          headerTitleStyle: { color: t.colors.ink },
          headerTintColor: t.colors.primary,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          headerShown: true,
          title: 'Privacy',
          headerStyle: { backgroundColor: t.colors.bg },
          headerTitleStyle: { color: t.colors.ink },
          headerTintColor: t.colors.primary,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

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

  // Restore a running timer that survived a full app close (the snapshot carries
  // wall-clock startedAt, so elapsed stays correct). Run once at boot.
  useEffect(() => {
    useTimerStore.getState().resumeFromKv();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
