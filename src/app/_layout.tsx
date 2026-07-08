import '../global.css';
import { useEffect, type ComponentProps } from 'react';
import { AppState, Appearance, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AppProviders } from '@/src/providers/AppProviders';
import { useTheme } from '@/src/theme/useTheme';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { setClockHour12 } from '@/src/lib/time';
import { prefers24Hour } from '@/src/lib/clockPrefs';
import { useNotificationSetup } from '@/src/features/notifications/useNotificationSetup';
import { useForgotCheck } from '@/src/features/timer/useForgotCheck';
import { ForgotCard } from '@/src/features/timer/ForgotCard';

// Match every clock readout (Started/Done, planner, calendar) to the device's
// "24-Hour Time" toggle. Read once at module load — it's a synchronous native const.
setClockHour12(!prefers24Hour());

SplashScreen.preventAutoHideAsync();

// Anchor the root stack to (tabs). Modal routes ((modals)/*) are presented on
// THIS stack as `formSheet`. Without an anchor, loading a modal route directly —
// a deep link, or a Metro/JS reload while a sheet is open — rebuilds the nav
// state with the modal as the ONLY screen: the background is wiped, so the
// sheet has nothing behind it and no dismiss target → the user is locked in.
// The anchor guarantees (tabs) is always placed beneath, so every sheet stays
// draggable-to-dismiss and returns to the tabs. See expo-router "Handle
// deep-linked modals".
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

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
    sheetAllowedDetents: [0.95],
    sheetCornerRadius: t.radii.sheet,
    gestureEnabled: true,
    // The native formSheet host view defaults to white; it shows through wherever
    // the JS content doesn't paint (below a short list → a white gap under the
    // dark sheet). Paint the native container the theme bg so the sheet is one
    // continuous colour top to bottom. paddingHorizontal supplies the side
    // gutters for EVERY sheet uniformly (scroll content AND pinned footers) —
    // sheet screens pass horizontalPadding={false} to <Screen> and take their
    // gutters from here, because react-native-screens silently drops the LEFT
    // padding of a padded JS child inside a native sheet. See Screen.tsx.
    contentStyle: { backgroundColor: t.colors.bg, paddingHorizontal: t.space[5] },
  };
}

// Overlay host for the forgot-to-stop recovery card. Sits above the navigator so
// it can appear over any screen; `pointerEvents="box-none"` lets touches pass
// through the empty space and only the card itself (once rendered) is tappable.
// Bottom-pinned content must add the safe-area inset or it sits under the home
// indicator — see the footers/tab-bar gotcha. `useForgotCheck()` itself is
// mounted in `RootLayout` (not here) so its effect runs after the boot effects
// that restore the timer snapshot — child effects fire before a parent's own,
// so hosting the hook in this sibling component would run it too early.
function ForgotOverlay() {
  // Passthrough full-screen host — ForgotCard renders its own scrim + bottom
  // card and owns all layout (so the scrim can reach the screen edges). box-none
  // lets taps through the empty space until the card (and its scrim) mount.
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
    >
      <ForgotCard />
    </View>
  );
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
      <Stack.Screen name="(modals)/plan" options={sheet} />
      <Stack.Screen name="(modals)/reward" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="(modals)/report" options={{ presentation: 'fullScreenModal', headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  // System status bar (clock/battery/signal icons) has no relation to app
  // theme tokens — it's a separate native surface with its own icon-color
  // setting. Nothing mounted a <StatusBar> before, so Android kept whatever
  // fixed default the native template shipped with (light icons), which read
  // as invisible on light mode. Drive it from the same theme mode so icons
  // stay dark-on-light / light-on-dark like everything else.
  const statusBarTheme = useTheme();
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
    const store = useTimerStore.getState();
    store.resumeFromKv();
    // Clean up any OS-owned Live Activity that survived a kill while no timer is
    // running (e.g. app was force-quit after the timer already ended). Fire-and-forget.
    store.reconcilePresenceOnBoot();
  }, []);

  // Detect a session that ran past the honest number while the app was away and
  // auto-close it into `forgotStore`. Must run after `resumeFromKv` above so the
  // restored snapshot exists to evaluate — hooks in one component fire their
  // effects in declaration order, so this call stays below the boot effect.
  useForgotCheck();

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

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AppProviders>
      <StatusBar style={statusBarTheme.mode === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
      <ForgotOverlay />
    </AppProviders>
  );
}
