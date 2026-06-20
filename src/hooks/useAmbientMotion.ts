// src/hooks/useAmbientMotion.ts
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Runs repeating ambient motion only while the screen is focused. On focus and
 * when `active` is true, calls `run()` to start the loop(s); on blur or unmount,
 * calls the canceller `run()` returned (which should reset shared values to
 * rest). Pass a `run` stabilised with useCallback so the loop is not restarted
 * on every render.
 */
export function useAmbientMotion(active: boolean, run: () => () => void): void {
  useFocusEffect(
    useCallback(() => {
      if (!active) return undefined;
      return run();
    }, [active, run]),
  );
}
