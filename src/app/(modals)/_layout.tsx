import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

// formSheet renders as a bottom sheet on iOS by default. On Android,
// react-native-screens only treats it as a sheet when detents are set —
// without them it falls back to a full-screen, side-sliding card. A single
// full-height detent ([1]) gives the same UP-from-bottom sheet on both
// platforms (no-op on iOS, where [1]/`.large` is already the default).
const sheetOptions = {
  presentation: 'formSheet',
  headerShown: false,
  sheetAllowedDetents: [1],
} satisfies ComponentProps<typeof Stack.Screen>['options'];

export default function ModalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="timer" options={{ presentation: 'fullScreenModal', title: 'Timer', headerShown: false }} />
      <Stack.Screen name="reward" options={{ presentation: 'fullScreenModal', title: 'Reward', headerShown: false }} />
      <Stack.Screen name="retro" options={sheetOptions} />
      <Stack.Screen name="add-task" options={sheetOptions} />
      <Stack.Screen name="paywall" options={sheetOptions} />
      <Stack.Screen name="honest-day" options={sheetOptions} />
      <Stack.Screen name="report" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="companion" options={sheetOptions} />
      <Stack.Screen name="discoveries" options={sheetOptions} />
      <Stack.Screen name="archetype-quiz" options={sheetOptions} />
      <Stack.Screen name="review" options={sheetOptions} />
      <Stack.Screen name="focus-window" options={sheetOptions} />
    </Stack>
  );
}
