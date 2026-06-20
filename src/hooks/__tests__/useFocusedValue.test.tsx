// src/hooks/__tests__/useFocusedValue.test.tsx
import { renderHook } from '@testing-library/react-native';
import { useFocusedValue } from '../useFocusedValue';

let mockFocused = true;
jest.mock('../useIsScreenFocused', () => ({ useIsScreenFocused: () => mockFocused }));

test('freezes value while blurred and adopts the latest on refocus', () => {
  mockFocused = true;
  const { result, rerender } = renderHook<string, { v: string }>(({ v }) => useFocusedValue(v), {
    initialProps: { v: 'raw' },
  });
  expect(result.current).toBe('raw');

  // Blur, then the source value advances twice while off-screen.
  mockFocused = false;
  rerender({ v: 'settling' });
  expect(result.current).toBe('raw'); // frozen — not yet seen
  rerender({ v: 'honest' });
  expect(result.current).toBe('raw'); // still frozen

  // Refocus: adopt the latest (single net transition, not a replay of each step).
  mockFocused = true;
  rerender({ v: 'honest' });
  expect(result.current).toBe('honest');
});
