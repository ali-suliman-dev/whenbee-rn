import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  // Native-stack swipe-back stays on for every onboarding step (welcome →
  // categories → ready). `fullScreenGestureEnabled` lets the swipe start anywhere
  // across the screen, not just from the left edge.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    />
  );
}
