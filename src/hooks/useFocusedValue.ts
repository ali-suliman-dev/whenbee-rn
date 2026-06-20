// src/hooks/useFocusedValue.ts
import { useRef } from 'react';
import { useIsScreenFocused } from './useIsScreenFocused';

/**
 * Returns `value` while the screen is focused; otherwise the last value seen
 * while focused. Inputs "freeze" off-screen so a consumer's existing
 * old→new animation plays exactly when the user lands on the screen. If the
 * value advances several steps while blurred, the consumer sees one net
 * transition on arrival, never a backlog of replays.
 */
export function useFocusedValue<T>(value: T): T {
  const isFocused = useIsScreenFocused();
  const seen = useRef(value);
  if (isFocused) {
    seen.current = value; // adopt the latest only while the user is watching
  }
  return seen.current;
}
