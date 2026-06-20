// src/hooks/__tests__/useAmbientMotion.test.tsx
import { renderHook } from '@testing-library/react-native';
import { useAmbientMotion } from '../useAmbientMotion';

// Mock useFocusEffect to run the setup immediately (mirrors a screen gaining
// focus) and expose the returned cleanup so the test can fire "blur".
let cleanup: (() => void) | void;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    cleanup = cb();
  },
}));

test('runs while active and cancels on blur; does nothing when inactive', () => {
  const cancel = jest.fn();
  const run = jest.fn(() => cancel);

  // Active → run() is called on focus.
  renderHook(() => useAmbientMotion(true, run));
  expect(run).toHaveBeenCalledTimes(1);
  // Blur fires the cleanup → canceller runs.
  cleanup?.();
  expect(cancel).toHaveBeenCalledTimes(1);

  // Inactive → run() is never called.
  run.mockClear();
  renderHook(() => useAmbientMotion(false, run));
  expect(run).not.toHaveBeenCalled();
});
