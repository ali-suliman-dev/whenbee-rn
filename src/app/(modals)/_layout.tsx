import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="example-sheet" options={{ presentation: 'formSheet', title: 'Example' }} />
      <Stack.Screen name="paywall" options={{ presentation: 'modal', title: 'Go Pro' }} />
    </Stack>
  );
}
