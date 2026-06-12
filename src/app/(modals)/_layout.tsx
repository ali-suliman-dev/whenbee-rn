import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="timer" options={{ presentation: 'fullScreenModal', title: 'Timer', headerShown: false }} />
      <Stack.Screen name="reward" options={{ presentation: 'fullScreenModal', title: 'Reward', headerShown: false }} />
      <Stack.Screen name="retro" options={{ presentation: 'formSheet', title: 'Retro' }} />
      <Stack.Screen name="add-task" options={{ presentation: 'formSheet', title: 'Add Task' }} />
      <Stack.Screen name="paywall" options={{ presentation: 'modal', title: 'Go Pro' }} />
    </Stack>
  );
}
