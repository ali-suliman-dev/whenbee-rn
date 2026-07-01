import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="timer" options={{ presentation: 'fullScreenModal', title: 'Timer', headerShown: false }} />
      <Stack.Screen name="reward" options={{ presentation: 'fullScreenModal', title: 'Reward', headerShown: false }} />
      <Stack.Screen name="retro" options={{ presentation: 'formSheet', headerShown: false }} />
      <Stack.Screen name="add-task" options={{ presentation: 'formSheet', headerShown: false }} />
      <Stack.Screen name="paywall" options={{ presentation: 'formSheet', headerShown: false }} />
      <Stack.Screen name="honest-day" options={{ presentation: 'formSheet', headerShown: false }} />
      <Stack.Screen name="report" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="companion" options={{ presentation: 'formSheet', headerShown: false }} />
      <Stack.Screen name="discoveries" options={{ presentation: 'formSheet', headerShown: false }} />
      <Stack.Screen name="archetype-quiz" options={{ presentation: 'formSheet', headerShown: false }} />
      <Stack.Screen name="review" options={{ presentation: 'formSheet', headerShown: false }} />
      <Stack.Screen name="focus-window" options={{ presentation: 'formSheet', headerShown: false }} />
    </Stack>
  );
}
