import '../global.css';
import { useEffect, useState, type ComponentProps } from 'react';
import { AppState, Appearance } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { I18nextProvider } from 'react-i18next';
import i18n, { initI18n } from '@/src/i18n';
import { AppProviders } from '@/src/providers/AppProviders';
import { useTheme } from '@/src/theme/useTheme';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { setClockHour12 } from '@/src/lib/time';
import { prefers24Hour } from '@/src/lib/clockPrefs';
import { useNotificationSetup } from '@/src/features/notifications/useNotificationSetup';

// Match every clock readout (Started/Done, planner, calendar) to the device's
// "24-Hour Time" toggle. Read once at module load — it's a synchronous native const.
setClockHour12(!prefers24Hour());

SplashScreen.preventAutoHideAsync();

// Navigator lives in its own component so it can read the theme and apply it to
// the (otherwise native-default white) Settings header in dark mode. Swipe-back
// is enabled stack-wide so every pushed screen is dismissible by gesture.
// A real bottom-sheet drawer. Registered on the ROOT stack (never a nested
// (modals) stack): react-native-screens does NOT support `formSheet` inside a
// nested stack on Android, so a nested one silently falls back to a full-screen
// card that slides in from the side. On the root stack, Android renders it as a
// Material bottom sheet — slides up from the bottom and drags down to dismiss,
// matching iOS. `[0.9]` stops short of the top so the previous screen peeks
// through and it clearly reads as a drawer; the corner radius rounds the top.
function useSheetScreenOptions(): ComponentProps<typeof Stack.Screen>['options'] {
  const t = useTheme();
  return {
    presentation: 'formSheet',
    headerShown: false,
    sheetAllowedDetents: [0.9],
    sheetCornerRadius: t.radii.sheet,
    gestureEnabled: true,
  };
}

function RootNavigator() {
  const t = useTheme();
  const sheet = useSheetScreenOptions();

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

  useNotificationSetup();

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
          headerBackButtonDisplayMode: 'minimal',
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
          headerBackButtonDisplayMode: 'minimal',
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
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: t.colors.bg },
          headerTitleStyle: { color: t.colors.ink },
          headerTintColor: t.colors.primary,
          headerShadowVisible: false,
        }}
      />
      {/* Modal routes live directly on the root stack (no nested (modals)
          navigator) so Android renders formSheet as a real draggable sheet.
          These slide up from the bottom and drag down to dismiss. reward +
          report stay full-screen (celebration / export experiences). */}
      <Stack.Screen name="(modals)/add-task" options={sheet} />
      <Stack.Screen name="(modals)/retro" options={sheet} />
      <Stack.Screen name="(modals)/paywall" options={sheet} />
      <Stack.Screen name="(modals)/honest-day" options={sheet} />
      <Stack.Screen name="(modals)/companion" options={sheet} />
      <Stack.Screen name="(modals)/discoveries" options={sheet} />
      <Stack.Screen name="(modals)/archetype-quiz" options={sheet} />
      <Stack.Screen name="(modals)/review" options={sheet} />
      <Stack.Screen name="(modals)/focus-window" options={sheet} />
      <Stack.Screen name="(modals)/timer" options={sheet} />
      <Stack.Screen name="(modals)/reward" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="(modals)/report" options={{ presentation: 'fullScreenModal', headerShown: false }} />
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

  // i18next init is synchronous work over bundled resources (no IO), so it folds
  // into the existing fonts gate below rather than adding a second splash/spinner.
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => {
    void initI18n().then(() => setI18nReady(true));
  }, []);

  // Restore a running timer that survived a full app close (the snapshot carries
  // wall-clock startedAt, so elapsed stays correct). Run once at boot.
  useEffect(() => {
    const store = useTimerStore.getState();
    store.resumeFromKv();
    // Clean up any OS-owned Live Activity that survived a kill while no timer is
    // running (e.g. app was force-quit after the timer already ended). Fire-and-forget.
    store.reconcilePresenceOnBoot();
  }, []);

  // Boot the day-tasks store and refresh "today" when the app returns to the
  // foreground (handles the midnight boundary: the selected day re-points to the
  // new calendar date without user action).
  useEffect(() => {
    void useDayTasksStore.getState().init();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void useDayTasksStore.getState().goToToday();
    });
    return () => sub.remove();
  }, []);

  if ((!fontsLoaded && !fontError) || !i18nReady) {
    return null;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </I18nextProvider>
  );
}
