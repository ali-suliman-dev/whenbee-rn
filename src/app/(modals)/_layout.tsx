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
      <Stack.Screen
        name="discoveries"
        options={{ presentation: 'card', headerShown: true, title: 'Things you’ve learned' }}
      />
    </Stack>
  );
}
