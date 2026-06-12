import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Canonical haptics helper. Lives in lib/ (not services/) so UI — screens AND
// src/components/* primitives — can import it without crossing the ESLint
// services/db boundary. services/haptics re-exports this for store/feature code.
const run = (fn: () => Promise<void>) => { if (Platform.OS !== 'web') fn().catch(() => {}); };

export const haptics = {
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
