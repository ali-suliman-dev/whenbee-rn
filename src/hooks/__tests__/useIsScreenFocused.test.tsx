// src/hooks/__tests__/useIsScreenFocused.test.tsx
import { renderHook, act } from '@testing-library/react-native';
import { useIsScreenFocused } from '../useIsScreenFocused';

type Listener = () => void;

function makeNavigation(initialFocused: boolean) {
  const listeners: Record<string, Listener[]> = { focus: [], blur: [] };
  return {
    isFocused: () => initialFocused,
    addListener: (type: string, cb: Listener) => {
      listeners[type] = [...(listeners[type] ?? []), cb];
      return () => {
        listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
      };
    },
    emit: (type: string) => (listeners[type] ?? []).forEach((l) => l()),
  };
}

const mockNav = makeNavigation(false);
jest.mock('expo-router', () => ({ useNavigation: () => mockNav }));

test('starts from navigation.isFocused() and flips on focus/blur events', () => {
  const { result } = renderHook(() => useIsScreenFocused());
  expect(result.current).toBe(false);

  act(() => mockNav.emit('focus'));
  expect(result.current).toBe(true);

  act(() => mockNav.emit('blur'));
  expect(result.current).toBe(false);
});
