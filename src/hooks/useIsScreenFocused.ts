// src/hooks/useIsScreenFocused.ts
import { useEffect, useState } from 'react';
import { useNavigation } from 'expo-router';

/**
 * Tracks whether the nearest navigation screen is focused. Re-renders on
 * focus/blur so consumers can gate animations on visibility. Built on
 * expo-router's useNavigation (the repo's navigation-hook source) rather than
 * importing useIsFocused from a transitive @react-navigation package.
 */
export function useIsScreenFocused(): boolean {
  const navigation = useNavigation();
  const [focused, setFocused] = useState(() => navigation.isFocused());

  useEffect(() => {
    setFocused(navigation.isFocused());
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  return focused;
}
